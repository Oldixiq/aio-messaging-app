import { EventEmitter } from 'node:events';
import type { UpdateState } from '@shared/types/app';
import { createLogger } from '../logger';

const log = createLogger('updater');

/**
 * Pluggable update backend. Installed builds use electron-updater
 * (./electron-updater-provider.ts); development builds and builds without an
 * update feed use UnconfiguredUpdateProvider, which says so in the UI.
 */
export interface UpdateProvider {
  /** `null` when updates are possible; otherwise a user-facing reason. */
  unsupportedReason(): string | null;
  check(): Promise<{ version: string } | null>;
  download(onProgress: (percent: number) => void): Promise<void>;
  /** Quits and installs. Implementations must leave the current version intact on failure. */
  install(): void;
}

/** Used when this build can't update itself. Reports why instead of pretending. */
export class UnconfiguredUpdateProvider implements UpdateProvider {
  constructor(private readonly reason: string) {}
  unsupportedReason(): string {
    return this.reason;
  }
  async check(): Promise<null> {
    return null;
  }
  async download(): Promise<void> {
    throw new Error(this.reason);
  }
  install(): void {
    throw new Error(this.reason);
  }
}

const AUTO_CHECK_DELAY_MS = 30_000;
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60_000;

export class UpdaterService extends EventEmitter<{ state: [UpdateState] }> {
  private state: UpdateState;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly provider: UpdateProvider) {
    super();
    const reason = provider.unsupportedReason();
    this.state = reason ? { kind: 'unsupported', reason } : { kind: 'idle', lastChecked: null };
  }

  /** Checks shortly after launch and then every few hours, while `enabled`. Never downloads on its own. */
  setAutoCheck(enabled: boolean): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!enabled || this.state.kind === 'unsupported') return;
    const schedule = (delay: number) => {
      this.timer = setTimeout(() => {
        void this.check().finally(() => schedule(AUTO_CHECK_INTERVAL_MS));
      }, delay);
      this.timer.unref();
    };
    schedule(AUTO_CHECK_DELAY_MS);
  }

  getState(): UpdateState {
    return this.state;
  }

  private set(state: UpdateState): void {
    this.state = state;
    this.emit('state', state);
  }

  async check(): Promise<UpdateState> {
    const busy = ['unsupported', 'checking', 'downloading', 'ready'] as const;
    if ((busy as readonly string[]).includes(this.state.kind)) return this.state;
    this.set({ kind: 'checking' });
    try {
      const result = await this.provider.check();
      this.set(result ? { kind: 'available', version: result.version } : { kind: 'idle', lastChecked: Date.now() });
    } catch (error) {
      log.warn('update check failed', error);
      this.set({ kind: 'error', message: 'Could not check for updates. Check your connection and try again.' });
    }
    return this.state;
  }

  async download(): Promise<void> {
    if (this.state.kind !== 'available') return;
    const { version } = this.state;
    try {
      await this.provider.download((percent) => this.set({ kind: 'downloading', percent }));
      this.set({ kind: 'ready', version });
    } catch (error) {
      log.warn('update download failed', error);
      this.set({ kind: 'error', message: 'Download failed. The current version is unchanged.' });
    }
  }

  install(): void {
    if (this.state.kind === 'ready') this.provider.install();
  }
}
