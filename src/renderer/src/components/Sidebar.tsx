import type { DragEvent, KeyboardEvent } from 'react';
import { getServiceDefinition } from '@integrations/index';
import type { ServiceInstance } from '@shared/types/service';
import { api } from '../services/api';
import { actions, selectServices, useApp } from '../stores/app-store';
import { usePrefersDark } from '../hooks/useAppearance';
import { useDragReorder } from '../hooks/useDragReorder';
import { ServiceAvatar } from './ServiceAvatar';
import { BellIcon, BellOffIcon, HomeIcon, MoonIcon, PlusIcon, SettingsIcon, SidebarIcon, SunIcon } from './icons';

const AVATAR_SIZE = { small: 30, medium: 36, large: 42 } as const;

function formatCount(n: number): string {
  return n > 99 ? '99+' : String(n);
}

interface DragProps {
  draggable: boolean;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

function SidebarItem({ instance, index, showLabelBadge, dragProps, dragClass }: {
  instance: ServiceInstance;
  index: number;
  showLabelBadge: boolean;
  dragProps: DragProps;
  dragClass: string;
}) {
  const definition = getServiceDefinition(instance.type);
  const runtime = useApp((s) => s.runtime[instance.id]);
  const active = useApp((s) => s.config?.ui.view === 'service' && s.config.ui.activeInstanceId === instance.id && !s.settingsSection);
  const iconSize = useApp((s) => s.config?.settings.appearance.iconSize ?? 'medium');
  if (!definition) return null;

  const unread = runtime?.unread ?? 0;
  const problem = runtime?.status === 'error' || runtime?.status === 'crashed';
  const muted = !instance.notifications.enabled;
  const shortcut = index < 9 ? ` (Ctrl+${index + 1})` : '';
  const tooltip = `${definition.name} – ${instance.label}${shortcut}${unread ? `\n${unread} unread` : ''}${problem ? '\nNeeds attention' : ''}`;

  return (
    <button
      {...dragProps}
      className={`side-item${active ? ' is-active' : ''}${!instance.enabled ? ' is-disabled' : ''}${dragClass}`}
      title={tooltip}
      onClick={() => void actions.activate(instance.id)}
      onKeyDown={(e: KeyboardEvent) => {
        // Alt+Up/Down reorders without a mouse.
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          void api.invoke('services:move', instance.id, e.key === 'ArrowUp' ? -1 : 1);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        void api.invoke('menu:service-context', instance.id);
      }}
    >
      <span className="side-item__pill" />
      <span className="side-item__icon">
        <ServiceAvatar definition={definition} favicon={runtime?.favicon} size={AVATAR_SIZE[iconSize]} dimmed={!instance.enabled} />
        {problem ? (
          <span className="badge badge--alert">!</span>
        ) : unread > 0 ? (
          <span className={`badge${muted ? ' badge--muted' : ''}`}>{formatCount(unread)}</span>
        ) : runtime?.hasActivity ? (
          <span className="badge badge--dot" />
        ) : null}
        {showLabelBadge && <span className="side-item__account">{instance.label.slice(0, 1).toUpperCase()}</span>}
      </span>
      <span className="side-item__text">
        <span className="side-item__name">{definition.name}</span>
        <span className="side-item__label">{instance.label}</span>
      </span>
      {unread > 0 && <span className="side-item__count">{formatCount(unread)}</span>}
    </button>
  );
}

export function Sidebar() {
  const services = useApp(selectServices);
  const homeActive = useApp((s) => s.config?.ui.view === 'dashboard' && !s.settingsSection);
  const settingsActive = useApp((s) => s.settingsSection !== null);
  const notificationsOn = useApp((s) => s.config?.settings.notifications.enabled ?? true);
  const theme = useApp((s) => s.config?.settings.appearance.theme ?? 'system');
  const dark = usePrefersDark();
  const { itemProps, indicator } = useDragReorder(
    services.map((s) => s.id),
    (ids) => void actions.reorder(ids),
  );

  // Only show account initials when a service type has more than one account.
  const typeCounts = new Map<string, number>();
  for (const s of services) typeCounts.set(s.type, (typeCounts.get(s.type) ?? 0) + 1);

  return (
    <nav className="sidebar" aria-label="Services">
      <button className={`side-item side-item--plain${homeActive ? ' is-active' : ''}`} title="Home (Ctrl+Shift+H)" onClick={() => void actions.showDashboard()}>
        <span className="side-item__pill" />
        <span className="side-item__icon side-item__glyph"><HomeIcon /></span>
        <span className="side-item__text"><span className="side-item__name">Home</span></span>
      </button>
      <div className="sidebar__divider" />

      <div className="sidebar__list">
        {services.map((instance, index) => (
          <SidebarItem
            key={instance.id}
            instance={instance}
            index={index}
            showLabelBadge={(typeCounts.get(instance.type) ?? 0) > 1}
            dragProps={itemProps(instance.id)}
            dragClass={indicator(instance.id)}
          />
        ))}
        <button className="side-item side-item--plain side-item--add" title="Add a service" onClick={() => actions.openAddService()}>
          <span className="side-item__pill" />
          <span className="side-item__icon side-item__glyph side-item__glyph--dashed"><PlusIcon /></span>
          <span className="side-item__text"><span className="side-item__name">Add service</span></span>
        </button>
      </div>

      <div className="sidebar__footer">
        <button
          className={`footer-btn${notificationsOn ? '' : ' is-on'}`}
          title={notificationsOn ? 'Mute all notifications (Ctrl+Shift+M)' : 'Notifications muted – click to unmute (Ctrl+Shift+M)'}
          onClick={() => void actions.updateSettings({ notifications: { enabled: !notificationsOn } })}
        >
          {notificationsOn ? <BellIcon /> : <BellOffIcon />}
        </button>
        <button
          className="footer-btn"
          title={`Theme: ${theme} (click to switch to ${dark ? 'light' : 'dark'})`}
          onClick={() => void actions.updateSettings({ appearance: { theme: dark ? 'light' : 'dark' } })}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="footer-btn" title="Collapse/expand sidebar (Ctrl+B)" onClick={() => void actions.toggleSidebar()}>
          <SidebarIcon />
        </button>
        <button className={`footer-btn${settingsActive ? ' is-active' : ''}`} title="Settings (Ctrl+,)" onClick={() => (settingsActive ? actions.closeSettings() : actions.openSettings())}>
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}
