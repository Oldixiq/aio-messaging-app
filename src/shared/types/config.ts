import type { ServiceInstance } from './service';

export type ThemeSource = 'system' | 'light' | 'dark';
export type LaunchBehavior = 'dashboard' | 'last-service';
export type SidebarMode = 'compact' | 'expanded';
export type IconSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  general: {
    startWithWindows: boolean;
    startMinimized: boolean;
    minimizeToTray: boolean;
    closeToTray: boolean;
    launchBehavior: LaunchBehavior;
    /** BCP-47 tag. Only `en` ships today; the setting is wired for i18n. */
    language: string;
    /** Looks for new versions at startup and every few hours (installed builds only). */
    checkForUpdates: boolean;
  };
  appearance: {
    theme: ThemeSource;
    accentColor: string;
    sidebarMode: SidebarMode;
    iconSize: IconSize;
    animations: boolean;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    previews: boolean;
    /** Unread count on the taskbar icon (Windows overlay badge). */
    taskbarBadge: boolean;
  };
  performance: {
    /** Unload services not used for `suspendAfterMinutes` (sessions are kept). */
    suspendInactive: boolean;
    suspendAfterMinutes: number;
    /** Unload the least recently used service when the PC runs low on memory. */
    suspendOnLowMemory: boolean;
  };
}

export interface UiState {
  activeInstanceId: string | null;
  view: 'dashboard' | 'service';
}

export interface AppConfig {
  schemaVersion: 1;
  settings: AppSettings;
  services: ServiceInstance[];
  ui: UiState;
}

/** Recursively optional, used for settings patches. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
