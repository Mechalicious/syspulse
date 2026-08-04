import { Fan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FanInfo } from "@/types";

interface FanTableProps {
  fans: FanInfo[];
}

function formatPercent(value: number | null): string {
  return value == null ? "N/A" : `${value.toFixed(0)} %`;
}

function formatRpm(value: number | null): string {
  return value == null ? "N/A" : `${value} RPM`;
}

export function FanTable({ fans }: FanTableProps) {
  const sources = Array.from(new Set(fans.map((fan) => fan.source))).sort();
  const hasNvidia = sources.includes("NVIDIA");
  const hasLhm = sources.includes("LibreHardwareMonitor");
  const hasOhm = sources.includes("OpenHardwareMonitor");
  const sourceBadgeClass = (enabled: boolean) =>
    enabled
      ? "rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success"
      : "rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <span>Ventilateurs</span>
          <span className="text-xs font-normal text-muted-foreground">{fans.length} détecté(s)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sources:</span>
          <span className={sourceBadgeClass(hasNvidia)}>
            NVIDIA {hasNvidia ? "OK" : "absent"}
          </span>
          <span className={sourceBadgeClass(hasLhm)}>
            LibreHardwareMonitor {hasLhm ? "OK" : "absent"}
          </span>
          <span className={sourceBadgeClass(hasOhm)}>
            OpenHardwareMonitor {hasOhm ? "OK" : "absent"}
          </span>
        </div>

        {!hasLhm && !hasOhm ? (
          <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Pour voir les ventilateurs carte mère/AIO (CPU_FAN, CHA_FAN, PUMP), lance LibreHardwareMonitor ou
            OpenHardwareMonitor avec l&apos;export capteurs actif.
          </p>
        ) : null}

        {fans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            <Fan className="mb-2 h-5 w-5" />
            Aucune donnée ventilateur exposée par les capteurs système.
          </div>
        ) : (
          <div className="scrollbar-thin max-h-[520px] overflow-y-auto rounded-md border border-border/40">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Nom</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Vitesse %</th>
                  <th className="px-3 py-2 text-right font-medium">Vitesse RPM</th>
                </tr>
              </thead>
              <tbody>
                {fans.map((fan, index) => (
                  <tr key={`${fan.name}-${index}`} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{fan.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fan.source}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPercent(fan.speedPercent)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatRpm(fan.speedRpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
