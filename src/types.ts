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
}

export interface SystemStats {
  cpuUsage: number;
  cpuPerCore: number[];
  cpuName: string;
  cpuTemperatureC: number | null;
  cpuPowerW: number | null;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  swapUsedBytes: number;
  swapTotalBytes: number;
  gpus: GpuInfo[];
  processes: ProcessInfo[];
  timestampMs: number;
}
