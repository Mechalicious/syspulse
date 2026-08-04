import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface HistoryPoint {
  t: number;
  value: number;
}

interface UsageCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  value: number;
  unit?: string;
  history: HistoryPoint[];
  color: string;
  footer?: React.ReactNode;
}

export function UsageCard({ title, subtitle, icon: Icon, value, unit = "%", history, color, footer }: UsageCardProps) {
  const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle>
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
            {value.toFixed(0)}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
          </span>
        </CardTitle>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={() => ""}
                formatter={(v) => [`${Number(v).toFixed(1)} %`, title]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {footer ? <div className={cn("mt-2 text-xs text-muted-foreground")}>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
