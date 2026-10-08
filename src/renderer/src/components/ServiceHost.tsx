import { getServiceDefinition } from '@integrations/index';
import { api } from '../services/api';
import { useApp } from '../stores/app-store';
import { ServiceAvatar } from './ServiceAvatar';
import { AlertIcon, ReloadIcon } from './icons';

/**
 * Shell-side UI for the active service: what you see while the page loads,
 * fails or crashes. The page itself is a native view the main process places
 * on top of this element; it is hidden whenever this UI needs to show.
 */
export function ServiceHost() {
  const activeId = useApp((s) => s.config?.ui.activeInstanceId ?? null);
  const instance = useApp((s) => s.config?.services.find((x) => x.id === activeId) ?? null);
  const runtime = useApp((s) => (activeId ? s.runtime[activeId] : undefined));
  const definition = instance ? getServiceDefinition(instance.type) : undefined;
  if (!instance || !definition) return null;

  const name = definition.name;
  const reload = () => void api.invoke('view:reload', instance.id);
  const status = runtime?.status ?? 'idle';

  if (status === 'crashed') {
    return (
      <div className="state-panel">
        <div className="state-panel__icon state-panel__icon--alert"><AlertIcon size={28} /></div>
        <h2>{name} crashed</h2>
        <p>The rest of the app is fine. Reloading starts {name} in a fresh process; you stay signed in.</p>
        <button className="btn btn--primary" onClick={reload}><ReloadIcon size={16} /> Reload {name}</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="state-panel">
        <div className="state-panel__icon state-panel__icon--alert"><AlertIcon size={28} /></div>
        <h2>Unable to load {name}</h2>
        <p>{describeError(runtime?.error?.code, runtime?.error?.description)}</p>
        <button className="btn btn--primary" onClick={reload}><ReloadIcon size={16} /> Retry</button>
      </div>
    );
  }

  return (
    <div className="state-panel state-panel--loading">
      <div className="pulse"><ServiceAvatar definition={definition} favicon={runtime?.favicon} size={56} /></div>
      <p className="muted">Loading {name}…</p>
    </div>
  );
}

function describeError(code: number | undefined, description: string | undefined): string {
  switch (code) {
    case -106:
      return 'You appear to be offline. Check your internet connection.';
    case -105:
    case -137:
      return 'The address could not be resolved. Check your connection or DNS settings.';
    case -7:
    case -118:
      return 'The connection timed out. The service may be temporarily unavailable.';
    case -21:
      return 'The network changed while loading.';
    default:
      return `The service did not respond as expected${description ? ` (${description})` : ''}.`;
  }
}
