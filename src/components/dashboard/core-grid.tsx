import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CoreGridProps {
  cores: number[];
  title: string;
  subtitle: string;
}

function coreColor(usage: number): string {
  if (usage >= 85) return "var(--color-destructive)";
  if (usage >= 60) return "var(--color-warning)";
  return "var(--color-chart-1)";
}

export function CoreGrid({ cores, title, subtitle }: CoreGridProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground">{subtitle}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {cores.map((usage, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="relative h-16 w-3 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="absolute bottom-0 w-full rounded-full transition-[height] duration-500"
                  style={{ height: `${Math.max(4, usage)}%`, backgroundColor: coreColor(usage) }}
                />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(usage)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
