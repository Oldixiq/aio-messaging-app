import { app } from 'electron';
import { join } from 'node:path';

/**
 * Local data layout (all under the per-user app data folder, e.g.
 * %APPDATA%\Veya on Windows):
 *
 *   config.json          app settings + list of services (no secrets)
 *   window-state.json    window size/position
 *   sessions/<type>/<instance-id>/   isolated browser profile per account
 *                        (cookies, local storage, IndexedDB, cache)
 *   logs/main.log        diagnostic log (no message content)
 *   pending-cleanup.json session folders to delete on next start
 */
export function getPaths() {
  const userData = app.getPath('userData');
  return {
    userData,
    config: join(userData, 'config.json'),
    windowState: join(userData, 'window-state.json'),
    sessions: join(userData, 'sessions'),
    logs: join(userData, 'logs'),
    pendingCleanup: join(userData, 'pending-cleanup.json'),
  };
}

export type AppPaths = ReturnType<typeof getPaths>;

export function sessionDirFor(paths: AppPaths, type: string, instanceId: string): string {
  return join(paths.sessions, type, instanceId);
}
