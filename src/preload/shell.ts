import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { AioBridge, EventChannel, InvokeChannel } from '@shared/types/ipc';

/**
 * The only bridge between the app shell UI and the main process. It exposes a
 * fixed list of channels; the renderer never sees ipcRenderer itself.
 * Service pages do not get this preload.
 */
const INVOKE_CHANNELS = new Set<InvokeChannel>([
  'app:get-info', 'app:open-data-folder', 'app:open-external',
  'config:get', 'settings:update',
  'services:add', 'services:update', 'services:remove', 'services:reorder', 'services:states',
  'menu:service-context', 'menu:account-switcher', 'services:move', 'services:export', 'services:import',
  'view:show-dashboard', 'view:activate', 'view:set-bounds', 'view:set-occluded', 'view:reload', 'view:navigate', 'view:open-devtools',
  'privacy:clear-cache', 'privacy:logout', 'privacy:clear-all',
  'metrics:get', 'updater:get-state', 'updater:check',
]);
const EVENT_CHANNELS = new Set<EventChannel>(['config:changed', 'service:state', 'service:removed', 'command', 'updater:state', 'ui:add-service']);

const bridge: AioBridge = {
  invoke(channel, ...args) {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, listener) {
    if (!EVENT_CHANNELS.has(channel)) throw new Error(`Unknown channel ${channel}`);
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => listener(payload as never);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('aio', bridge);
