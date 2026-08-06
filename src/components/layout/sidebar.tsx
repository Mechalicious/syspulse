import { useState } from "react";
import { Activity, Cpu, Fan, ListTree, MonitorCog, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeSection: "dashboard" | "processes" | "fans" | "settings";
  onNavigate: (section: "dashboard" | "processes" | "fans" | "settings") => void;
  language: "fr" | "en";
}

export function Sidebar({ activeSection, onNavigate, language }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navItems = language === "en"
    ? [
        { id: "dashboard" as const, label: "Dashboard", icon: Activity },
        { id: "processes" as const, label: "Processes", icon: ListTree },
        { id: "fans" as const, label: "Fans", icon: Fan },
        { id: "settings" as const, label: "Settings", icon: Settings },
      ]
    : [
        { id: "dashboard" as const, label: "Tableau de bord", icon: Activity },
        { id: "processes" as const, label: "Processus", icon: ListTree },
        { id: "fans" as const, label: "Ventilateurs", icon: Fan },
        { id: "settings" as const, label: "Parametres", icon: Settings },
      ];

  return (
    <div
      className={cn(
        "hidden h-full flex-shrink-0 border-r border-border/60 bg-sidebar pt-4 transition-[width] duration-300 ease-in-out md:flex md:flex-col",
        collapsed ? "md:w-sidebar-collapsed" : "md:w-sidebar",
      )}
    >
      <div className="flex w-full flex-col px-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mb-6 flex items-center gap-2 rounded-md px-2 py-1 text-left"
          title={language === "en" ? "Collapse / expand" : "Reduire / agrandir"}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-chart-1/20 text-chart-1">
            <MonitorCog className="h-5 w-5" />
          </span>
          <span
            className={cn(
              "font-mono text-lg font-semibold tracking-tight text-foreground/90 transition-opacity duration-200",
              collapsed ? "sr-only opacity-0" : "opacity-100",
            )}
          >
            SysPulse
          </span>
        </button>

        <nav className="flex flex-col gap-1" aria-label={language === "en" ? "Main navigation" : "Navigation principale"}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={cn("truncate", collapsed && "sr-only opacity-0")}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border/60 px-4 py-3 text-muted-foreground">
        <Cpu className="h-4 w-4 flex-shrink-0" />
        <span className={cn("truncate text-xs", collapsed && "sr-only opacity-0")}>
          {language === "en" ? "Real-time monitoring" : "Monitoring temps reel"}
        </span>
      </div>
    </div>
  );
}
