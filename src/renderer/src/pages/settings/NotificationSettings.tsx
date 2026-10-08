import { getServiceDefinition } from '@integrations/index';
import { ServiceAvatar } from '../../components/ServiceAvatar';
import { PlannedTag, SettingGroup, SettingRow, Toggle } from '../../components/controls';
import { api } from '../../services/api';
import { actions, selectServices, useApp } from '../../stores/app-store';

export function NotificationSettings() {
  const notifications = useApp((s) => s.config?.settings.notifications);
  const services = useApp(selectServices);
  if (!notifications) return null;
  const set = (patch: Partial<typeof notifications>) => void actions.updateSettings({ notifications: patch });

  return (
    <>
      <SettingGroup
        title="All services"
        note="Today, services show their own Windows notifications, and these switches allow or block them. Sounds and previews are saved now and take effect when notifications move to the app’s unified notification manager in Phase 3."
      >
        <SettingRow title="Notifications" description="Mute everything at once (Ctrl+Shift+M).">
          <Toggle label="Global notifications" checked={notifications.enabled} onChange={(v) => set({ enabled: v })} />
        </SettingRow>
        <SettingRow title={<>Sound <PlannedTag phase={3} /></>} disabled={!notifications.enabled}>
          <Toggle label="Sound" checked={notifications.sound} disabled={!notifications.enabled} onChange={(v) => set({ sound: v })} />
        </SettingRow>
        <SettingRow title={<>Message previews <PlannedTag phase={3} /></>} description="Show sender and message text in notifications." disabled={!notifications.enabled}>
          <Toggle label="Previews" checked={notifications.previews} disabled={!notifications.enabled} onChange={(v) => set({ previews: v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Per service">
        {services.length === 0 && <div className="setting-row"><span className="muted">No services added yet.</span></div>}
        {services.map((inst) => {
          const def = getServiceDefinition(inst.type);
          if (!def) return null;
          return (
            <SettingRow key={inst.id} title={`${def.name} · ${inst.label}`} disabled={!notifications.enabled}>
              <span className="row-avatar"><ServiceAvatar definition={def} size={22} /></span>
              <Toggle
                label={`${def.name} notifications`}
                checked={inst.notifications.enabled}
                disabled={!notifications.enabled}
                onChange={(v) => void api.invoke('services:update', inst.id, { notifications: { ...inst.notifications, enabled: v } })}
              />
            </SettingRow>
          );
        })}
      </SettingGroup>
    </>
  );
}
