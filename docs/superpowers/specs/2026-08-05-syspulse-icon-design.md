# Syspulse App Icon — Design Spec

Date: 2026-08-05

## Goal

Replace the default Tauri icon with a custom, pertinent icon matching the Syspulse system-monitoring app identity, then rebuild and reinstall.

## Concept

A heartbeat / ECG pulse line — a direct nod to the name "Syspulse" and its real-time monitoring dashboard.

## Design

- **Canvas**: 1024×1024 square, rounded corners (radius ~22%).
- **Background**: dark Flexoki gradient (`#100f0d` → `#1c1b1a`) matching the app's dark theme.
- **Grid**: 2–3 subtle horizontal grid lines (opacity ~6%) evoking dashboard charts.
- **Pulse trace**: ECG heartbeat line in Flexoki accent green (`#6f8f3f`), one beat with sharp rise/drop, rounded line caps, subtle green glow.
- **Live dot**: small amber dot (`#d1a425`) top-right, echoing the app's "Live" badge.

### Legibility

Thick pulse line (~64px stroke) stays crisp at 16/32/128/256px; dark background works on both light and dark taskbars.

## Technical Steps

1. Create `app-icon.svg` (source of truth).
2. Rasterize to PNG 1024×1024 (`@resvg/resvg-js` or Tauri CLI).
3. Generate full Tauri icon set: `npx tauri icon` → `icon.ico`, `icon.icns`, `32x32.png`, `128x128.png`, `128x128@2x.png`, Windows `Square*.png`, `StoreLogo.png`, etc.
4. Rebuild: `npm run tauri build`.
5. Reinstall via NSIS installer (per-user), replacing current install.

> **Note (tauri-build icon cache):** a plain incremental `npm run tauri build`
> may silently embed the *old* icon, because tauri-build's build script only
> re-runs on `tauri.conf.json` changes and caches `resource.rc`/`resource.lib`
> in `src-tauri/target/release/build/syspulse-*`. After changing icons, delete
> those build-script dirs (and the stale exe) before rebuilding, or the change
> won't ship.

## Out of Scope

- Code signing.
- In-app logo usage (sidebar branding etc.) — icon only.
