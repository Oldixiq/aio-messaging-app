import { useEffect, useState } from 'react';
import type { MetricsSnapshot } from '@shared/types/app';
import { PlannedTag, SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { api } from '../../services/api';
import { actions, useApp } from '../../stores/app-store';

const formatMb = (kb: number) => `${(kb / 1024).toFixed(0)} MB`;

function useMetrics(intervalMs = 2000): MetricsSnapshot | null {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => void api.invoke('metrics:get').then((m) => alive && setSnapshot(m));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return snapshot;
}

export function PerformanceSettings() {
  const perf = useApp((s) => s.config?.settings.performance);
  const metrics = useMetrics();
  if (!perf) return null;
  const set = (patch: Partial<typeof perf>) => void actions.updateSettings({ performance: patch });
  const maxMem = Math.max(1, ...(metrics?.processes.map((p) => p.memoryKb) ?? [1]));

  return (
    <>
      <div className="stat-row">
        <div className="stat"><span className="stat__label">Running services</span><span className="stat__value">{metrics?.activeServices ?? '–'}</span></div>
        <div className="stat"><span className="stat__label">Memory</span><span className="stat__value">{metrics ? formatMb(metrics.totalMemoryKb) : '–'}</span></div>
        <div className="stat"><span className="stat__label">CPU</span><span className="stat__value">{metrics ? `${metrics.totalCpuPercent.toFixed(1)}%` : '–'}</span></div>
      </div>

      <SettingGroup title="Processes" note="Live numbers from Chromium, refreshed every 2 seconds. Each service runs in its own sandboxed process; services you haven’t opened since launch use no memory.">
        <table className="proc-table">
          <thead><tr><th>Process</th><th>Memory</th><th>CPU</th></tr></thead>
          <tbody>
            {metrics?.processes.map((p) => (
              <tr key={p.pid}>
                <td>{p.label}</td>
                <td>
                  <div className="bar"><span style={{ width: `${(p.memoryKb / maxMem) * 100}%` }} /></div>
                  {formatMb(p.memoryKb)}
                </td>
                <td>{p.cpuPercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingGroup>

      <SettingGroup title="Background behavior" note="Already active: services load only when first opened, and hidden services are throttled by Chromium. Disable a service in Settings › Services to unload it completely.">
        <SettingRow title={<>Suspend inactive services <PlannedTag phase={4} /></>} description={`Unload services you haven’t used for ${perf.suspendAfterMinutes} minutes; they reload when opened.`}>
          <Toggle label="Suspend inactive services" checked={perf.suspendInactive} onChange={(v) => set({ suspendInactive: v })} />
        </SettingRow>
        <SettingRow title={<>Reduce background activity <PlannedTag phase={4} /></>} description="Lower timer and animation frequency for hidden services.">
          <Toggle label="Reduce background activity" checked={perf.reduceBackgroundActivity} onChange={(v) => set({ reduceBackgroundActivity: v })} />
        </SettingRow>
      </SettingGroup>
    </>
  );
}
