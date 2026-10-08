import { useEffect, useState } from 'react';
import { getServiceDefinition } from '@integrations/index';
import type { MetricsSnapshot } from '@shared/types/app';
import { ServiceAvatar } from '../../components/ServiceAvatar';
import { SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { api } from '../../services/api';
import { actions, selectServices, useApp } from '../../stores/app-store';

const formatMb = (kb: number) => `${(kb / 1024).toFixed(0)} MB`;
const SLEEP_AFTER = [5, 15, 30, 60, 120];

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

function ServiceUsage({ metrics }: { metrics: MetricsSnapshot | null }) {
  const services = useApp(selectServices);
  const runtime = useApp((s) => s.runtime);
  const memoryFor = (id: string) => metrics?.processes.filter((p) => p.instanceId === id).reduce((sum, p) => sum + p.memoryKb, 0) ?? 0;
  const cpuFor = (id: string) => metrics?.processes.filter((p) => p.instanceId === id).reduce((sum, p) => sum + p.cpuPercent, 0) ?? 0;

  return (
    <SettingGroup title="Services" note="“Sleeping” services are unloaded and use no memory. You stay signed in; opening one wakes it in a few seconds. Services that are playing sound (calls, voice messages) are never put to sleep automatically.">
      {services.length === 0 && <div className="setting-row"><span className="muted">No services added yet.</span></div>}
      {services.map((inst) => {
        const def = getServiceDefinition(inst.type);
        if (!def) return null;
        const status = runtime[inst.id]?.status ?? 'idle';
        const running = status !== 'idle' && status !== 'suspended';
        const label = !inst.enabled ? 'Disabled' : status === 'suspended' ? 'Sleeping' : status === 'idle' ? 'Not loaded' : `${formatMb(memoryFor(inst.id))} · ${cpuFor(inst.id).toFixed(1)}% CPU`;
        return (
          <div className="service-row" key={inst.id}>
            <ServiceAvatar definition={def} favicon={runtime[inst.id]?.favicon} size={30} dimmed={!running} />
            <div className="service-row__main">
              <div className="service-row__title">{def.name} <span className="muted">· {inst.label}</span></div>
              <div className="muted perf-usage">{label}</div>
            </div>
            <div className="service-row__actions">
              <label className="mini-toggle" title="Exclude from automatic sleeping">
                <span className="muted">Never sleep</span>
                <Toggle label={`Never sleep ${def.name}`} checked={inst.keepAwake} onChange={(v) => void api.invoke('services:update', inst.id, { keepAwake: v })} />
              </label>
              {running ? (
                <button className="btn btn--small" onClick={() => void api.invoke('view:suspend', inst.id)}>Sleep now</button>
              ) : (
                <button className="btn btn--small" disabled={!inst.enabled} onClick={() => void actions.activate(inst.id)}>Open</button>
              )}
            </div>
          </div>
        );
      })}
    </SettingGroup>
  );
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

      <SettingGroup
        title="Background behavior"
        note="Always on: services load only when first opened, and hidden services are throttled by Chromium (timers slowed, no rendering). Sleeping goes further and unloads them; sleeping services can’t notify you until opened again, so mark those you need with “Never sleep”."
      >
        <SettingRow title="Put inactive services to sleep" description="Unload services you haven’t opened for a while.">
          <select className="select" value={perf.suspendAfterMinutes} disabled={!perf.suspendInactive} onChange={(e) => set({ suspendAfterMinutes: Number(e.target.value) })}>
            {SLEEP_AFTER.map((m) => <option key={m} value={m}>after {m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select>
          <Toggle label="Suspend inactive services" checked={perf.suspendInactive} onChange={(v) => set({ suspendInactive: v })} />
        </SettingRow>
        <SettingRow title="Free memory when the PC runs low" description="When less than 10% of memory is free, put the least recently used service to sleep.">
          <Toggle label="Free memory when low" checked={perf.suspendOnLowMemory} onChange={(v) => set({ suspendOnLowMemory: v })} />
        </SettingRow>
      </SettingGroup>

      <ServiceUsage metrics={metrics} />

      <SettingGroup title="All processes" note="Live numbers from Chromium, refreshed every 2 seconds. Each service runs in its own sandboxed process.">
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
    </>
  );
}
