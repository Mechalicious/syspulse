import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function handleClose() {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

async function handleMinimize() {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

async function handleToggleMaximize() {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

interface TitleBarProps {
  statusLabel: string;
  statusTone: "live" | "demo";
  restoreLabel: string;
  maximizeLabel: string;
  minimizeLabel: string;
  closeLabel: string;
}

export function TitleBar({
  statusLabel,
  statusTone,
  restoreLabel,
  maximizeLabel,
  minimizeLabel,
  closeLabel,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function setup() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const initiallyMaximized = await win.isMaximized();
      if (!cancelled) setMaximized(initiallyMaximized);
      unlisten = await win.onResized(async () => {
        const next = await win.isMaximized();
        if (!cancelled) setMaximized(next);
      });
    }

    void setup();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div
      data-tauri-drag-region="true"
      onDoubleClick={() => void handleToggleMaximize()}
      className="flex h-9 flex-shrink-0 select-none items-center justify-between border-b border-border/60 bg-muted/40 pl-4 pr-2"
    >
      <div data-tauri-drag-region="true" className="flex items-center gap-2">
        <button
          type="button"
          title={closeLabel}
          aria-label={closeLabel}
          onClick={() => void handleClose()}
          className="h-2.5 w-2.5 rounded-full bg-destructive/80 transition-transform hover:scale-125"
        />
        <button
          type="button"
          title={minimizeLabel}
          aria-label={minimizeLabel}
          onClick={() => void handleMinimize()}
          className="h-2.5 w-2.5 rounded-full bg-warning/80 transition-transform hover:scale-125"
        />
        <button
          type="button"
          title={maximized ? restoreLabel : maximizeLabel}
          aria-label={maximized ? restoreLabel : maximizeLabel}
          onClick={() => void handleToggleMaximize()}
          className="h-2.5 w-2.5 rounded-full bg-success/80 transition-transform hover:scale-125"
        />
        <span data-tauri-drag-region="true" className="ml-2 font-mono text-[11px] tracking-wide text-muted-foreground">
          SYSPULSE.EXE
        </span>
      </div>

      <div data-tauri-drag-region="true" className="flex flex-1 justify-end">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            statusTone === "demo"
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-success/40 bg-success/10 text-success",
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
