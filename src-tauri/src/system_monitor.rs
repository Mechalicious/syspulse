use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;
use sysinfo::{Components, System};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory_bytes: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    name: String,
    usage_percent: f32,
    memory_used_mb: Option<u64>,
    memory_total_mb: Option<u64>,
    temperature_c: Option<f32>,
    power_w: Option<f32>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    cpu_usage: f32,
    cpu_per_core: Vec<f32>,
    cpu_name: String,
    cpu_temperature_c: Option<f32>,
    cpu_power_w: Option<f32>,
    memory_used_bytes: u64,
    memory_total_bytes: u64,
    swap_used_bytes: u64,
    swap_total_bytes: u64,
    gpus: Vec<GpuInfo>,
    processes: Vec<ProcessInfo>,
    timestamp_ms: u64,
}

/// Runs a command with no visible console window (Windows) and returns stdout on success.
fn run_hidden(cmd: &str, args: &[&str]) -> Option<String> {
    let mut command = Command::new(cmd);
    command.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

/// NVIDIA GPUs via `nvidia-smi`. Gives accurate usage/memory/temperature.
fn read_nvidia_gpus() -> Option<Vec<GpuInfo>> {
    let out = run_hidden(
        "nvidia-smi",
        &[
            "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
            "--format=csv,noheader,nounits",
        ],
    )?;

    let mut gpus = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() < 6 {
            continue;
        }
        gpus.push(GpuInfo {
            name: parts[0].to_string(),
            usage_percent: parts[1].parse().unwrap_or(0.0),
            memory_used_mb: parts[2].parse().ok(),
            memory_total_mb: parts[3].parse().ok(),
            temperature_c: parts[4].parse().ok(),
            power_w: parts[5].parse().ok(),
        });
    }

    if gpus.is_empty() {
        None
    } else {
        Some(gpus)
    }
}

/// Fallback for non-NVIDIA GPUs (Intel/AMD) using the same "GPU Engine" perf
/// counters Task Manager reads. No per-vendor memory/temperature data is
/// exposed this way, only aggregate engine utilization per adapter.
#[cfg(windows)]
fn read_windows_gpu_engine() -> Option<Vec<GpuInfo>> {
    let out = run_hidden("typeperf", &[r"\GPU Engine(*)\Utilization Percentage", "-sc", "1"])?;

    let lines: Vec<&str> = out.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() < 2 {
        return None;
    }

    let headers: Vec<String> = lines[0].split(',').map(|s| s.trim_matches('"').to_string()).collect();
    let values: Vec<String> = lines[1].split(',').map(|s| s.trim_matches('"').to_string()).collect();

    let mut per_gpu_total: HashMap<String, f32> = HashMap::new();
    for (header, value) in headers.iter().zip(values.iter()).skip(1) {
        let usage: f32 = value.parse().unwrap_or(0.0);
        if usage <= 0.0 {
            continue;
        }
        // Header looks like: \\HOST\GPU Engine(pid_1234_luid_..._phys_0_eng_0_engtype_3D)\Utilization Percentage
        let phys_id = header
            .split("phys_")
            .nth(1)
            .and_then(|s| s.split('_').next())
            .unwrap_or("0")
            .to_string();
        *per_gpu_total.entry(phys_id).or_insert(0.0) += usage;
    }

    if per_gpu_total.is_empty() {
        return None;
    }

    let mut gpus: Vec<GpuInfo> = per_gpu_total
        .into_iter()
        .map(|(phys_id, total)| GpuInfo {
            name: format!("GPU {phys_id}"),
            usage_percent: total.min(100.0),
            memory_used_mb: None,
            memory_total_mb: None,
            temperature_c: None,
            power_w: None,
        })
        .collect();
    gpus.sort_by(|a, b| a.name.cmp(&b.name));
    Some(gpus)
}

fn read_cpu_temperature_c(components: &Components) -> Option<f32> {
    let mut preferred = Vec::new();
    let mut fallback = Vec::new();

    for component in components {
        let Some(temp) = component.temperature() else {
            continue;
        };
        if temp.is_nan() {
            continue;
        }
        let label = component.label().to_ascii_lowercase();
        if label.contains("cpu")
            || label.contains("package")
            || label.contains("tctl")
            || label.contains("tdie")
            || label.contains("core")
        {
            preferred.push(temp);
        } else {
            fallback.push(temp);
        }
    }

    let selected = if preferred.is_empty() {
        fallback
    } else {
        preferred
    };

    if selected.is_empty() {
        None
    } else {
        Some(selected.iter().copied().sum::<f32>() / selected.len() as f32)
    }
}

#[cfg(windows)]
fn read_windows_cpu_power_w() -> Option<f32> {
    let out = run_hidden("typeperf", &[r"\Power Meter(_Total)\Power", "-sc", "1"])?;
    let lines: Vec<&str> = out.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() < 2 {
        return None;
    }

    let values: Vec<&str> = lines[1].split(',').map(|s| s.trim_matches('"')).collect();
    let watts = values.get(1)?.parse::<f32>().ok()?;
    if watts.is_finite() {
        Some(watts.max(0.0))
    } else {
        None
    }
}

#[cfg(not(windows))]
fn read_windows_cpu_power_w() -> Option<f32> {
    None
}

fn read_gpus() -> Vec<GpuInfo> {
    if let Some(gpus) = read_nvidia_gpus() {
        return gpus;
    }
    #[cfg(windows)]
    {
        if let Some(gpus) = read_windows_gpu_engine() {
            return gpus;
        }
    }
    Vec::new()
}

/// Spawns the background polling loop that emits `system-stats` to the frontend.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        let mut components = Components::new_with_refreshed_list();

        loop {
            sys.refresh_cpu_usage();
            sys.refresh_memory();
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            components.refresh(false);

            let cpu_usage = sys.global_cpu_usage();
            let cpu_per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
            let cpu_name = sys
                .cpus()
                .first()
                .map(|c| c.brand().trim().to_string())
                .unwrap_or_default();
            let cpu_temperature_c = read_cpu_temperature_c(&components);
            let cpu_power_w = read_windows_cpu_power_w();

            let mut processes: Vec<ProcessInfo> = sys
                .processes()
                .values()
                .map(|p| ProcessInfo {
                    pid: p.pid().as_u32(),
                    name: p.name().to_string_lossy().to_string(),
                    cpu_usage: p.cpu_usage(),
                    memory_bytes: p.memory(),
                })
                .collect();
            processes.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
            processes.truncate(50);

            let stats = SystemStats {
                cpu_usage,
                cpu_per_core,
                cpu_name,
                cpu_temperature_c,
                cpu_power_w,
                memory_used_bytes: sys.used_memory(),
                memory_total_bytes: sys.total_memory(),
                swap_used_bytes: sys.used_swap(),
                swap_total_bytes: sys.total_swap(),
                gpus: read_gpus(),
                processes,
                timestamp_ms: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
            };

            let _ = app.emit("system-stats", &stats);
            std::thread::sleep(Duration::from_millis(1500));
        }
    });
}
