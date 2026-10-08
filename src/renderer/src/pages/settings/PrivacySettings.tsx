import { getServiceDefinition } from '@integrations/index';
import { SettingGroup, SettingRow } from '../../components/controls';
import { api } from '../../services/api';
import { selectServices, useApp } from '../../stores/app-store';
import { useState } from 'react';

export function PrivacySettings() {
  const info = useApp((s) => s.info);
  const services = useApp(selectServices);
  const [cleared, setCleared] = useState<string | null>(null);

  const clearCache = async (id: string | null, label: string) => {
    await api.invoke('privacy:clear-cache', id);
    setCleared(label);
    setTimeout(() => setCleared(null), 2500);
  };

  return (
    <>
      <SettingGroup title="Your data stays on this PC">
        <div className="prose">
          <p>AIO Messenger has no servers. Messages, sign-ins and settings never leave your computer except to talk directly to the services you add. There is no analytics or telemetry.</p>
          <p>The app never sees or stores your passwords: you sign in on each service’s own page, and the service’s cookies are kept in that account’s private, isolated browser profile. On Windows, Chromium encrypts those cookies with your Windows account (DPAPI).</p>
        </div>
      </SettingGroup>

      <SettingGroup title="Where data is stored">
        <SettingRow title="Settings" description={<code>{info?.paths.config}</code>}><span /></SettingRow>
        <SettingRow title="Service sessions (one folder per account)" description={<code>{info?.paths.sessions}</code>}><span /></SettingRow>
        <SettingRow title="Logs (no message content)" description={<code>{info?.paths.logs}</code>}><span /></SettingRow>
        <SettingRow title="Open the data folder">
          <button className="btn" onClick={() => void api.invoke('app:open-data-folder')}>Open folder</button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Per service">
        {services.length === 0 && <div className="setting-row"><span className="muted">No services added yet.</span></div>}
        {services.map((inst) => {
          const def = getServiceDefinition(inst.type);
          if (!def) return null;
          const name = `${def.name} · ${inst.label}`;
          return (
            <SettingRow key={inst.id} title={name}>
              <button className="btn btn--small" onClick={() => void clearCache(inst.id, name)}>Clear cache</button>
              <button className="btn btn--small" onClick={() => void api.invoke('privacy:logout', inst.id)}>Log out</button>
            </SettingRow>
          );
        })}
      </SettingGroup>

      <SettingGroup title="Everything" note={cleared ? `Cache cleared for ${cleared}.` : undefined}>
        <SettingRow title="Clear cache for all services" description="Frees disk space. You stay signed in.">
          <button className="btn" onClick={() => void clearCache(null, 'all services')}>Clear cache</button>
        </SettingRow>
        <SettingRow title="Clear all application data" description="Signs out of every account, removes all services and settings, and restarts the app.">
          <button className="btn btn--danger" onClick={() => void api.invoke('privacy:clear-all')}>Clear everything…</button>
        </SettingRow>
      </SettingGroup>
    </>
  );
}
