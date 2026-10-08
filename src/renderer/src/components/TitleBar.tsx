import { getServiceDefinition } from '@integrations/index';
import { api } from '../services/api';
import { actions, useApp } from '../stores/app-store';
import { BackIcon, ForwardIcon, GlobeIcon, HomeIcon, ReloadIcon, SearchIcon } from './icons';

/** Custom title bar. The native caption buttons are drawn by Windows to the right. */
export function TitleBar() {
  const view = useApp((s) => (s.settingsSection ? 'settings' : s.config?.ui.view ?? 'dashboard'));
  const activeId = useApp((s) => s.config?.ui.activeInstanceId ?? null);
  const instance = useApp((s) => s.config?.services.find((x) => x.id === activeId) ?? null);
  const runtime = useApp((s) => (activeId ? s.runtime[activeId] : undefined));
  const definition = instance ? getServiceDefinition(instance.type) : undefined;

  const onService = view === 'service' && instance && definition;

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <img src="./icon.png" alt="" width={18} height={18} draggable={false} />
        <span>AIO Messenger</span>
      </div>

      <div className="titlebar__context">
        {onService ? (
          <>
            <div className="titlebar__nav no-drag">
              <button className="icon-btn" title="Back (Alt+Left)" disabled={!runtime?.canGoBack} onClick={() => void api.invoke('view:navigate', instance.id, 'back')}>
                <BackIcon size={16} />
              </button>
              <button className="icon-btn" title="Forward (Alt+Right)" disabled={!runtime?.canGoForward} onClick={() => void api.invoke('view:navigate', instance.id, 'forward')}>
                <ForwardIcon size={16} />
              </button>
              <button className="icon-btn" title="Reload (Ctrl+R)" onClick={() => void api.invoke('view:reload', instance.id)}>
                <ReloadIcon size={15} className={runtime?.status === 'loading' ? 'spin' : undefined} />
              </button>
            </div>
            <div className="titlebar__title">
              <strong>{definition.name}</strong>
              <span className="muted">{instance.label}</span>
              {runtime?.offsiteHost && (
                <button className="chip chip--warn no-drag" title={`Return to ${definition.name}`} onClick={() => void api.invoke('view:navigate', instance.id, 'home')}>
                  <GlobeIcon size={13} /> {runtime.offsiteHost} · Back to {definition.name}
                </button>
              )}
              {runtime?.status === 'unresponsive' && <span className="chip chip--warn">Not responding</span>}
            </div>
          </>
        ) : (
          <div className="titlebar__title">
            {view === 'settings' ? <strong>Settings</strong> : (<><HomeIcon size={15} /><strong>Home</strong></>)}
          </div>
        )}
      </div>

      <button className="titlebar__search no-drag" onClick={() => actions.openOverlay('search')}>
        <SearchIcon size={14} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="titlebar__controls-space" />
    </header>
  );
}
