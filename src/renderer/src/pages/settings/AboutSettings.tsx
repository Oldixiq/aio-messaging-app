import { useEffect, useState } from 'react';
import type { UpdateState } from '@shared/types/app';
import { SettingGroup, SettingRow } from '../../components/controls';
import { api } from '../../services/api';
import { useApp } from '../../stores/app-store';

function describe(state: UpdateState | null): string {
  if (!state) return 'Checking…';
  switch (state.kind) {
    case 'unsupported': return state.reason;
    case 'idle': return state.lastChecked ? `Up to date (checked ${new Date(state.lastChecked).toLocaleTimeString()})` : 'Not checked yet';
    case 'checking': return 'Checking for updates…';
    case 'available': return `Version ${state.version} is available`;
    case 'downloading': return `Downloading… ${state.percent.toFixed(0)}%`;
    case 'ready': return `Version ${state.version} will install on restart`;
    case 'error': return state.message;
  }
}

export function AboutSettings() {
  const info = useApp((s) => s.info);
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
        <SettingRow title="Automatic updates" description={describe(update)}>
          <button className="btn" disabled={!update || update.kind === 'unsupported' || update.kind === 'checking'} onClick={() => void api.invoke('updater:check').then(setUpdate)}>
            Check now
          </button>
        </SettingRow>
      </SettingGroup>
    </>
  );
}
