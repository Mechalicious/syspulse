# Syspulse Floating Window — Drag, Close, GPU Gauges Design Spec

Date: 2026-08-06

## Goal

Upgrade the floating system-information window so it is:

1. **Draggable** anywhere on its surface.
2. **Closable** via an X button (hides the window, keeps the setting ON, re-showable from the tray menu).
3. Shows **GPU memory** and **GPU usage** as compact **circular 0-100% ring gauges**.

## Current State

- Floating window is created in `src-tauri/src/lib.rs:68` (`apply_floating_window`) as a borderless `WebviewWindow` labeled `"floating"`, `always_on_top(true)`, `decorations(false)`, `resizable(false)`, size 320×170.
- Frontend floating layout lives in `src/App.tsx:226-245`: a `grid-cols-3` of number tiles (CPU / Memory / GPU usage). No drag region, no close control, no GPU memory tile.
- GPU memory data: `GpuInfo` in `src-tauri/src/system_monitor.rs:21` has `memory_used_mb` and `memory_total_mb`. NVIDIA path populates both (`read_nvidia_gpus`, lines 119-123); Windows engine fallback (`read_windows_gpu_engine`, line 307) leaves `memory_total_mb: None`.
- Tray menu is built in `setup_tray` (`lib.rs:110`) with items `show` / `quit`.
- i18n text map in `src/App.tsx` (`appText`, lines ~83-117).

## Design

### 1. Draggable (whole window)

- Add `data-tauri-drag-region="deep"` to the floating window's root container.
- Tauri's injected `drag.js` handles mousedown dragging; clickable elements (the X `<button>`) automatically block drag (`isClickableElement`, `tauri-2.11.5/src/window/scripts/drag.js:32`).
- No Rust-side change required for drag.

### 2. Close (hide only, setting stays ON)

- Add an **X button** top-right of the floating window. On click: `getCurrentWindow().hide()` via `@tauri-apps/api/window`.
- `floatingSystemInformationWindow` stays `true`.
- **Tray menu item « Show floating window »**: add a third menu item in `setup_tray` (`lib.rs:110`). Its handler calls `window.show()` (and optionally `set_focus()`) on the `"floating"` window. This is the re-show path after the user hides it.

### 3. GPU memory tile + circular gauges

- Window size: **320×170 → 400×220** (in `apply_floating_window`, `lib.rs:80`).
- Layout (two rows):
  - **Top row**: existing three tiles — CPU, Memory, GPU usage (numbers as today).
  - **Bottom row**: **GPU memory** (new tile) and **GPU usage**, each with a compact **circular ring gauge** (~48-56px diameter, 0-100%) and the percent shown in the center.
- New component: `src/components/floating/ring-gauge.tsx` — hand-rolled SVG ring (no new dependency):
  - Props: `value: number`, `size?: number`, `strokeWidth?: number`, `color?: string`, `label?: string`.
  - Background track circle + progress arc computed from `value` (0-100 clamp).
  - Accent color `var(--color-chart-3)` (same accent the dashboard GPU `UsageCard` uses).
- **GPU memory unavailable** (`memoryUsedMb == null || memoryTotalMb == null`): tile shows `—`, no gauge.
- GPU memory percent = `memoryUsedMb / memoryTotalMb * 100`.
- New i18n keys (EN/FR) for GPU memory label and close-button aria-label; existing `floatingGpu` reused for the GPU usage gauge tile.

## Technical Steps

1. Add `ring-gauge.tsx` component.
2. Rework the `floatingView` branch in `src/App.tsx`:
   - Root container gets `data-tauri-drag-region="deep"`.
   - Add X button (import `getCurrentWindow`).
   - Two-row layout with CPU + GPU memory + GPU usage gauge tiles (CPU gauge added at user's request during implementation; top-row CPU number tile remains).
   - Add i18n keys (`floatingGpuMemory`, close aria-label) to `appText` EN/FR maps.
3. `lib.rs`:
   - `apply_floating_window`: size 400×220.
   - `setup_tray`: add « Show floating window » `MenuItem`, wire handler to `app.get_webview_window("floating")` → `show()`.
4. Rebuild: `npm run tauri build`.
5. Reinstall via NSIS installer, relaunch, and verify: drag, X hide, tray re-show, gauges animate with live stats, `—` fallback.

## Out of Scope

- Dragging with a handle/grip bar (whole-window drag chosen).
- GPU gauges on the main dashboard.
- Persisting floating window position.
- Dependencies for gauges (SVG ring is hand-rolled).
