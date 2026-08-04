use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Command;
use std::time::Instant;
use std::time::Duration;
use sysinfo::{Components, Networks, Pid, ProcessesToUpdate, System};
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
    clock_mhz: Option<u32>,
    voltage_v: Option<f32>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    download_bps: u64,
    upload_bps: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FanInfo {
    name: String,
    source: String,
    speed_percent: Option<f32>,
    speed_rpm: Option<u32>,
}

#[derive(Deserialize)]
struct ExternalFanSensor {
    name: String,
    rpm: Option<f64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    cpu_usage: f32,
    cpu_per_core: Vec<f32>,
    cpu_per_physical_core_estimated: Option<Vec<f32>>,
    cpu_name: String,
    cpu_physical_cores: Option<u32>,
    cpu_temperature_c: Option<f32>,
    cpu_power_w: Option<f32>,
    cpu_clock_mhz: Option<u64>,
    cpu_voltage_v: Option<f32>,
    memory_used_bytes: u64,
    memory_total_bytes: u64,
    swap_used_bytes: u64,
    swap_total_bytes: u64,
    network: NetworkInfo,
    fans: Vec<FanInfo>,
    gpus: Vec<GpuInfo>,
    processes: Vec<ProcessInfo>,
    timestamp_ms: u64,
}

fn parse_optional_f32(value: &str) -> Option<f32> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("n/a") || trimmed.eq_ignore_ascii_case("not supported") {
        return None;
    }
    trimmed.parse::<f32>().ok()
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
    let voltages = read_nvidia_gpu_voltages();
    let out = run_hidden(
        "nvidia-smi",
        &[
            "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,clocks.current.graphics",
            "--format=csv,noheader,nounits",
        ],
    )?;

    let mut gpus = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() < 7 {
            continue;
        }
        gpus.push(GpuInfo {
            name: parts[0].to_string(),
            usage_percent: parts[1].parse().unwrap_or(0.0),
            memory_used_mb: parts[2].parse().ok(),
            memory_total_mb: parts[3].parse().ok(),
            temperature_c: parse_optional_f32(parts[4]),
            power_w: parse_optional_f32(parts[5]),
            clock_mhz: parts[6].parse().ok(),
            voltage_v: voltages.get(gpus.len()).copied().flatten(),
        });
    }

    if gpus.is_empty() {
        None
    } else {
        Some(gpus)
    }
}

fn read_nvidia_gpu_voltages() -> Vec<Option<f32>> {
    let Some(out) = run_hidden("nvidia-smi", &["-q", "-d", "VOLTAGE"]) else {
        return Vec::new();
    };

    let mut values: Vec<Option<f32>> = Vec::new();
    let mut current: Option<f32> = None;

    for line in out.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("GPU ") {
            if !values.is_empty() || current.is_some() {
                values.push(current.take());
            }
            continue;
        }

        if trimmed.to_ascii_lowercase().contains("voltage") {
            if let Some((_, raw_value)) = trimmed.split_once(':') {
                let token = raw_value.trim().split_whitespace().next().unwrap_or_default();
                if let Ok(number) = token.parse::<f32>() {
                    if raw_value.to_ascii_lowercase().contains("mv") {
                        current = Some(number / 1000.0);
                    } else {
                        current = Some(number);
                    }
                }
            }
        }
    }

    if !values.is_empty() || current.is_some() {
        values.push(current);
    }

    values
}

fn read_nvidia_fans() -> Option<Vec<FanInfo>> {
    let out = run_hidden(
        "nvidia-smi",
        &[
            "--query-gpu=name,fan.speed",
            "--format=csv,noheader,nounits",
        ],
    )?;

    let mut fans = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() < 2 {
            continue;
        }
        fans.push(FanInfo {
            name: format!("{} Fan", parts[0]),
            source: "NVIDIA".to_string(),
            speed_percent: parse_optional_f32(parts[1]),
            speed_rpm: None,
        });
    }

    if fans.is_empty() {
        None
    } else {
        Some(fans)
    }
}

fn parse_external_fans_json(json: &str, source: &str) -> Vec<FanInfo> {
    let Ok(value) = serde_json::from_str::<Value>(json) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    match value {
        Value::Array(items) => {
            for item in items {
                if let Ok(sensor) = serde_json::from_value::<ExternalFanSensor>(item) {
                    out.push(FanInfo {
                        name: sensor.name,
                        source: source.to_string(),
                        speed_percent: None,
                        speed_rpm: sensor.rpm.map(|v| v.max(0.0).round() as u32),
                    });
                }
            }
        }
        Value::Object(_) => {
            if let Ok(sensor) = serde_json::from_value::<ExternalFanSensor>(value) {
                out.push(FanInfo {
                    name: sensor.name,
                    source: source.to_string(),
                    speed_percent: None,
                    speed_rpm: sensor.rpm.map(|v| v.max(0.0).round() as u32),
                });
            }
        }
        _ => {}
    }

    out
}

#[cfg(windows)]
fn read_windows_monitor_fans(namespace: &str, source: &str) -> Vec<FanInfo> {
    let script = format!(
        "$ErrorActionPreference='Stop'; \
        $s = Get-CimInstance -Namespace '{namespace}' -ClassName Sensor -ErrorAction Stop | \
        Where-Object {{ $_.SensorType -eq 'Fan' }} | \
        Select-Object @{{Name='name';Expression={{$_.Name}}}}, @{{Name='rpm';Expression={{[double]$_.Value}}}}; \
        if (-not $s) {{ '[]' }} else {{ $s | ConvertTo-Json -Compress }}"
    );

    let Some(out) = run_hidden(
        "powershell",
        &["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script],
    ) else {
        return Vec::new();
    };

    parse_external_fans_json(out.trim(), source)
}

#[cfg(not(windows))]
fn read_windows_monitor_fans(_namespace: &str, _source: &str) -> Vec<FanInfo> {
    Vec::new()
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
            clock_mhz: None,
            voltage_v: None,
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

#[cfg(windows)]
fn read_windows_cpu_voltage_v() -> Option<f32> {
    let out = run_hidden("wmic", &["cpu", "get", "CurrentVoltage", "/value"])?;
    for line in out.lines() {
        let trimmed = line.trim();
        if let Some(raw) = trimmed.strip_prefix("CurrentVoltage=") {
            let value = raw.trim().parse::<u32>().ok()?;
            if value == 0 {
                return None;
            }
            return Some(value as f32 / 10.0);
        }
    }
    None
}

#[cfg(not(windows))]
fn read_windows_cpu_voltage_v() -> Option<f32> {
    None
}

fn read_network_bps(networks: &mut Networks, elapsed: Duration) -> NetworkInfo {
    networks.refresh(false);
    let mut received_total: u64 = 0;
    let mut transmitted_total: u64 = 0;

    for (_, net) in networks.iter() {
        received_total = received_total.saturating_add(net.received());
        transmitted_total = transmitted_total.saturating_add(net.transmitted());
    }

    let seconds = elapsed.as_secs_f64().max(0.001);
    NetworkInfo {
        download_bps: (received_total as f64 / seconds).round() as u64,
        upload_bps: (transmitted_total as f64 / seconds).round() as u64,
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

fn read_fans() -> Vec<FanInfo> {
    let mut fans = Vec::new();
    if let Some(nvidia) = read_nvidia_fans() {
        fans.extend(nvidia);
    }
    fans.extend(read_windows_monitor_fans("root/LibreHardwareMonitor", "LibreHardwareMonitor"));
    fans.extend(read_windows_monitor_fans("root/OpenHardwareMonitor", "OpenHardwareMonitor"));
    fans
}

fn estimate_physical_core_usage(logical_threads: &[f32], physical_cores: usize) -> Option<Vec<f32>> {
    if physical_cores == 0 || logical_threads.is_empty() || logical_threads.len() < physical_cores {
        return None;
    }

    let threads_per_core = logical_threads.len() / physical_cores;
    if threads_per_core == 0 || threads_per_core * physical_cores != logical_threads.len() {
        return None;
    }

    let mut estimated = Vec::with_capacity(physical_cores);
    for chunk in logical_threads.chunks_exact(threads_per_core) {
        let avg = chunk.iter().copied().sum::<f32>() / chunk.len() as f32;
        estimated.push(avg);
    }
    Some(estimated)
}

/// Spawns the background polling loop that emits `system-stats` to the frontend.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        let mut components = Components::new_with_refreshed_list();
        let mut networks = Networks::new_with_refreshed_list();
        let mut last_poll = Instant::now();

        loop {
            let now = Instant::now();
            let elapsed = now.saturating_duration_since(last_poll);
            last_poll = now;

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
            let cpu_physical_cores = sys.physical_core_count().map(|count| count as u32);
            let cpu_per_physical_core_estimated = cpu_physical_cores
                .and_then(|cores| estimate_physical_core_usage(&cpu_per_core, cores as usize));
            let cpu_temperature_c = read_cpu_temperature_c(&components);
            let cpu_power_w = read_windows_cpu_power_w();
            let cpu_clock_mhz = sys.cpus().first().map(|c| c.frequency());
            let cpu_voltage_v = read_windows_cpu_voltage_v();
            let network = read_network_bps(&mut networks, elapsed);
            let fans = read_fans();

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
                cpu_per_physical_core_estimated,
                cpu_name,
                cpu_physical_cores,
                cpu_temperature_c,
                cpu_power_w,
                cpu_clock_mhz,
                cpu_voltage_v,
                memory_used_bytes: sys.used_memory(),
                memory_total_bytes: sys.total_memory(),
                swap_used_bytes: sys.used_swap(),
                swap_total_bytes: sys.total_swap(),
                network,
                fans,
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

pub fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let target_pid = Pid::from_u32(pid);
    let Some(process) = sys.process(target_pid) else {
        return Err(format!("Processus introuvable (PID {pid})"));
    };

    if process.kill() {
        Ok(())
    } else {
        Err(format!("Impossible de terminer le processus (PID {pid})"))
    }
}
