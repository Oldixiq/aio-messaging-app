import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import electronUpdater, { type AppUpdater } from 'electron-updater';
import { createLogger } from '../logger';
import type { UpdateProvider } from './updater';

const log = createLogger('updater');

/** electron-builder writes this next to app.asar when the build has a `publish` feed. */
export function hasUpdateFeed(): boolean {
  return existsSync(join(process.resourcesPath, 'app-update.yml'));
}

/**
 * Updates from the release feed configured in electron-builder.yml.
 * electron-updater checks the installer's SHA-512 from the feed and, for
 * signed builds, that the new installer is signed by the same publisher.
 * The NSIS installer runs only after the download verified, so a failed
 * download or check leaves the installed version untouched.
 */
export class ElectronUpdaterProvider implements UpdateProvider {
  private readonly updater: AppUpdater;

  constructor() {
    this.updater = electronUpdater.autoUpdater;
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.allowPrerelease = false;
    this.updater.logger = {
      info: (m: unknown) => log.info(String(m)),
      warn: (m: unknown) => log.warn(String(m)),
      error: (m: unknown) => log.error(String(m)),
      debug: (m: unknown) => log.debug(String(m)),
    };
  }

  unsupportedReason(): null {
    return null;
  }

  async check(): Promise<{ version: string } | null> {
    const result = await this.updater.checkForUpdates();
    if (!result?.isUpdateAvailable) return null;
    return { version: result.updateInfo.version };
  }

  async download(onProgress: (percent: number) => void): Promise<void> {
    const listener = (info: { percent: number }) => onProgress(info.percent);
    this.updater.on('download-progress', listener);
    try {
      onProgress(0);
      await this.updater.downloadUpdate();
    } finally {
      this.updater.off('download-progress', listener);
    }
  }

  install(): void {
    // Silent install, then relaunch the new version.
    this.updater.quitAndInstall(true, true);
  }
}

export function canSelfUpdate(): string | null {
  if (!app.isPackaged) return 'Updates are disabled in development builds.';
  if (process.platform !== 'win32') return 'Automatic updates are only set up for the Windows installer.';
  if (!hasUpdateFeed()) return 'This build has no update feed. Install a release build to get automatic updates.';
  if (process.env['PORTABLE_EXECUTABLE_DIR']) return 'Portable builds cannot update themselves.';
  return null;
}
