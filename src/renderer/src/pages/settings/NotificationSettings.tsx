import { getServiceDefinition } from '@integrations/index';
import { ServiceAvatar } from '../../components/ServiceAvatar';
import { SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { api } from '../../services/api';
import { actions, selectServices, useApp } from '../../stores/app-store';

export function NotificationSettings() {
  const notifications = useApp((s) => s.config?.settings.notifications);
  const services = useApp(selectServices);
  const platform = useApp((s) => s.info?.platform);
  if (!notifications) return null;
  const set = (patch: Partial<typeof notifications>) => void actions.updateSettings({ notifications: patch });
  const off = !notifications.enabled;

  return (
    <>
      <SettingGroup
        title="All services"
        note="Services hand their notifications to the app, which shows them as Windows notifications with the service’s icon. Clicking one opens that service. You won’t get a notification for the service you’re looking at."
      >
        <SettingRow title="Notifications" description="Mute everything at once (Ctrl+Shift+M or the bell in the sidebar).">
          <Toggle label="Global notifications" checked={notifications.enabled} onChange={(v) => set({ enabled: v })} />
        </SettingRow>
        <SettingRow title="Sound" description="Play the Windows notification sound." disabled={off}>
          <Toggle label="Sound" checked={notifications.sound} disabled={off} onChange={(v) => set({ sound: v })} />
        </SettingRow>
        <SettingRow title="Message previews" description="Show sender, message text and picture. When off, notifications only say which service has something new." disabled={off}>
          <Toggle label="Previews" checked={notifications.previews} disabled={off} onChange={(v) => set({ previews: v })} />
        </SettingRow>
        <SettingRow title={platform === 'win32' ? 'Unread count on taskbar icon' : 'Unread count on app icon'} description="Total of all services with notifications on.">
          <Toggle label="Taskbar badge" checked={notifications.taskbarBadge} onChange={(v) => set({ taskbarBadge: v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup
        title="Per service"
        note="Some services also play their own sound inside the page (WhatsApp does). The app can’t silence that without also muting calls, so turn it off in the service’s own settings if you want silence."
      >
        {services.length === 0 && <div className="setting-row"><span className="muted">No services added yet.</span></div>}
        {services.map((inst) => {
          const def = getServiceDefinition(inst.type);
          if (!def) return null;
          return (
            <SettingRow key={inst.id} title={<span className="row-title"><ServiceAvatar definition={def} size={22} /> {def.name} · {inst.label}</span>} disabled={off}>
              <label className="mini-toggle">
                <span className="muted">Sound</span>
                <Toggle
                  label={`${def.name} sound`}
                  checked={inst.notifications.sound}
                  disabled={off || !inst.notifications.enabled}
                  onChange={(v) => void api.invoke('services:update', inst.id, { notifications: { ...inst.notifications, sound: v } })}
                />
              </label>
              <Toggle
                label={`${def.name} notifications`}
                checked={inst.notifications.enabled}
                disabled={off}
                onChange={(v) => void api.invoke('services:update', inst.id, { notifications: { ...inst.notifications, enabled: v } })}
              />
            </SettingRow>
          );
        })}
      </SettingGroup>

      <SettingGroup title="Recent notifications" note="The home screen lists recent notifications. They live in memory only and are never written to disk.">
        <SettingRow title="Clear recent notifications">
          <button className="btn" onClick={() => void api.invoke('notifications:clear-history')}>Clear</button>
        </SettingRow>
      </SettingGroup>
    </>
  );
}
