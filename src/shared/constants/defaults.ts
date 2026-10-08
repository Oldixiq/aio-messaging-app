import type { AppConfig } from '../types/config';

export const ACCENT_PRESETS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

export const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: 1,
  settings: {
    general: {
      startWithWindows: false,
      startMinimized: false,
      minimizeToTray: false,
      closeToTray: true,
      launchBehavior: 'dashboard',
      language: 'en',
    },
    appearance: {
      theme: 'system',
      accentColor: '#6366f1',
      sidebarMode: 'compact',
      iconSize: 'medium',
      animations: true,
    },
    notifications: {
      enabled: true,
      sound: true,
      previews: true,
    },
    performance: {
      suspendInactive: false,
      suspendAfterMinutes: 30,
      reduceBackgroundActivity: false,
    },
  },
  services: [],
  ui: { activeInstanceId: null, view: 'dashboard' },
};

export const SIDEBAR_WIDTH = { compact: 68, expanded: 232 } as const;
export const TITLEBAR_HEIGHT = 40;

/** Must match --titlebar-bg in the renderer theme so the native window controls blend in. */
export const TITLEBAR_COLORS = {
  light: { color: '#eef0f4', symbolColor: '#1f2330' },
  dark: { color: '#16171d', symbolColor: '#e6e8ef' },
} as const;
