import { Activity, Fan, ListTree, MonitorCog, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeSection: "dashboard" | "processes" | "fans" | "settings";
  onNavigate: (section: "dashboard" | "processes" | "fans" | "settings") => void;
  language: "fr" | "en";
}

export function Sidebar({ activeSection, onNavigate, language }: SidebarProps) {
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
    <div className="hidden shrink-0 items-stretch py-3 pl-3 md:flex">
      <div className="flex w-16 flex-col items-center gap-1 rounded-full bg-foreground/95 py-4 shadow-xl">
        <div className="mb-3 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-chart-1 text-background">
          <MonitorCog className="h-5 w-5" />
        </div>

        <nav
          className="flex flex-1 flex-col items-center gap-1.5"
          aria-label={language === "en" ? "Main navigation" : "Navigation principale"}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-chart-1 text-background"
                    : "text-background/60 hover:bg-background/10 hover:text-background",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            );
          })}
        </nav>

        <span
          className="mt-3 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-success"
          title={language === "en" ? "Real-time monitoring" : "Monitoring temps reel"}
        />
      </div>
    </div>
  );
}
