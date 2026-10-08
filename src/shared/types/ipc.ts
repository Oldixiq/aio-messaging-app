import type { AppConfig, AppSettings, DeepPartial } from './config';
import type { ServiceRuntimeState, ServiceInstance, ServiceStateUpdate } from './service';
import type { AppInfo, MetricsSnapshot, Rect, UpdateState } from './app';
import type { CommandId } from '../constants/commands';
import type { NotificationRecord } from './notifications';

/**
 * Request/response channels (renderer -> main via ipcRenderer.invoke).
 * Every handler validates its arguments in the main process; types here are
 * a convenience, not a security boundary.
 */
export interface InvokeChannels {
  'app:get-info': { args: []; result: AppInfo };
  'app:open-data-folder': { args: []; result: void };
  'app:open-external': { args: [url: string]; result: void };
  'config:get': { args: []; result: AppConfig };
  'settings:update': { args: [patch: DeepPartial<AppSettings>]; result: AppConfig };
  'services:add': { args: [type: string, label: string]; result: ServiceInstance };
  'services:update': {
    args: [id: string, patch: Partial<Pick<ServiceInstance, 'label' | 'enabled' | 'notifications' | 'keepAwake'>>];
    result: AppConfig;
  };
  'services:remove': { args: [id: string]; result: boolean };
  'services:reorder': { args: [orderedIds: string[]]; result: AppConfig };
  /** Shows the native right-click menu for a sidebar item. */
  'menu:service-context': { args: [id: string]; result: void };
  /** Native menu listing the other accounts of the same service. */
  'menu:account-switcher': { args: [id: string]; result: void };
  /** Moves one service by `delta` positions (keyboard-accessible reorder). */
  'services:move': { args: [id: string, delta: number]; result: AppConfig };
  'services:export': { args: []; result: boolean };
  'services:import': { args: []; result: { added: number; skipped: number } | null };
  'services:states': { args: []; result: ServiceRuntimeState[] };
  'view:show-dashboard': { args: []; result: void };
  'view:activate': { args: [id: string]; result: void };
  'view:set-bounds': { args: [bounds: Rect]; result: void };
  /** Temporarily hide the service view so shell overlays (dialogs, settings) are visible. */
  'view:set-occluded': { args: [occluded: boolean]; result: string | null };
  'view:reload': { args: [id: string]; result: void };
  /** Puts a service to sleep now (unloads it; the session is kept). */
  'view:suspend': { args: [id: string]; result: void };
  'view:navigate': { args: [id: string, action: 'back' | 'forward' | 'home']; result: void };
  'view:open-devtools': { args: [id: string]; result: void };
  'privacy:clear-cache': { args: [id: string | null]; result: void };
  'privacy:logout': { args: [id: string]; result: boolean };
  'privacy:clear-all': { args: []; result: boolean };
  'metrics:get': { args: []; result: MetricsSnapshot };
  'notifications:history': { args: []; result: NotificationRecord[] };
  'notifications:clear-history': { args: []; result: void };
  /** Taskbar badge drawn by the shell (main has no canvas). `image` is a small PNG data URL. */
  'app:set-badge': { args: [count: number, image: string | null]; result: void };
  'updater:get-state': { args: []; result: UpdateState };
  'updater:check': { args: []; result: UpdateState };
}

/** Push channels (main -> renderer). */
export interface EventChannels {
  'config:changed': AppConfig;
  'service:state': ServiceStateUpdate;
  'service:removed': string;
  command: CommandId;
  /** Main asks the shell to open the add-service dialog, optionally preselecting a service type. */
  'ui:add-service': string | null;
  'updater:state': UpdateState;
  'notifications:changed': NotificationRecord[];
}

export type InvokeChannel = keyof InvokeChannels;
export type EventChannel = keyof EventChannels;

/** API exposed to the shell renderer as `window.aio`. */
export interface AioBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeChannels[C]['args']): Promise<InvokeChannels[C]['result']>;
  on<C extends EventChannel>(channel: C, listener: (payload: EventChannels[C]) => void): () => void;
  platform: string;
}
