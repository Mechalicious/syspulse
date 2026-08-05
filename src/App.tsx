import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, MemoryStick, MonitorSmartphone, X } from "lucide-react";
import { RingGauge } from "@/components/floating/ring-gauge";
import { Sidebar } from "@/components/layout/sidebar";
import { UsageCard, type HistoryPoint } from "@/components/dashboard/usage-card";
import { CoreGrid } from "@/components/dashboard/core-grid";
import { ProcessTable } from "@/components/dashboard/process-table";
import { FanTable } from "@/components/dashboard/fan-table";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useSystemStats } from "@/hooks/use-system-stats";
import { formatBytes } from "@/lib/utils";
import type { AppLanguage, AppSettings, TemperatureDisplay } from "@/types";

const HISTORY_LENGTH = 40;
const SETTINGS_KEY = "syspulse-settings";

const DEFAULT_SETTINGS: AppSettings = {
  autoRunOnBoot: false,
  hideOnSystemTrayWhenAutoRunOnBoot: false,
  minimizeAppToSystemTrayAtClose: true,
  floatingSystemInformationWindow: false,
  language: "fr",
  temperatureDisplay: "celsius",
  theme: "dark",
};

type AppSection = "dashboard" | "processes" | "fans" | "settings";

function pushHistory(history: HistoryPoint[], t: number, value: number): HistoryPoint[] {
  const next = [...history, { t, value }];
  return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function toTemperatureUnit(valueC: number, display: TemperatureDisplay): number {
  if (display === "fahrenheit") {
    return valueC * 9 / 5 + 32;
  }
  return valueC;
}

function formatTemperature(valueC: number | null | undefined, display: TemperatureDisplay): string | null {
  if (valueC == null) return null;
  const value = toTemperatureUnit(valueC, display);
  return `${value.toFixed(0)} ${display === "fahrenheit" ? "F" : "C"}`;
}

function formatHardwareMetrics(options: {
  temperatureC?: number | null;
  powerW?: number | null;
  clockMhz?: number | null;
  voltageV?: number | null;
  temperatureDisplay: TemperatureDisplay;
}): string {
  const parts: string[] = [];
  const temp = formatTemperature(options.temperatureC, options.temperatureDisplay);
  if (temp) parts.push(temp);
  if (options.powerW != null) parts.push(`${options.powerW.toFixed(1)} W`);
  if (options.clockMhz != null) parts.push(`${options.clockMhz.toFixed(0)} MHz`);
  if (options.voltageV != null) parts.push(`${options.voltageV.toFixed(2)} V`);
  return parts.length ? parts.join(" · ") : "N/A capteurs indisponibles";
}

function appText(language: AppLanguage) {
  if (language === "en") {
    return {
      loading: "Connecting to system sensor...",
      cpuFallback: "Processor",
      demo: "Demo mode - outside Tauri app",
      live: "Live",
      title: {
        dashboard: "System Dashboard",
        processes: "Processes",
        fans: "Fans",
        settings: "Settings",
      },
      cpuUsage: "CPU Usage",
      memory: "Memory",
      network: "Network",
      swap: "Swap",
      gpuUnavailable: "No GPU data available on this machine.",
      physical: "Physical Cores (estimated)",
      threads: "Logical Threads",
      floatingTitle: "Floating Info",
      floatingCpu: "CPU",
      floatingMem: "Memory",
      floatingGpu: "GPU",
      floatingGpuMemory: "GPU Memory",
      floatingClose: "Close",
    };
  }

  return {
    loading: "Connexion au capteur systeme...",
    cpuFallback: "Processeur",
    demo: "Mode demo - hors application Tauri",
    live: "Live",
    title: {
      dashboard: "Tableau de bord systeme",
      processes: "Processus",
      fans: "Ventilateurs",
      settings: "Parametres",
    },
    cpuUsage: "Utilisation CPU",
    memory: "Memoire",
    network: "Reseau",
    swap: "Swap",
    gpuUnavailable: "Aucune donnee GPU disponible sur cette machine.",
    physical: "Coeurs physiques (estime)",
    threads: "Threads logiques",
    floatingTitle: "Infos flottantes",
    floatingCpu: "CPU",
    floatingMem: "Memoire",
    floatingGpu: "GPU",
    floatingGpuMemory: "Memoire GPU",
    floatingClose: "Fermer",
  };
}

function App() {
  const { stats, source } = useSystemStats();
  const [section, setSection] = useState<AppSection>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [cpuHistory, setCpuHistory] = useState<HistoryPoint[]>([]);
  const [memHistory, setMemHistory] = useState<HistoryPoint[]>([]);
  const [gpuHistories, setGpuHistories] = useState<HistoryPoint[][]>([]);
  const lastTimestamp = useRef<number>(0);

  const floatingView = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("view") === "floating";
  }, []);

  const t = appText(settings.language);

  useEffect(() => {
    async function loadSettings() {
      if (isTauriRuntime()) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const loaded = await invoke<AppSettings>("get_app_settings");
          setSettings(loaded);
          setSettingsLoaded(true);
          return;
        } catch {
          // fall through to local storage defaults
        }
      }

      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AppSettings;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {
        // Keep default settings if local storage is unavailable.
      }
      setSettingsLoaded(true);
    }

    void loadSettings();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  async function persistSettings(next: AppSettings) {
    setSettings(next);
    setSavingSettings(true);
    if (isTauriRuntime()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("update_app_settings", { settings: next });
      } finally {
        setSavingSettings(false);
      }
      return;
    }

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } finally {
      setSavingSettings(false);
    }
  }

  async function checkForUpdates() {
    const url = "https://github.com/Mechalicious/syspulse/releases";
    if (isTauriRuntime()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!stats || stats.timestampMs === lastTimestamp.current) return;
    lastTimestamp.current = stats.timestampMs;

    setCpuHistory((h) => pushHistory(h, stats.timestampMs, stats.cpuUsage));

    const memPercent = stats.memoryTotalBytes
      ? (stats.memoryUsedBytes / stats.memoryTotalBytes) * 100
      : 0;
    setMemHistory((h) => pushHistory(h, stats.timestampMs, memPercent));

    setGpuHistories((prev) =>
      stats.gpus.map((gpu, i) => pushHistory(prev[i] ?? [], stats.timestampMs, gpu.usagePercent)),
    );
  }, [stats]);

  if (!stats || !settingsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  const memPercent = stats.memoryTotalBytes ? (stats.memoryUsedBytes / stats.memoryTotalBytes) * 100 : 0;

  if (floatingView) {
    const gpu = stats.gpus[0];
    const gpuMemoryPercent =
      gpu?.memoryUsedMb != null && gpu?.memoryTotalMb != null
        ? (gpu.memoryUsedMb / gpu.memoryTotalMb) * 100
        : null;

    return (
      <div
        data-tauri-drag-region="deep"
        className="h-screen select-none p-3 text-foreground"
      >
        <button
          type="button"
          aria-label={t.floatingClose}
          onClick={async () => {
            if (isTauriRuntime()) {
              const { getCurrentWindow } = await import("@tauri-apps/api/window");
              await getCurrentWindow().hide();
            }
          }}
          className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="grid h-full grid-cols-3 gap-2 rounded-lg border border-border/60 bg-card/70 p-3 pt-6 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="text-muted-foreground">{t.floatingCpu}</p>
            <p className="font-mono text-lg">{stats.cpuUsage.toFixed(0)}%</p>
          </div>

          <div className="rounded-md border border-border/60 p-2">
            <p className="text-muted-foreground">{t.floatingMem}</p>
            <p className="font-mono text-lg">{memPercent.toFixed(0)}%</p>
          </div>

          <div className="rounded-md border border-border/60 p-2">
            <p className="text-muted-foreground">{t.floatingGpu}</p>
            <p className="font-mono text-lg">{gpu?.usagePercent != null ? gpu.usagePercent.toFixed(0) : 0}%</p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-md border border-border/60 p-2">
            <p className="text-muted-foreground">{t.floatingGpuMemory}</p>
            {gpuMemoryPercent == null ? (
              <p className="font-mono text-lg">—</p>
            ) : (
              <RingGauge value={gpuMemoryPercent} />
            )}
          </div>

          <div className="flex flex-col items-center gap-2 rounded-md border border-border/60 p-2">
            <p className="text-muted-foreground">{t.floatingGpu}</p>
            <RingGauge value={gpu?.usagePercent ?? 0} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar activeSection={section} onNavigate={setSection} language={settings.language} />

      <main className="flex-1 overflow-hidden">
        <div className="scrollbar-thin h-full overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-6">
          {section === "dashboard" ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                    <span className="ml-2 font-mono text-[11px] tracking-wide text-muted-foreground">SYSPULSE.EXE</span>
                  </div>
                  {source === "mock" ? (
                    <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                      {t.demo}
                    </span>
                  ) : (
                    <span className="rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      {t.live}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight">{t.title.dashboard}</h1>
                    <p className="text-xs text-muted-foreground">{stats.cpuName || t.cpuFallback}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                      CPU {stats.cpuUsage.toFixed(0)}%
                    </span>
                    <span className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                      MEM {memPercent.toFixed(0)}%
                    </span>
                    <span className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                      THR {stats.cpuPerCore.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <UsageCard
                  title={t.cpuUsage}
                  subtitle={stats.cpuName}
                  icon={Cpu}
                  value={stats.cpuUsage}
                  history={cpuHistory}
                  color="var(--color-chart-1)"
                  footer={formatHardwareMetrics({
                    temperatureC: stats.cpuTemperatureC,
                    powerW: stats.cpuPowerW,
                    clockMhz: stats.cpuClockMhz,
                    voltageV: stats.cpuVoltageV,
                    temperatureDisplay: settings.temperatureDisplay,
                  })}
                />
                <UsageCard
                  title={t.memory}
                  subtitle={`${formatBytes(stats.memoryUsedBytes)} / ${formatBytes(stats.memoryTotalBytes)}`}
                  icon={MemoryStick}
                  value={memPercent}
                  history={memHistory}
                  color="var(--color-chart-4)"
                  footer={
                    [
                      stats.swapTotalBytes
                        ? `${t.swap}: ${formatBytes(stats.swapUsedBytes)} / ${formatBytes(stats.swapTotalBytes)}`
                        : null,
                      `${t.network}: ↓ ${formatBytes(stats.network.downloadBps)}/s · ↑ ${formatBytes(stats.network.uploadBps)}/s`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  }
                />
                {stats.gpus.length > 0 ? (
                  stats.gpus.map((gpu, i) => (
                    <UsageCard
                      key={gpu.name + i}
                      title={stats.gpus.length > 1 ? `GPU ${i + 1}` : "GPU"}
                      subtitle={
                        gpu.memoryUsedMb != null && gpu.memoryTotalMb != null
                          ? `${gpu.name} · ${gpu.memoryUsedMb} / ${gpu.memoryTotalMb} Mo`
                          : gpu.name
                      }
                      icon={MonitorSmartphone}
                      value={gpu.usagePercent}
                      history={gpuHistories[i] ?? []}
                      color="var(--color-chart-3)"
                      footer={formatHardwareMetrics({
                        temperatureC: gpu.temperatureC,
                        powerW: gpu.powerW,
                        clockMhz: gpu.clockMhz,
                        voltageV: gpu.voltageV,
                        temperatureDisplay: settings.temperatureDisplay,
                      })}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                    <MonitorSmartphone className="mb-2 h-5 w-5" />
                    {t.gpuUnavailable}
                  </div>
                )}
              </div>

              {stats.cpuPerPhysicalCoreEstimated ? (
                <CoreGrid
                  cores={stats.cpuPerPhysicalCoreEstimated}
                  title={t.physical}
                  subtitle={`${stats.cpuPerPhysicalCoreEstimated.length} ${settings.language === "en" ? "physical cores" : "coeurs physiques"}`}
                />
              ) : null}

              <CoreGrid
                cores={stats.cpuPerCore}
                title={t.threads}
                subtitle={`${stats.cpuPerCore.length} ${settings.language === "en" ? "logical threads" : "threads logiques"}`}
              />

              <ProcessTable processes={stats.processes.slice(0, 10)} logicalThreads={stats.cpuPerCore.length} />
            </>
          ) : section === "fans" ? (
            <FanTable fans={stats.fans} />
          ) : section === "settings" ? (
            <SettingsPanel
              settings={settings}
              language={settings.language}
              onChange={(next) => void persistSettings(next)}
              onCheckUpdate={checkForUpdates}
              saving={savingSettings}
            />
          ) : (
            <ProcessTable processes={stats.processes} logicalThreads={stats.cpuPerCore.length} />
          )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
