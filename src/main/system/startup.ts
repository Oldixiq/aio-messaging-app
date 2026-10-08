import { app } from 'electron';
import { createLogger } from '../logger';

const log = createLogger('startup');

/**
 * "Start with Windows" uses the OS login-item registry entry. It is only
 * offered for packaged builds: in development it would register the bare
 * Electron binary.
 */
export function loginItemSupported(): boolean {
  return app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin');
}

export function applyLoginItem(enabled: boolean, startMinimized: boolean): void {
  if (!loginItemSupported()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, args: startMinimized ? ['--hidden'] : [] });
  } catch (error) {
    log.warn('setLoginItemSettings failed', error);
  }
}
