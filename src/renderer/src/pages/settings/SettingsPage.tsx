import type { ComponentType } from 'react';
import { actions, useApp, type SettingsSection } from '../../stores/app-store';
import { BellIcon, CloseIcon, GaugeIcon, GridIcon, InfoIcon, KeyboardIcon, PaletteIcon, ShieldIcon, SlidersIcon } from '../../components/icons';
import { GeneralSettings } from './GeneralSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { NotificationSettings } from './NotificationSettings';
import { ServicesSettings } from './ServicesSettings';
import { PerformanceSettings } from './PerformanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { ShortcutSettings } from './ShortcutSettings';
import { AboutSettings } from './AboutSettings';

const SECTIONS: { id: SettingsSection; label: string; icon: ComponentType<{ size?: number }>; Component: ComponentType }[] = [
  { id: 'general', label: 'General', icon: SlidersIcon, Component: GeneralSettings },
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon, Component: AppearanceSettings },
  { id: 'notifications', label: 'Notifications', icon: BellIcon, Component: NotificationSettings },
  { id: 'services', label: 'Services', icon: GridIcon, Component: ServicesSettings },
  { id: 'performance', label: 'Performance', icon: GaugeIcon, Component: PerformanceSettings },
  { id: 'privacy', label: 'Privacy & data', icon: ShieldIcon, Component: PrivacySettings },
  { id: 'shortcuts', label: 'Shortcuts', icon: KeyboardIcon, Component: ShortcutSettings },
  { id: 'about', label: 'About', icon: InfoIcon, Component: AboutSettings },
];

export function SettingsPage() {
  const section = useApp((s) => s.settingsSection) ?? 'general';
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const { Component } = current;
  return (
    <div className="settings">
      <aside className="settings__nav">
        <h1>Settings</h1>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`settings__nav-item${id === section ? ' is-active' : ''}`} onClick={() => actions.openSettings(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </aside>
      <main className="settings__content">
        <div className="settings__header">
          <h2>{current.label}</h2>
          <button className="icon-btn" title="Close settings (Esc)" onClick={actions.closeSettings}><CloseIcon size={16} /></button>
        </div>
        <Component />
      </main>
    </div>
  );
}
