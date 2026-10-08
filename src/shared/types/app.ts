export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  isDev: boolean;
  electron: string;
  chromium: string;
  paths: {
    userData: string;
    config: string;
    sessions: string;
    logs: string;
  };
  /** Whether "start with Windows" can be honoured on this platform/build. */
  loginItemSupported: boolean;
}

export interface ProcessMetric {
  pid: number;
  type: string;
  /** Instance id when the process belongs to a service view. */
  instanceId: string | null;
  label: string;
  /** Private working set in KB (Windows/Linux), resident set on macOS. */
  memoryKb: number;
  cpuPercent: number;
}

export interface MetricsSnapshot {
  takenAt: number;
  totalMemoryKb: number;
  totalCpuPercent: number;
  activeServices: number;
  processes: ProcessMetric[];
}

export type UpdateState =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'idle'; lastChecked: number | null }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
