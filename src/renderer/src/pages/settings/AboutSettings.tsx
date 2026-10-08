import { useEffect, useState } from 'react';
import type { UpdateState } from '@shared/types/app';
import { SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { api } from '../../services/api';
import { actions, useApp } from '../../stores/app-store';

function describe(state: UpdateState | null): string {
  if (!state) return 'Checking…';
  switch (state.kind) {
    case 'unsupported': return state.reason;
    case 'idle': return state.lastChecked ? `Up to date (checked ${new Date(state.lastChecked).toLocaleTimeString()})` : 'Not checked yet';
    case 'checking': return 'Checking for updates…';
    case 'available': return `Version ${state.version} is available`;
    case 'downloading': return `Downloading… ${state.percent.toFixed(0)}%`;
    case 'ready': return `Version ${state.version} is ready. It installs when you restart or quit.`;
    case 'error': return state.message;
  }
}

function UpdateAction({ state, onState }: { state: UpdateState | null; onState: (s: UpdateState) => void }) {
  if (state?.kind === 'available') return <button className="btn btn--primary" onClick={() => void api.invoke('updater:download')}>Download</button>;
  if (state?.kind === 'ready') return <button className="btn btn--primary" onClick={() => void api.invoke('updater:install')}>Restart and update</button>;
  const busy = !state || state.kind === 'unsupported' || state.kind === 'checking' || state.kind === 'downloading';
  return <button className="btn" disabled={busy} onClick={() => void api.invoke('updater:check').then(onState)}>Check now</button>;
}

export function AboutSettings() {
  const info = useApp((s) => s.info);
  const autoCheck = useApp((s) => s.config?.settings.general.checkForUpdates ?? true);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  useEffect(() => {
    void api.invoke('updater:get-state').then(setUpdate);
    return api.on('updater:state', setUpdate);
  }, []);

  return (
    <>
      <SettingGroup>
        <div className="about">
          <img src="./icon.png" alt="" width={56} height={56} />
          <div>
            <h3>AIO Messenger {info?.version}</h3>
            <p className="muted">
              {info?.platform}-{info?.arch} · Electron {info?.electron} · Chromium {info?.chromium}{info?.isDev ? ' · development build' : ''}
            </p>
          </div>
        </div>
      </SettingGroup>
      <SettingGroup title="Updates">
        <SettingRow title="Version" description={describe(update)}>
          <UpdateAction state={update} onState={setUpdate} />
        </SettingRow>
        <SettingRow title="Check for updates automatically" description="At startup and every 6 hours. Updates download only when you choose." disabled={update?.kind === 'unsupported'}>
          <Toggle label="Check for updates automatically" checked={autoCheck} disabled={update?.kind === 'unsupported'} onChange={(v) => void actions.updateSettings({ general: { checkForUpdates: v } })} />
        </SettingRow>
      </SettingGroup>
    </>
  );
}
