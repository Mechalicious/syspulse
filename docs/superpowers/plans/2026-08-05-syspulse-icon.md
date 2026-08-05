# Syspulse App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Tauri icon with a custom ECG/heartbeat icon, rebuild the app, and reinstall it.

**Architecture:** Create an SVG source icon, rasterize the full icon set with the Tauri CLI (`tauri icon`, which accepts SVG input and outputs all platform icons including ico/icns/PNG/store logos), then run the existing build + NSIS reinstall flow used previously.

**Tech Stack:** SVG, Tauri CLI v2 (`npx tauri icon`), `npm run tauri build`, NSIS installer.

## Global Constraints

- Source icon must be a **squared PNG or SVG with transparency** (per `tauri icon --help`).
- Palette is Flexoki (dark): background gradient `#100f0d` → `#1c1b1a`, ECG green `#6f8f3f`, live dot amber `#d1a425`.
- Icon concept: ECG/heartbeat pulse line, ~64px stroke, rounded caps; subtle horizontal grid lines (opacity ~0.06); amber live dot top-right.
- Do NOT change `tauri.conf.json` (icon list already correct) or app source code.
- Defender exclusions already exist for `AppData\Local\syspulse` and `src-tauri\target\release`; NSIS reinstall goes to the same per-user location.

---

### Task 1: Create the SVG source icon

**Files:**
- Create: `src-tauri/icons/app-icon.svg`

**Interfaces:**
- Consumes: nothing.
- Produces: `src-tauri/icons/app-icon.svg` — 1024×1024, transparent background, feed to `tauri icon` in Task 2.

- [ ] **Step 1: Write the SVG file**

Create `src-tauri/icons/app-icon.svg` with this content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#100f0d"/>
      <stop offset="1" stop-color="#1c1b1a"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect x="70" y="70" width="884" height="884" rx="225" fill="url(#bg)"/>

  <g stroke="#ffffff" stroke-opacity="0.06" stroke-width="4">
    <line x1="140" y1="220" x2="884" y2="220"/>
    <line x1="140" y1="512" x2="884" y2="512"/>
    <line x1="140" y1="804" x2="884" y2="804"/>
  </g>

  <circle cx="816" cy="236" r="34" fill="#d1a425" filter="url(#glow)"/>

  <path d="M 140 512 L 400 512 L 445 470 L 470 512 L 540 160 L 610 760 L 640 512 L 884 512"
        fill="none" stroke="#6f8f3f" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"
        filter="url(#glow)"/>
</svg>
```

- [ ] **Step 2: Verify the file exists and is valid XML**

Run: `Get-Content src-tauri\icons\app-icon.svg -TotalCount 3`
Expected: the first lines of the SVG. (A quick visual check is done after Task 2 via the generated PNG.)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/icons/app-icon.svg
git commit -m "feat: add syspulse ECG app icon source"
```

---

### Task 2: Generate the full icon set

**Files:**
- Modify (regenerated): all files in `src-tauri/icons/` (`icon.ico`, `icon.icns`, `icon.png`, `32x32.png`, `128x128.png`, `128x128@2x.png`, `Square*.png`, `StoreLogo.png`, etc.)

**Interfaces:**
- Consumes: `src-tauri/icons/app-icon.svg` from Task 1.
- Produces: regenerated `src-tauri/icons/` set consumed by the Tauri build (bundle step reads `tauri.conf.json` icon list).

- [ ] **Step 1: Run the Tauri icon generator**

Run: `npx tauri icon src-tauri/icons/app-icon.svg`
Expected: output listing generated icons under `src-tauri/icons/`; exit code 0. Files like `icon.ico`, `icon.icns`, `128x128@2x.png` must be re-created with today's timestamp.

- [ ] **Step 2: Verify the icon set was regenerated**

Run: `Get-ChildItem src-tauri\icons | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, LastWriteTime`
Expected: top 5 entries freshly written (timestamp = now).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/icons
git commit -m "feat: regenerate tauri icon set with syspulse ECG icon"
```

---

### Task 3: Rebuild the release bundles

**Files:**
- Modify (generated): `src-tauri/target/release/syspulse.exe`, `src-tauri/target/release/bundle/nsis/syspulse_0.1.0_x64-setup.exe`, `src-tauri/target/release/bundle/msi/syspulse_0.1.0_x64_en-US.msi`

**Interfaces:**
- Consumes: regenerated icon set from Task 2; unchanged source code.
- Produces: fresh NSIS installer at `src-tauri/target/release/bundle/nsis/syspulse_0.1.0_x64-setup.exe`.

- [ ] **Step 1: Build release bundles**

Run: `npm run tauri build`
Expected: exit code 0; final lines report the two bundles (`msi` and `nsis`); the NSIS installer timestamp is now.

- [ ] **Step 2: Verify fresh installer exists**

Run: `Get-Item src-tauri\target\release\bundle\nsis\syspulse_0.1.0_x64-setup.exe | Select-Object Length, LastWriteTime`
Expected: file exists, `LastWriteTime` = now.

---

### Task 4: Reinstall and verify

**Files:**
- Modify (system): `C:\Users\vaism\AppData\Local\syspulse\syspulse.exe` and `C:\Users\vaism\AppData\Local\syspulse\uninstall.exe` (replaced by NSIS installer)

**Interfaces:**
- Consumes: NSIS installer from Task 3.
- Produces: updated per-user install at `C:\Users\vaism\AppData\Local\syspulse\syspulse.exe`.

- [ ] **Step 1: Ensure no running instance blocks the install**

Run: `Get-Process syspulse -ErrorAction SilentlyContinue | Stop-Process -Force`

- [ ] **Step 2: Run the NSIS installer silently**

Run: `Start-Process -FilePath "C:\Users\vaism\Documents\projets\syspulse\src-tauri\target\release\bundle\nsis\syspulse_0.1.0_x64-setup.exe" -ArgumentList "/S" -Wait -PassThru | Select-Object ExitCode`
Expected: `ExitCode: 0`.

- [ ] **Step 3: Verify install and Defender status**

Run:
```powershell
Get-Item "C:\Users\vaism\AppData\Local\syspulse\syspulse.exe" | Select-Object Length, LastWriteTime
Get-MpThreat -ErrorAction SilentlyContinue | Select-Object ThreatName, IsActive
```
Expected: `syspulse.exe` present with fresh timestamp; no active threat (`IsActive: False` or empty list).

- [ ] **Step 4: Verify embedded icon changed (proof the new icon shipped)**

Run: `Add-Type -AssemblyName System.Drawing; $i = [System.Drawing.Icon]::ExtractAssociatedIcon("C:\Users\vaism\AppData\Local\syspulse\syspulse.exe"); $i.Width; $i.Height`
Expected: width/height > 0 (icon embedded; visual check by user on taskbar/Explorer).
