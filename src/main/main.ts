import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';
import type { CommandId } from '@shared/constants/commands';
import type { EventChannel, EventChannels } from '@shared/types/ipc';
import { env } from './env';
import { closeLogFile, createLogger, initLogFile } from './logger';
import { getPaths } from './storage/paths';
import { runPendingCleanup } from './storage/cleanup';
import { ConfigStore } from './storage/config-store';
import { hardenApp } from './security/app-hardening';
import { registerAppScheme, serveShell } from './security/app-protocol';
import { createMainWindow, titleBarOverlay } from './windows/main-window';
import { ServiceViewManager } from './services/service-view-manager';
import { chromeUserAgent } from './services/user-agent';
import { registerIpcHandlers } from './ipc/register-handlers';
import { attachShortcuts, ShortcutMatcher } from './system/shortcuts';
import { createTray, type TrayController } from './system/tray';
import { applyLoginItem } from './system/startup';
import { UnconfiguredUpdateProvider, UpdaterService } from './updater/updater';
import { canSelfUpdate, ElectronUpdaterProvider } from './updater/electron-updater-provider';
import { NotificationManager } from './notifications/notification-manager';

// Development builds use their own profile so they never touch real sessions.
if (env.userDataOverride) app.setPath('userData', env.userDataOverride);
else if (env.isDev) app.setPath('userData', join(app.getPath('appData'), 'Veya (dev)'));

app.setName('Veya');
if (env.isWindows) app.setAppUserModelId('com.veya.messenger');

const paths = getPaths();
initLogFile(paths.logs);
const log = createLogger('app');

process.on('uncaughtException', (error) => log.error('uncaught exception', error));
process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason));

registerAppScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void start();
}

async function start(): Promise<void> {
  let mainWindow: BrowserWindow | null = null;
  let tray: TrayController | null = null;
  let quitting = false;

  const showWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  app.on('second-instance', showWindow);
  hardenApp();

  await app.whenReady();
  serveShell(join(__dirname, '../renderer'));
  log.info(`starting ${app.getVersion()} (electron ${process.versions.electron}, ${process.platform}-${process.arch}, dev=${env.isDev})`);

  // Must run before any session is opened: deletes data of removed accounts.
  runPendingCleanup(paths);

  const config = new ConfigStore(paths.config);
  app.userAgentFallback = chromeUserAgent();

  const send = <C extends EventChannel>(channel: C, payload: EventChannels[C]) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };

  const applyTheme = () => {
    nativeTheme.themeSource = config.get().settings.appearance.theme;
    if (mainWindow && !env.isMac) {
      try {
        mainWindow.setTitleBarOverlay(titleBarOverlay());
      } catch (error) {
        log.debug('setTitleBarOverlay not supported', error);
      }
    }
  };
  applyTheme();

  const { settings } = config.get();
  mainWindow = createMainWindow({
    stateFile: paths.windowState,
    show: !(env.startHidden && settings.general.startMinimized),
  });
  const win = mainWindow;

  // Unread counts change often; coalesce tray updates.
  let trayTimer: NodeJS.Timeout | null = null;
  const scheduleTray = () => {
    if (trayTimer) return;
    trayTimer = setTimeout(() => {
      trayTimer = null;
      refreshTray();
    }, 500);
  };

  const shortcuts = new ShortcutMatcher();
  const dispatchCommand = (command: CommandId) => {
    if (command === 'notifications.toggleMute') {
      const enabled = config.get().settings.notifications.enabled;
      config.updateSettings({ notifications: { enabled: !enabled } });
    }
    // The shell renderer handles navigation commands; it knows the UI state.
    send('command', command);
  };
  attachShortcuts(win.webContents, shortcuts, dispatchCommand);

  const views = new ServiceViewManager({
    window: win,
    config,
    paths,
    isDev: env.isDev,
    shortcuts,
    onCommand: dispatchCommand,
    emitState: (state) => {
      send('service:state', state);
      scheduleTray();
    },
    emitRemoved: (id) => send('service:removed', id),
  });

  const updateBlocker = canSelfUpdate();
  const updater = new UpdaterService(updateBlocker ? new UnconfiguredUpdateProvider(updateBlocker) : new ElectronUpdaterProvider());
  updater.on('state', (state) => send('updater:state', state));
  updater.setAutoCheck(settings.general.checkForUpdates);

  const notifications = new NotificationManager({
    config,
    views,
    getWindow: () => (win.isDestroyed() ? null : win),
    showWindow,
    emitHistory: (records) => send('notifications:changed', records),
  });

  registerIpcHandlers({
    getWindow: () => (win.isDestroyed() ? null : win),
    config,
    views,
    paths,
    updater,
    notifications,
    requestAddService: (type) => {
      showWindow();
      send('ui:add-service', type);
    },
    relaunch: () => {
      quitting = true;
      views.destroyAll();
      app.relaunch();
      app.exit(0);
    },
  });

  const totalUnread = () => views.states().reduce((sum, s) => sum + (s.unread ?? 0), 0);

  tray = createTray({
    show: showWindow,
    toggleMute: () => dispatchCommand('notifications.toggleMute'),
    quit: () => {
      quitting = true;
      app.quit();
    },
  });
  const refreshTray = () => tray?.update({ muted: !config.get().settings.notifications.enabled, unread: totalUnread() });

  let lastSettings = config.get().settings;
  config.on('changed', (next) => {
    send('config:changed', next);
    const prev = lastSettings;
    lastSettings = next.settings;
    if (prev.appearance.theme !== next.settings.appearance.theme) applyTheme();
    if (
      prev.general.startWithWindows !== next.settings.general.startWithWindows ||
      prev.general.startMinimized !== next.settings.general.startMinimized
    ) {
      applyLoginItem(next.settings.general.startWithWindows, next.settings.general.startMinimized);
    }
    if (prev.general.checkForUpdates !== next.settings.general.checkForUpdates) updater.setAutoCheck(next.settings.general.checkForUpdates);
    refreshTray();
    notifications.prune(new Set(next.services.map((s) => s.id)));
  });
  nativeTheme.on('updated', applyTheme);

  // Close/minimise to tray.
  win.on('close', (event) => {
    if (!quitting && config.get().settings.general.closeToTray) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('minimize', () => {
    if (config.get().settings.general.minimizeToTray) win.hide();
  });


  app.on('before-quit', () => {
    quitting = true;
    config.flush();
  });
  app.on('will-quit', () => {
    tray?.destroy();
    closeLogFile();
  });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => {
    if (!env.isMac) app.quit();
  });
}
