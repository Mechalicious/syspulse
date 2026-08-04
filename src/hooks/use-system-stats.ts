import { useEffect, useRef, useState } from "react";
import type { SystemStats } from "@/types";

const MOCK_PROCESS_NAMES = [
  "chrome.exe",
  "node.exe",
  "rustc.exe",
  "Discord.exe",
  "explorer.exe",
  "Code.exe",
  "svchost.exe",
  "steam.exe",
  "obsidian.exe",
  "spotify.exe",
  "dwm.exe",
  "Slack.exe",
];

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function randomWalk(prev: number, spread: number): number {
  const next = prev + (Math.random() - 0.5) * spread;
  return Math.min(100, Math.max(0, next));
}

function mockStats(prev: SystemStats | null): SystemStats {
  const cpuPerCore = (prev?.cpuPerCore.length ? prev.cpuPerCore : Array(8).fill(20)).map((v) =>
    randomWalk(v, 30),
  );
  const cpuUsage = cpuPerCore.reduce((a, b) => a + b, 0) / cpuPerCore.length;
  const memoryTotalBytes = 32 * 1024 ** 3;
  const memoryUsedBytes = Math.round(
    randomWalk(((prev?.memoryUsedBytes ?? memoryTotalBytes * 0.4) / memoryTotalBytes) * 100, 4) *
      0.01 *
      memoryTotalBytes,
  );

  const processes = MOCK_PROCESS_NAMES.map((name, i) => ({
    pid: 1000 + i,
    name,
    cpuUsage: Math.max(0, randomWalk(prev?.processes[i]?.cpuUsage ?? Math.random() * 20, 10)),
    memoryBytes: Math.max(
      10 * 1024 * 1024,
      Math.round(
        randomWalk(((prev?.processes[i]?.memoryBytes ?? Math.random() * 1e9) / 4e9) * 100, 5) *
          0.01 *
          4e9,
      ),
    ),
  })).sort((a, b) => b.memoryBytes - a.memoryBytes);

  return {
    cpuUsage,
    cpuPerCore,
    cpuName: "CPU (données simulées — hors environnement Tauri)",
    cpuTemperatureC: Math.round(randomWalk(prev?.cpuTemperatureC ?? 62, 3)),
    cpuPowerW: Math.round(randomWalk(prev?.cpuPowerW ?? 58, 10)),
    memoryUsedBytes,
    memoryTotalBytes,
    swapUsedBytes: Math.round(memoryTotalBytes * 0.02),
    swapTotalBytes: Math.round(memoryTotalBytes * 0.25),
    gpus: [
      {
        name: "GPU (simulé)",
        usagePercent: randomWalk(prev?.gpus[0]?.usagePercent ?? 15, 25),
        memoryUsedMb: Math.round(randomWalk(((prev?.gpus[0]?.memoryUsedMb ?? 2000) / 8192) * 100, 5) * 0.01 * 8192),
        memoryTotalMb: 8192,
        temperatureC: Math.round(randomWalk(prev?.gpus[0]?.temperatureC ?? 55, 4)),
        powerW: Math.round(randomWalk(prev?.gpus[0]?.powerW ?? 85, 12)),
      },
    ],
    processes,
    timestampMs: Date.now(),
  };
}

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [source, setSource] = useState<"live" | "mock">("live");
  const statsRef = useRef<SystemStats | null>(null);
  statsRef.current = stats;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let interval: number | undefined;

    async function subscribe() {
      if (isTauriRuntime()) {
        try {
          const { listen } = await import("@tauri-apps/api/event");
          unlisten = await listen<SystemStats>("system-stats", (event) => {
            if (!cancelled) setStats(event.payload);
          });
          setSource("live");
          return;
        } catch {
          // Fall through to mock mode below.
        }
      }

      setSource("mock");
      setStats((prev) => mockStats(prev));
      interval = window.setInterval(() => {
        setStats((prev) => mockStats(prev));
      }, 1500);
    }

    void subscribe();

    return () => {
      cancelled = true;
      unlisten?.();
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return { stats, source };
}
