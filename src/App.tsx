import { useEffect, useRef, useState } from "react";
import { Cpu, MemoryStick, MonitorSmartphone } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { UsageCard, type HistoryPoint } from "@/components/dashboard/usage-card";
import { CoreGrid } from "@/components/dashboard/core-grid";
import { ProcessTable } from "@/components/dashboard/process-table";
import { useSystemStats } from "@/hooks/use-system-stats";
import { formatBytes } from "@/lib/utils";

const HISTORY_LENGTH = 40;

function pushHistory(history: HistoryPoint[], t: number, value: number): HistoryPoint[] {
  const next = [...history, { t, value }];
  return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
}

function formatThermalPower(temperatureC: number | null, powerW: number | null): string {
  const parts: string[] = [];
  if (temperatureC != null) parts.push(`${temperatureC.toFixed(0)} °C`);
  if (powerW != null) parts.push(`${powerW.toFixed(0)} W`);
  return parts.length ? parts.join(" · ") : "N/A capteurs indisponibles";
}

function App() {
  const { stats, source } = useSystemStats();
  const [section, setSection] = useState<"dashboard" | "processes">("dashboard");

  const [cpuHistory, setCpuHistory] = useState<HistoryPoint[]>([]);
  const [memHistory, setMemHistory] = useState<HistoryPoint[]>([]);
  const [gpuHistories, setGpuHistories] = useState<HistoryPoint[][]>([]);
  const lastTimestamp = useRef<number>(0);

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

  if (!stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Connexion au capteur système…
      </div>
    );
  }

  const memPercent = stats.memoryTotalBytes ? (stats.memoryUsedBytes / stats.memoryTotalBytes) * 100 : 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar activeSection={section} onNavigate={setSection} />

      <main className="scrollbar-thin flex-1 overflow-y-auto">
        <div
          data-tauri-drag-region="true"
          className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur"
        >
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Tableau de bord système</h1>
            <p className="text-xs text-muted-foreground">{stats.cpuName || "Processeur"}</p>
          </div>
          {source === "mock" ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
              Mode démo — hors application Tauri
            </span>
          ) : (
            <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              Live
            </span>
          )}
        </div>

        <div className="mx-auto max-w-6xl space-y-4 p-6">
          {section === "dashboard" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <UsageCard
                  title="CPU"
                  subtitle={stats.cpuName}
                  icon={Cpu}
                  value={stats.cpuUsage}
                  history={cpuHistory}
                  color="var(--color-chart-1)"
                  footer={formatThermalPower(stats.cpuTemperatureC, stats.cpuPowerW)}
                />
                <UsageCard
                  title="Mémoire"
                  subtitle={`${formatBytes(stats.memoryUsedBytes)} / ${formatBytes(stats.memoryTotalBytes)}`}
                  icon={MemoryStick}
                  value={memPercent}
                  history={memHistory}
                  color="var(--color-chart-4)"
                  footer={
                    stats.swapTotalBytes
                      ? `Swap : ${formatBytes(stats.swapUsedBytes)} / ${formatBytes(stats.swapTotalBytes)}`
                      : undefined
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
                      footer={formatThermalPower(gpu.temperatureC, gpu.powerW)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                    <MonitorSmartphone className="mb-2 h-5 w-5" />
                    Aucune donnée GPU disponible sur cette machine.
                  </div>
                )}
              </div>

              <CoreGrid cores={stats.cpuPerCore} />

              <ProcessTable processes={stats.processes.slice(0, 10)} />
            </>
          ) : (
            <ProcessTable processes={stats.processes} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
