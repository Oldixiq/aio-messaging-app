import { ACCENT_PRESETS } from '@shared/constants/defaults';
import { SettingGroup, SettingRow, Segmented, Toggle } from '../../components/controls';
import { actions, useApp } from '../../stores/app-store';

export function AppearanceSettings() {
  const appearance = useApp((s) => s.config?.settings.appearance);
  if (!appearance) return null;
  const set = (patch: Partial<typeof appearance>) => void actions.updateSettings({ appearance: patch });

  return (
    <>
      <SettingGroup title="Theme" note="The theme also applies to services that support light and dark mode.">
        <SettingRow title="Color mode">
          <Segmented
            label="Theme"
            value={appearance.theme}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={(v) => set({ theme: v })}
          />
        </SettingRow>
        <SettingRow title="Accent color">
          <div className="swatches" role="radiogroup" aria-label="Accent color">
            {ACCENT_PRESETS.map((color) => (
              <button key={color} role="radio" aria-checked={appearance.accentColor === color} aria-label={color}
                className={`swatch${appearance.accentColor === color ? ' is-active' : ''}`} style={{ background: color }}
                onClick={() => set({ accentColor: color })} />
            ))}
            <label className="swatch swatch--custom" title="Custom color">
              <input type="color" value={appearance.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
            </label>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Sidebar">
        <SettingRow title="Sidebar style" description="Compact shows icons only; expanded shows names and unread counts. Ctrl+B switches.">
          <Segmented
            label="Sidebar style"
            value={appearance.sidebarMode}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'expanded', label: 'Expanded' }]}
            onChange={(v) => set({ sidebarMode: v })}
          />
        </SettingRow>
        <SettingRow title="Icon size">
          <Segmented
            label="Icon size"
            value={appearance.iconSize}
            options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
            onChange={(v) => set({ iconSize: v })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Motion">
        <SettingRow title="Animations" description="Turn off for a snappier feel or if motion bothers you.">
          <Toggle label="Animations" checked={appearance.animations} onChange={(v) => set({ animations: v })} />
        </SettingRow>
      </SettingGroup>
    </>
  );
}
