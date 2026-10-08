import type { AppConfig, AppSettings, DeepPartial } from './config';
import type { ServiceRuntimeState, ServiceInstance } from './service';
import type { AppInfo, MetricsSnapshot, Rect, UpdateState } from './app';
import type { CommandId } from '../constants/commands';

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
    args: [id: string, patch: Partial<Pick<ServiceInstance, 'label' | 'enabled' | 'notifications'>>];
    result: AppConfig;
  };
  'services:remove': { args: [id: string]; result: boolean };
  'services:reorder': { args: [orderedIds: string[]]; result: AppConfig };
  /** Shows the native right-click menu for a sidebar item. */
  'menu:service-context': { args: [id: string]; result: void };
  'services:states': { args: []; result: ServiceRuntimeState[] };
  'view:show-dashboard': { args: []; result: void };
  'view:activate': { args: [id: string]; result: void };
  'view:set-bounds': { args: [bounds: Rect]; result: void };
  /** Temporarily hide the service view so shell overlays (dialogs, settings) are visible. */
  'view:set-occluded': { args: [occluded: boolean]; result: string | null };
  'view:reload': { args: [id: string]; result: void };
  'view:navigate': { args: [id: string, action: 'back' | 'forward' | 'home']; result: void };
  'view:open-devtools': { args: [id: string]; result: void };
  'privacy:clear-cache': { args: [id: string | null]; result: void };
  'privacy:logout': { args: [id: string]; result: boolean };
  'privacy:clear-all': { args: []; result: boolean };
  'metrics:get': { args: []; result: MetricsSnapshot };
  'updater:get-state': { args: []; result: UpdateState };
  'updater:check': { args: []; result: UpdateState };
}

/** Push channels (main -> renderer). */
export interface EventChannels {
  'config:changed': AppConfig;
  'service:state': ServiceRuntimeState;
  'service:removed': string;
  command: CommandId;
  'updater:state': UpdateState;
}

export type InvokeChannel = keyof InvokeChannels;
export type EventChannel = keyof EventChannels;

/** API exposed to the shell renderer as `window.aio`. */
export interface AioBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeChannels[C]['args']): Promise<InvokeChannels[C]['result']>;
  on<C extends EventChannel>(channel: C, listener: (payload: EventChannels[C]) => void): () => void;
  platform: string;
}
