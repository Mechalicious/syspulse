export interface ProcessInfo {
  pid: number;
  name: string;
  cpuUsage: number;
  memoryBytes: number;
}

export interface GpuInfo {
  name: string;
  usagePercent: number;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureC: number | null;
  powerW: number | null;
  clockMhz: number | null;
  voltageV: number | null;
}

export interface NetworkInfo {
  downloadBps: number;
  uploadBps: number;
}

export interface FanInfo {
  name: string;
  source: string;
  speedPercent: number | null;
  speedRpm: number | null;
}

export type AppLanguage = "fr" | "en";
export type TemperatureDisplay = "celsius" | "fahrenheit";
export type ThemeMode = "dark" | "light";

export interface AppSettings {
  autoRunOnBoot: boolean;
  hideOnSystemTrayWhenAutoRunOnBoot: boolean;
  minimizeAppToSystemTrayAtClose: boolean;
  floatingSystemInformationWindow: boolean;
  language: AppLanguage;
  temperatureDisplay: TemperatureDisplay;
  theme: ThemeMode;
}

export interface SystemStats {
  cpuUsage: number;
  cpuPerCore: number[];
  cpuPerPhysicalCoreEstimated: number[] | null;
  cpuName: string;
  cpuPhysicalCores: number | null;
  cpuTemperatureC: number | null;
  cpuPowerW: number | null;
  cpuClockMhz: number | null;
  cpuVoltageV: number | null;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  swapUsedBytes: number;
  swapTotalBytes: number;
  network: NetworkInfo;
  fans: FanInfo[];
  gpus: GpuInfo[];
  processes: ProcessInfo[];
  timestampMs: number;
}
