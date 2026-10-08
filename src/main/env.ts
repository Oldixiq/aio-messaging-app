import { app } from 'electron';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

function readLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  return value === 'error' || value === 'warn' || value === 'info' || value === 'debug' ? value : fallback;
}

/**
 * Environment-based configuration. Values come from process environment
 * variables (see .env.example); development-only switches are ignored in
 * packaged builds.
 */
export const env = {
  isDev: !app.isPackaged,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  logLevel: readLogLevel(process.env['AIO_LOG_LEVEL'], app.isPackaged ? 'info' : 'debug'),
  openShellDevTools: !app.isPackaged && process.env['AIO_OPEN_DEVTOOLS'] === '1',
  userDataOverride: !app.isPackaged ? process.env['AIO_USER_DATA_DIR'] || null : null,
  /** Set by electron-vite in development. */
  rendererDevUrl: !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] ?? null : null,
  startHidden: process.argv.includes('--hidden'),
} as const;
