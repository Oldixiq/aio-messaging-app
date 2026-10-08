import { app } from 'electron';
import type { MetricsSnapshot, ProcessMetric } from '@shared/types/app';

const TYPE_LABELS: Record<string, string> = {
  Browser: 'Main process',
  GPU: 'GPU',
  Utility: 'Utility (network, audio…)',
  Zygote: 'Zygote',
  'Sandbox helper': 'Sandbox helper',
  Tab: 'Renderer',
};

/** Real per-process numbers from Chromium, attributed to services where possible. */
export function collectMetrics(opts: {
  processToInstance: Map<number, string>;
  instanceLabel: (id: string) => string;
  shellPid: number | null;
  activeServices: number;
}): MetricsSnapshot {
  const processes: ProcessMetric[] = app.getAppMetrics().map((m) => {
    const instanceId = opts.processToInstance.get(m.pid) ?? null;
    const label = instanceId
      ? opts.instanceLabel(instanceId)
      : m.pid === opts.shellPid
        ? 'App interface'
        : TYPE_LABELS[m.type] ?? m.type;
    // privateBytes is Windows-only; workingSetSize is available everywhere.
    const memoryKb = m.memory.privateBytes ?? m.memory.workingSetSize;
    return { pid: m.pid, type: m.type, instanceId, label, memoryKb, cpuPercent: m.cpu.percentCPUUsage };
  });
  return {
    takenAt: Date.now(),
    totalMemoryKb: processes.reduce((sum, p) => sum + p.memoryKb, 0),
    totalCpuPercent: processes.reduce((sum, p) => sum + p.cpuPercent, 0),
    activeServices: opts.activeServices,
    processes: processes.sort((a, b) => b.memoryKb - a.memoryKb),
  };
}
