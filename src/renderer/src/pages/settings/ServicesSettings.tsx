import { useState } from 'react';
import { getServiceDefinition } from '@integrations/index';
import type { ServiceInstance } from '@shared/types/service';
import { ServiceAvatar } from '../../components/ServiceAvatar';
import { SettingGroup, Toggle } from '../../components/controls';
import { PlusIcon } from '../../components/icons';
import { api } from '../../services/api';
import { actions, selectServices, useApp } from '../../stores/app-store';

function ServiceRow({ instance }: { instance: ServiceInstance }) {
  const def = getServiceDefinition(instance.type);
  const runtime = useApp((s) => s.runtime[instance.id]);
  const isDev = useApp((s) => s.info?.isDev ?? false);
  const [label, setLabel] = useState(instance.label);
  if (!def) return null;

  const commitLabel = () => {
    const next = label.trim();
    if (next && next !== instance.label) void api.invoke('services:update', instance.id, { label: next });
    else setLabel(instance.label);
  };
  const status = !instance.enabled ? 'Disabled' : runtime?.status === 'idle' || !runtime ? 'Not loaded' : runtime.status === 'ready' ? 'Running' : runtime.status;

  return (
    <div className="service-row">
      <ServiceAvatar definition={def} favicon={runtime?.favicon} size={36} dimmed={!instance.enabled} />
      <div className="service-row__main">
        <div className="service-row__title">{def.name}<span className={`status status--${runtime?.status ?? 'idle'}`}>{status}</span></div>
        <input className="inline-input" value={label} maxLength={40} aria-label="Account name"
          onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      </div>
      <div className="service-row__actions">
        <Toggle label={`Enable ${def.name}`} checked={instance.enabled} onChange={(v) => void api.invoke('services:update', instance.id, { enabled: v })} />
        <button className="btn btn--small" onClick={() => void api.invoke('privacy:logout', instance.id)}>Log out</button>
        {isDev && <button className="btn btn--small" onClick={() => void api.invoke('view:open-devtools', instance.id)}>DevTools</button>}
        <button className="btn btn--small btn--danger" onClick={() => void api.invoke('services:remove', instance.id)}>Remove</button>
      </div>
    </div>
  );
}

export function ServicesSettings() {
  const services = useApp(selectServices);
  return (
    <SettingGroup
      title={`Connected services (${services.length})`}
      note="Disabling a service unloads it completely and frees its memory; you stay signed in. Drag-to-reorder arrives in Phase 2; for now the sidebar order is the order you added them."
    >
      {services.map((s) => <ServiceRow key={s.id} instance={s} />)}
      <div className="setting-row">
        <button className="btn" onClick={() => actions.openOverlay('add-service')}><PlusIcon size={16} /> Add a service</button>
      </div>
    </SettingGroup>
  );
}
