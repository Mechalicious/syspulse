# Floating Window Drag/Close/GPU Gauges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Syspulse floating window draggable, add an X button that hides it (setting stays ON, re-showable via a new tray menu item), and render GPU memory + GPU usage as compact circular 0-100% ring gauges.

**Architecture:** Frontend-only changes for drag (Tauri's injected `data-tauri-drag-region="deep"`), close (X button calling `getCurrentWindow().hide()`), and the new ring-gauge component (hand-rolled SVG, no new dependency). One Rust change in `setup_tray` to add a « Show floating window » menu item, and one size change in `apply_floating_window` (320×170 → 400×220).

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Tauri 2.11, `@tauri-apps/api` v2.11, lucide-react. No test framework in the repo — verification is `npm run build` (tsc + vite), `npm run tauri build`, and manual runtime checks.

## Global Constraints

- Do NOT add new npm dependencies (ring gauge is hand-rolled SVG).
- Do NOT add comments to code.
- `data-tauri-drag-region="deep"` on the floating root container; do NOT put it on the X button.
- Close action: `getCurrentWindow().hide()` from `@tauri-apps/api/window` — never `close()`.
- GPU memory unavailable (`memoryUsedMb == null || memoryTotalMb == null`): tile shows `—`, no gauge.
- GPU memory percent = `memoryUsedMb / memoryTotalMb * 100`; clamp gauge values to 0–100.
- Accent color for gauges: `var(--color-chart-3)`.
- All new UI strings go through the `appText()` map in `src/App.tsx` (EN + FR branches).
- Tauri sync-command deadlock rule (from prior work): window creation must NOT happen in sync commands. This plan only resizes/shows — no new window creation.

---

### Task 1: Create the `RingGauge` component

**Files:**
- Create: `src/components/floating/ring-gauge.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational component).
- Produces: `RingGauge({ value, size?, strokeWidth?, color? })` — named export, `value: number` (0–100, clamped internally), `size: number` (default 52), `strokeWidth: number` (default 5), `color: string` (default `"var(--color-chart-3)"`). Renders an SVG ring with a track circle and a progress arc, plus a centered `<span>` showing `Math.round(value)%`.

- [ ] **Step 1: Write the component**

```tsx
export function RingGauge({
  value,
  size = 52,
  strokeWidth = 5,
  color = "var(--color-chart-3)",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono text-xs tabular-nums text-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript + build**

Run: `npm run build`
Expected: tsc passes, vite bundles successfully. (No test framework exists; the component is pure presentation and the build is the gate.)

- [ ] **Step 3: Commit**

```bash
git add src/components/floating/ring-gauge.tsx
git commit -m "feat: add SVG ring gauge component"
```

---

### Task 2: Rework the floating view in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx:66-116` (add i18n keys to `appText` EN and FR branches)
- Modify: `src/App.tsx:226-245` (floating view JSX)

**Interfaces:**
- Consumes: `RingGauge` from `@/components/floating/ring-gauge` (Task 1).
- Produces: Floating window with drag region, X close button, two-row layout, GPU memory tile + GPU gauges.

- [ ] **Step 1: Add i18n keys**

In the EN branch of `appText` (after `floatingGpu: "GPU"` on line 89) add:

```ts
floatingGpuMemory: "GPU Memory",
floatingClose: "Close",
```

In the FR branch (after `floatingGpu: "GPU"` on line 114) add:

```ts
floatingGpuMemory: "Memoire GPU",
floatingClose: "Fermer",
```

- [ ] **Step 2: Add the `getCurrentWindow` import**

At the top of `src/App.tsx`, add to the dynamic-import usage — import `getCurrentWindow` lazily inside a handler:

```ts
const { getCurrentWindow } = await import("@tauri-apps/api/window");
```

- [ ] **Step 3: Replace the floating view JSX (lines 226-245)**

Replace the current `if (floatingView) { return (...) }` block with:

```tsx
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
```

- [ ] **Step 4: Add the `X` icon import**

Update the lucide-react import on line 2 to include `X`:

```ts
import { Cpu, MemoryStick, MonitorSmartphone, X } from "lucide-react";
```

- [ ] **Step 5: Verify TypeScript + build**

Run: `npm run build`
Expected: tsc passes, vite bundles. Layout is `grid-cols-3`: row 1 = CPU / Memory / GPU numbers, row 2 = GPU Memory gauge + GPU usage gauge (two tiles, third cell empty); X button absolutely positioned top-right. Verify with the mock source in dev if desired: `npm run dev` → browser shows `?view=floating` render path (gauges render, drag region inert in browser).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: draggable floating window with close button and GPU gauges"
```

---

### Task 3: Enlarge the floating window in Rust

**Files:**
- Modify: `src-tauri/src/lib.rs:80` (`inner_size(320.0, 170.0)` inside `apply_floating_window`)

**Interfaces:**
- Consumes: nothing new.
- Produces: Floating `WebviewWindow` sized 400×220 so the two-row layout fits.

- [ ] **Step 1: Change the window size**

In `apply_floating_window` (line 80), replace:

```rust
.inner_size(320.0, 170.0)
```

with:

```rust
.inner_size(400.0, 220.0)
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles clean (note: `cargo check` is the fast gate; full `npm run tauri build` happens in Task 4).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: enlarge floating window for GPU gauge layout"
```

---

### Task 4: Add « Show floating window » tray menu item

**Files:**
- Modify: `src-tauri/src/lib.rs:110-156` (`setup_tray`)

**Interfaces:**
- Consumes: existing `"floating"` webview window label.
- Produces: New tray menu item `"show_floating"` whose handler calls `show()` (and `set_focus()`) on the `"floating"` window. Re-shows the window after the X hid it.

- [ ] **Step 1: Add the menu item and handler**

In `setup_tray`, after the `show_item`/`quit_item` creation (line 111-114), add:

```rust
let show_floating_item =
    MenuItem::with_id(app, "show_floating", "Afficher la fenêtre flottante", true, None::<&str>)
        .map_err(|e| format!("Création du menu tray impossible: {e}"))?;
```

Update the `Menu::with_items` call (line 116) to include the new item:

```rust
let menu = Menu::with_items(app, &[&show_item, &show_floating_item, &quit_item])
    .map_err(|e| format!("Création du menu tray impossible: {e}"))?;
```

In the `on_menu_event` closure (line 127), after the `"show"` arm, add:

```rust
"show_floating" => {
    if let Some(window) = app.get_webview_window("floating") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add tray item to show floating window"
```

---

### Task 5: Full build, reinstall, and manual verification

**Files:**
- No code changes.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: Reinstalled app with verified behavior.

- [ ] **Step 1: Full production build**

Run: `npm run tauri build`
Expected: tsc + vite succeed, Rust release build succeeds, NSIS installer produced at `src-tauri/target/release/bundle/nsis/syspulse_0.1.0_x64-setup.exe`.

- [ ] **Step 2: Reinstall**

Stop the running app, then install silently:

```powershell
Get-Process syspulse -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-Process -FilePath "C:\Users\vaism\Documents\projets\syspulse\src-tauri\target\release\bundle\nsis\syspulse_0.1.0_x64-setup.exe" -ArgumentList "/S" -Wait
Start-Process -FilePath "C:\Users\vaism\AppData\Local\syspulse\syspulse.exe"
```

- [ ] **Step 3: Verify runtime behavior**

Confirm all of:
1. Floating window renders the two-row layout with the GPU memory and GPU ring gauges.
2. Click-drag anywhere on the floating window moves it (whole window).
3. Clicking X hides the window; `settings.json` still has `"floatingSystemInformationWindow": true`.
4. Tray menu shows « Afficher la fenêtre flottante »; clicking it re-shows the floating window.
5. GPU gauges update with live stats (values change over time).
6. If this machine has no NVIDIA GPU, the GPU memory tile shows `—` (gauge hidden) — acceptable per spec.

- [ ] **Step 4: Commit any leftover state**

Run: `git status` — if clean, no action. If the async-command fix from prior work is uncommitted, commit it separately first.

```bash
git add -A
git commit -m "chore: final floating window verification state"
```
