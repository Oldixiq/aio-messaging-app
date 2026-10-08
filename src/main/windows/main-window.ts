import { join } from 'node:path';
import { BrowserWindow, nativeTheme, screen, type Rectangle } from 'electron';
import { TITLEBAR_COLORS, TITLEBAR_HEIGHT } from '@shared/constants/defaults';
import { env } from '../env';
import { createLogger } from '../logger';
import { readJsonFile, writeJsonFileAtomic } from '../storage/json-file';
import { openExternalSafely } from '../services/navigation-policy';
import { SHELL_URL } from '../security/app-protocol';

const log = createLogger('window');

interface WindowState {
  bounds?: Rectangle;
  maximized?: boolean;
}

function loadWindowState(file: string): WindowState {
  try {
    const raw = readJsonFile(file) as WindowState | undefined;
    if (!raw?.bounds) return {};
    // Ignore saved bounds that are no longer on any connected display.
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      const b = raw.bounds!;
      return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
    });
    return visible ? raw : { maximized: raw.maximized };
  } catch {
    return {};
  }
}

export function titleBarOverlay() {
  const colors = nativeTheme.shouldUseDarkColors ? TITLEBAR_COLORS.dark : TITLEBAR_COLORS.light;
  return { ...colors, height: TITLEBAR_HEIGHT };
}

export function createMainWindow(opts: { stateFile: string; show: boolean }): BrowserWindow {
  const state = loadWindowState(opts.stateFile);
  const win = new BrowserWindow({
    width: state.bounds?.width ?? 1280,
    height: state.bounds?.height ?? 820,
    ...(state.bounds ? { x: state.bounds.x, y: state.bounds.y } : {}),
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Veya',
    backgroundColor: nativeTheme.shouldUseDarkColors ? TITLEBAR_COLORS.dark.color : TITLEBAR_COLORS.light.color,
    icon: join(__dirname, '../../resources/icon.png'),
    // Custom title bar with native Windows caption buttons (Window Controls Overlay).
    titleBarStyle: 'hidden',
    titleBarOverlay: env.isMac ? undefined : titleBarOverlay(),
    trafficLightPosition: { x: 14, y: 12 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/shell.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      // The shell must stay responsive even when hidden in the tray.
      backgroundThrottling: false,
    },
  });

  if (state.maximized) win.maximize();

  win.once('ready-to-show', () => {
    if (opts.show) win.show();
    if (env.openShellDevTools) win.webContents.openDevTools({ mode: 'detach' });
  });

  // The shell is a single-page app: it never navigates and never opens windows.
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    log.error(`shell renderer gone: ${details.reason}; reloading`);
    setTimeout(() => !win.isDestroyed() && win.reload(), 500);
  });

  let saveTimer: NodeJS.Timeout | null = null;
  const saveState = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      try {
        writeJsonFileAtomic(opts.stateFile, { bounds: win.getNormalBounds(), maximized: win.isMaximized() });
      } catch (error) {
        log.warn('failed to save window state', error);
      }
    }, 400);
  };
  win.on('resize', saveState);
  win.on('move', saveState);
  win.on('maximize', saveState);
  win.on('unmaximize', saveState);

  if (env.rendererDevUrl) void win.loadURL(env.rendererDevUrl);
  else void win.loadURL(SHELL_URL);

  return win;
}
