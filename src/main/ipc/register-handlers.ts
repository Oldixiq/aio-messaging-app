import { randomUUID } from 'node:crypto';
import { app, dialog, Menu, nativeImage, shell, type BrowserWindow } from 'electron';
import type { AppSettings, DeepPartial } from '@shared/types/config';
import type { ServiceInstance } from '@shared/types/service';
import type { AppInfo } from '@shared/types/app';
import { getServiceDefinition } from '@integrations/index';
import { isHttpUrl } from '@shared/utils/domains';
import { env } from '../env';
import { assert, createIpcRegistry } from '../security/ipc-guard';
import type { ConfigStore } from '../storage/config-store';
import type { AppPaths } from '../storage/paths';
import { sanitizeLabel } from '../storage/sanitize';
import { scheduleFullWipe } from '../storage/cleanup';
import { exportServiceList, importServiceList } from '../storage/service-list-io';
import type { ServiceViewManager } from '../services/service-view-manager';
import { openExternalSafely } from '../services/navigation-policy';
import { collectMetrics } from '../system/metrics';
import { loginItemSupported } from '../system/startup';
import type { UpdaterService } from '../updater/updater';
import type { NotificationManager } from '../notifications/notification-manager';
import { createLogger } from '../logger';

const log = createLogger('handlers');

export interface HandlerDeps {
  getWindow: () => BrowserWindow | null;
  config: ConfigStore;
  views: ServiceViewManager;
  paths: AppPaths;
  updater: UpdaterService;
  notifications: NotificationManager;
  relaunch: () => void;
  /** Opens the shell's add-service dialog, optionally preselecting a service type. */
  requestAddService: (type: string | null) => void;
}

async function confirm(win: BrowserWindow | null, message: string, detail: string, confirmLabel: string): Promise<boolean> {
  const options = { type: 'warning' as const, buttons: [confirmLabel, 'Cancel'], defaultId: 1, cancelId: 1, message, detail, noLink: true };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  return response === 0;
}

export function registerIpcHandlers(deps: HandlerDeps): void {
  const { config, views, paths } = deps;
  const registry = createIpcRegistry(deps.getWindow);
  // Handlers are also callable from main-process menus without going through IPC.
  const local = new Map<string, (...args: unknown[]) => unknown>();
  const handle: typeof registry = (channel, handler) => {
    local.set(channel, handler);
    registry(channel, handler);
  };
  const ipcInvokeLocal = async (channel: string, ...args: unknown[]) => {
    try {
      await local.get(channel)?.(...args);
    } catch (error) {
      log.error(`${channel} failed`, error);
    }
  };
  const instanceName = (id: string) => {
    const inst = config.getInstance(id);
    const def = inst && getServiceDefinition(inst.type);
    return inst && def ? `${def.name} (${inst.label})` : 'Service';
  };
  const requireInstance = (raw: unknown): ServiceInstance => {
    const inst = config.getInstance(assert.string(raw, 'id', 64));
    if (!inst) throw new Error('Unknown service');
    return inst;
  };

  handle('app:get-info', (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isDev: env.isDev,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    paths: { userData: paths.userData, config: paths.config, sessions: paths.sessions, logs: paths.logs },
    loginItemSupported: loginItemSupported(),
  }));
  handle('app:open-data-folder', async () => {
    await shell.openPath(paths.userData);
  });
  handle('app:open-external', (url) => {
    const value = assert.string(url, 'url', 2000);
    if (isHttpUrl(value)) openExternalSafely(value);
  });

  handle('config:get', () => config.get());
  handle('settings:update', (patch) => config.updateSettings(assert.object(patch, 'patch') as DeepPartial<AppSettings>));

  handle('services:add', (type, label) => {
    const definition = getServiceDefinition(assert.string(type, 'type', 64));
    if (!definition) throw new Error('Unknown service type');
    const existing = config.get().services.filter((s) => s.type === definition.id);
    if (existing.length > 0 && !definition.capabilities.multipleAccounts) throw new Error(`${definition.name} supports a single account`);
    const instance: ServiceInstance = {
      id: randomUUID(),
      type: definition.id,
      label: sanitizeLabel(label) ?? (existing.length === 0 ? 'Personal' : `Account ${existing.length + 1}`),
      enabled: true,
      notifications: { enabled: true, sound: true },
      keepAwake: false,
      createdAt: Date.now(),
    };
    config.setServices([...config.get().services, instance]);
    log.info(`added ${definition.id}`);
    return instance;
  });

  handle('services:update', (id, patch) => {
    const inst = requireInstance(id);
    const p = assert.object(patch, 'patch');
    const next: ServiceInstance = { ...inst };
    if ('label' in p) next.label = sanitizeLabel(p['label']) ?? inst.label;
    if ('enabled' in p) next.enabled = assert.boolean(p['enabled'], 'enabled');
    if ('keepAwake' in p) next.keepAwake = assert.boolean(p['keepAwake'], 'keepAwake');
    if ('notifications' in p) {
      const n = assert.object(p['notifications'], 'notifications');
      next.notifications = {
        enabled: 'enabled' in n ? assert.boolean(n['enabled'], 'notifications.enabled') : inst.notifications.enabled,
        sound: 'sound' in n ? assert.boolean(n['sound'], 'notifications.sound') : inst.notifications.sound,
      };
    }
    return config.setServices(config.get().services.map((s) => (s.id === inst.id ? next : s)));
  });

  handle('services:remove', async (id) => {
    const inst = requireInstance(id);
    const ok = await confirm(
      deps.getWindow(),
      `Remove ${instanceName(inst.id)}?`,
      'You will be signed out and this account’s local data (cookies, cache, offline messages) will be deleted from this PC.',
      'Remove',
    );
    if (!ok) return false;
    views.removeData(inst.id, inst.type);
    config.setServices(config.get().services.filter((s) => s.id !== inst.id));
    return true;
  });

  handle('services:reorder', (orderedIds) => {
    if (!Array.isArray(orderedIds)) throw new TypeError('orderedIds must be an array');
    const current = config.get().services;
    const byId = new Map(current.map((s) => [s.id, s]));
    const ordered = orderedIds.map((id) => byId.get(String(id))).filter((s): s is ServiceInstance => !!s);
    if (ordered.length !== current.length || new Set(ordered).size !== current.length) throw new Error('Order must list every service once');
    return config.setServices(ordered);
  });

  const moveService = (id: string, delta: number) => {
    const list = [...config.get().services];
    const from = list.findIndex((s) => s.id === id);
    const to = Math.max(0, Math.min(list.length - 1, from + delta));
    if (from === -1 || from === to) return config.get();
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item!);
    return config.setServices(list);
  };

  handle('services:move', (id, delta) => {
    const inst = requireInstance(id);
    if (typeof delta !== 'number' || !Number.isInteger(delta) || Math.abs(delta) > 1000) throw new TypeError('delta must be an integer');
    return moveService(inst.id, delta);
  });

  handle('services:export', async () => {
    const win = deps.getWindow();
    const options = {
      title: 'Export service list',
      defaultPath: 'aio-messenger-services.json',
      filters: [{ name: 'Service list', extensions: ['json'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    exportServiceList(result.filePath, config.get().services);
    log.info(`exported ${config.get().services.length} service(s)`);
    return true;
  });

  handle('services:import', async () => {
    const win = deps.getWindow();
    const options = {
      title: 'Import service list',
      properties: ['openFile' as const],
      filters: [{ name: 'Service list', extensions: ['json'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    const { added, skipped } = importServiceList(file, config.get().services);
    if (added.length > 0) config.setServices([...config.get().services, ...added]);
    log.info(`imported ${added.length} service(s), skipped ${skipped}`);
    return { added: added.length, skipped };
  });

  handle('menu:account-switcher', (id) => {
    const inst = requireInstance(id);
    const def = getServiceDefinition(inst.type);
    const siblings = config.get().services.filter((s) => s.type === inst.type);
    const menu = Menu.buildFromTemplate([
      ...siblings.map((s) => ({
        label: s.label,
        type: 'radio' as const,
        checked: s.id === inst.id,
        click: () => views.activate(s.id),
      })),
      { type: 'separator' },
      { label: `Add another ${def?.name ?? ''} account…`, click: () => deps.requestAddService(inst.type) },
    ]);
    const win = deps.getWindow();
    menu.popup(win ? { window: win } : {});
  });

  handle('services:states', () => views.states());

  handle('menu:service-context', (id) => {
    const inst = requireInstance(id);
    const view = views.get(inst.id);
    const setInstance = (patch: Partial<ServiceInstance>) =>
      config.setServices(config.get().services.map((s) => (s.id === inst.id ? { ...s, ...patch } : s)));
    const menu = Menu.buildFromTemplate([
      { label: instanceName(inst.id), enabled: false },
      { type: 'separator' },
      { label: 'Reload', click: () => (view?.isCreated() ? view.reload() : views.activate(inst.id)) },
      {
        label: 'Notifications',
        type: 'checkbox',
        checked: inst.notifications.enabled,
        click: () => setInstance({ notifications: { ...inst.notifications, enabled: !inst.notifications.enabled } }),
      },
      {
        label: inst.enabled ? 'Disable (unload)' : 'Enable',
        click: () => {
          if (inst.enabled && config.get().ui.activeInstanceId === inst.id) views.showDashboard();
          setInstance({ enabled: !inst.enabled });
        },
      },
      {
        label: 'Sleep now',
        enabled: !!view?.isCreated(),
        click: () => views.suspend(inst.id, 'manual'),
      },
      {
        label: 'Never sleep',
        type: 'checkbox',
        checked: inst.keepAwake,
        click: () => setInstance({ keepAwake: !inst.keepAwake }),
      },
      ...(env.isDev ? [{ label: 'Open DevTools', click: () => view?.openDevTools() }] : []),
      { type: 'separator' },
      { label: 'Move up', enabled: config.get().services[0]?.id !== inst.id, click: () => moveService(inst.id, -1) },
      { label: 'Move down', enabled: config.get().services.at(-1)?.id !== inst.id, click: () => moveService(inst.id, 1) },
      { label: `Add another ${getServiceDefinition(inst.type)?.name ?? ''} account…`, click: () => deps.requestAddService(inst.type) },
      { type: 'separator' },
      { label: 'Log out…', click: () => void ipcInvokeLocal('privacy:logout', inst.id) },
      { label: 'Remove…', click: () => void ipcInvokeLocal('services:remove', inst.id) },
    ]);
    const win = deps.getWindow();
    menu.popup(win ? { window: win } : {});
  });

  handle('view:show-dashboard', () => views.showDashboard());
  handle('view:activate', (id) => views.activate(requireInstance(id).id));
  handle('view:set-bounds', (bounds) => views.setBounds(assert.rect(bounds)));
  handle('view:set-occluded', (occluded) => views.setOccluded(assert.boolean(occluded, 'occluded')));
  handle('view:reload', (id) => {
    const inst = requireInstance(id);
    // A sleeping or never-opened service is woken through activate so it gets attached.
    if (views.get(inst.id)?.isCreated()) views.get(inst.id)?.reload();
    else views.activate(inst.id);
  });
  handle('view:suspend', (id) => views.suspend(requireInstance(id).id, 'manual'));
  handle('view:navigate', (id, action) => views.get(requireInstance(id).id)?.navigate(assert.oneOf(action, ['back', 'forward', 'home'] as const, 'action')));
  handle('view:open-devtools', (id) => {
    if (env.isDev) views.get(requireInstance(id).id)?.openDevTools();
  });

  handle('privacy:clear-cache', async (id) => {
    const targets = id === null ? config.get().services : [requireInstance(id)];
    for (const inst of targets) await views.get(inst.id)?.clearCache();
  });

  handle('privacy:logout', async (id) => {
    const inst = requireInstance(id);
    const ok = await confirm(deps.getWindow(), `Log out of ${instanceName(inst.id)}?`, 'This deletes the cookies and site data for this account only.', 'Log out');
    if (!ok) return false;
    await views.get(inst.id)?.logout();
    return true;
  });

  handle('privacy:clear-all', async () => {
    const ok = await confirm(
      deps.getWindow(),
      'Clear all application data?',
      'Every account will be signed out, all services and settings will be removed, and the app will restart.',
      'Clear everything',
    );
    if (!ok) return false;
    scheduleFullWipe(paths);
    deps.relaunch();
    return true;
  });

  handle('metrics:get', () =>
    collectMetrics({
      processToInstance: views.processMap(),
      instanceLabel: instanceName,
      shellPid: deps.getWindow()?.webContents.getOSProcessId() ?? null,
      activeServices: views.runningCount(),
    }),
  );

  handle('notifications:history', () => deps.notifications.getHistory());
  handle('notifications:clear-history', () => deps.notifications.clearHistory());

  handle('app:set-badge', (count, image) => {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) throw new TypeError('count must be a non-negative integer');
    const win = deps.getWindow();
    if (process.platform === 'win32') {
      if (!win) return;
      const valid = typeof image === 'string' && image.startsWith('data:image/png;base64,') && image.length < 50_000;
      const icon = count > 0 && valid ? nativeImage.createFromDataURL(image) : null;
      win.setOverlayIcon(icon && !icon.isEmpty() ? icon : null, count > 0 ? `${count} unread` : '');
    } else {
      app.setBadgeCount(count);
    }
  });

  handle('updater:get-state', () => deps.updater.getState());
  handle('updater:check', () => deps.updater.check());
  handle('updater:download', () => deps.updater.download());
  handle('updater:install', () => deps.updater.install());
}
