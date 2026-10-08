import { SettingGroup, SettingRow, Segmented, Toggle } from '../../components/controls';
import { actions, useApp } from '../../stores/app-store';

export function GeneralSettings() {
  const general = useApp((s) => s.config?.settings.general);
  const loginSupported = useApp((s) => s.info?.loginItemSupported ?? false);
  const platform = useApp((s) => s.info?.platform);
  if (!general) return null;
  const set = (patch: Partial<typeof general>) => void actions.updateSettings({ general: patch });
  const osName = platform === 'darwin' ? 'macOS' : 'Windows';

  return (
    <>
      <SettingGroup title="Startup">
        <SettingRow
          title={`Start with ${osName}`}
          description={loginSupported ? 'Open Veya when you sign in.' : 'Available in the installed app (not in development builds).'}
          disabled={!loginSupported}
        >
          <Toggle label="Start with Windows" checked={general.startWithWindows} disabled={!loginSupported} onChange={(v) => set({ startWithWindows: v })} />
        </SettingRow>
        <SettingRow title="Start minimized to tray" description="When started automatically, stay in the tray until you open it." disabled={!loginSupported || !general.startWithWindows}>
          <Toggle label="Start minimized" checked={general.startMinimized} disabled={!loginSupported || !general.startWithWindows} onChange={(v) => set({ startMinimized: v })} />
        </SettingRow>
        <SettingRow title="When the app opens" description="Show the home dashboard, or go straight back to the service you used last.">
          <Segmented
            label="Launch behaviour"
            value={general.launchBehavior}
            options={[{ value: 'dashboard', label: 'Home' }, { value: 'last-service', label: 'Last service' }]}
            onChange={(v) => set({ launchBehavior: v })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Window" note="The tray icon is always available; right-click it to quit.">
        <SettingRow title="Close to tray" description="Closing the window keeps services running in the background.">
          <Toggle label="Close to tray" checked={general.closeToTray} onChange={(v) => set({ closeToTray: v })} />
        </SettingRow>
        <SettingRow title="Minimize to tray" description="Minimizing hides the window from the taskbar.">
          <Toggle label="Minimize to tray" checked={general.minimizeToTray} onChange={(v) => set({ minimizeToTray: v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Language">
        <SettingRow title="App language" description="English is the only translation so far. Service pages use your system language.">
          <select className="select" value={general.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="en">English</option>
          </select>
        </SettingRow>
      </SettingGroup>
    </>
  );
}
