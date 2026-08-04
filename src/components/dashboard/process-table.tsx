import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBytes, formatPercent } from "@/lib/utils";
import type { ProcessInfo } from "@/types";

interface ProcessTableProps {
  processes: ProcessInfo[];
}

type SortKey = "memoryBytes" | "cpuUsage" | "name";

export function ProcessTable({ processes }: ProcessTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("memoryBytes");
  const [sortDesc, setSortDesc] = useState(true);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const filtered = query
      ? processes.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || String(p.pid).includes(query))
      : processes;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      }
      return sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
    });

    return sorted;
  }, [processes, query, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const columns: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "name", label: "Processus" },
    { key: "cpuUsage", label: "CPU", align: "right" },
    { key: "memoryBytes", label: "Mémoire", align: "right" },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle>
          <span>Processus</span>
          <span className="text-xs font-normal text-muted-foreground">{rows.length} en cours</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom ou PID..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="scrollbar-thin max-h-[420px] overflow-y-auto rounded-md border border-border/40">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="w-16 px-3 py-2 text-left font-medium">PID</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "cursor-pointer select-none px-3 py-2 font-medium",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                      {col.label}
                      {sortKey === col.key ? (
                        sortDesc ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pid} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.pid}</td>
                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatPercent(p.cpuUsage, 1)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatBytes(p.memoryBytes)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun processus ne correspond.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
