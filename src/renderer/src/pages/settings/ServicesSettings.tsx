import { useState } from 'react';
import { getServiceDefinition } from '@integrations/index';
import type { ServiceInstance } from '@shared/types/service';
import { ServiceAvatar } from '../../components/ServiceAvatar';
import { SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { ArrowDownIcon, ArrowUpIcon, GripIcon, PlusIcon } from '../../components/icons';
import { useDragReorder } from '../../hooks/useDragReorder';
import { api } from '../../services/api';
import { actions, selectServices, useApp } from '../../stores/app-store';

type DragProps = ReturnType<ReturnType<typeof useDragReorder>['itemProps']>;

function ServiceRow({ instance, index, count, dragProps, dragClass }: {
  instance: ServiceInstance;
  index: number;
  count: number;
  dragProps: DragProps;
  dragClass: string;
}) {
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
  const status = !instance.enabled ? 'Disabled' : runtime?.status === 'idle' || !runtime ? 'Not loaded' : runtime.status === 'ready' ? 'Running' : runtime.status === 'suspended' ? 'Sleeping' : runtime.status;

  return (
    <div className={`service-row${dragClass}`} {...dragProps}>
      <span className="service-row__grip" title="Drag to reorder"><GripIcon size={16} /></span>
      <ServiceAvatar definition={def} favicon={runtime?.favicon} size={36} dimmed={!instance.enabled} />
      <div className="service-row__main">
        <div className="service-row__title">{def.name}<span className={`status status--${runtime?.status ?? 'idle'}`}>{status}</span></div>
        <input className="inline-input" value={label} maxLength={40} aria-label="Account name" draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      </div>
      <div className="service-row__actions">
        <div className="service-row__order">
          <button className="icon-btn" title="Move up" disabled={index === 0} onClick={() => void api.invoke('services:move', instance.id, -1)}><ArrowUpIcon size={14} /></button>
          <button className="icon-btn" title="Move down" disabled={index === count - 1} onClick={() => void api.invoke('services:move', instance.id, 1)}><ArrowDownIcon size={14} /></button>
        </div>
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
  const [message, setMessage] = useState<string | null>(null);
  const { itemProps, indicator } = useDragReorder(services.map((s) => s.id), (ids) => void actions.reorder(ids));
  const types = [...new Set(services.map((s) => s.type))];

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };
  const runImport = async () => {
    try {
      const result = await api.invoke('services:import');
      if (result) flash(`Imported ${result.added} account${result.added === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped} already added or unknown` : ''}. Sign in to each one when you open it.`);
    } catch {
      flash('That file isn’t an AIO Messenger service list.');
    }
  };
  const runExport = async () => {
    if (await api.invoke('services:export')) flash('Service list exported.');
  };

  return (
    <>
      <SettingGroup
        title={`Connected services (${services.length})`}
        note="This is the sidebar order. Drag rows (or services in the sidebar) to reorder, or use the arrows; Alt+↑/↓ also works on a focused sidebar icon. Disabling a service unloads it and frees its memory; you stay signed in."
      >
        {services.map((s, i) => (
          <ServiceRow key={s.id} instance={s} index={i} count={services.length} dragProps={itemProps(s.id)} dragClass={indicator(s.id)} />
        ))}
        <div className="setting-row">
          <button className="btn" onClick={() => actions.openAddService()}><PlusIcon size={16} /> Add a service</button>
        </div>
      </SettingGroup>

      {types.length > 0 && (
        <SettingGroup title="Add another account" note="Each account has its own isolated sign-in. Switch between accounts of the same service from the title bar.">
          <div className="chip-row">
            {types.map((type) => {
              const def = getServiceDefinition(type);
              if (!def || !def.capabilities.multipleAccounts) return null;
              return (
                <button key={type} className="btn btn--small" onClick={() => actions.openAddService(type)}>
                  <ServiceAvatar definition={def} size={18} /> {def.name}
                </button>
              );
            })}
          </div>
        </SettingGroup>
      )}

      <SettingGroup title="Backup" note={message ?? 'Exports which services and accounts you use, their names, order and notification choices. Never includes sign-ins, cookies or messages.'}>
        <SettingRow title="Export service list" description="Save to a file to set up another PC.">
          <button className="btn" disabled={services.length === 0} onClick={() => void runExport()}>Export…</button>
        </SettingRow>
        <SettingRow title="Import service list" description="Adds the accounts from a file; they start signed out.">
          <button className="btn" onClick={() => void runImport()}>Import…</button>
        </SettingRow>
      </SettingGroup>
    </>
  );
}
