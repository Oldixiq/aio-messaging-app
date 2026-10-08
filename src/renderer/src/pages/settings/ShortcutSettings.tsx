import { DEFAULT_SHORTCUTS } from '@shared/constants/commands';
import { SettingGroup } from '../../components/controls';

export function ShortcutSettings() {
  const rows = DEFAULT_SHORTCUTS.filter((s) => !/^service\.goto\.[2-9]$/.test(s.command));
  return (
    <SettingGroup
      title="Keyboard shortcuts"
      note="Shortcuts work even while a service page has focus, which means they take priority over the same keys inside services (for example Ctrl+K in Slack or Discord). Custom key bindings are planned."
    >
      {rows.map((s) => (
        <div className="setting-row" key={s.command}>
          <div className="setting-row__title">{s.command === 'service.goto.1' ? 'Go to service 1–9' : s.label}</div>
          <kbd className="kbd">{s.command === 'service.goto.1' ? 'Ctrl+1 … Ctrl+9' : s.accelerator}</kbd>
        </div>
      ))}
    </SettingGroup>
  );
}
