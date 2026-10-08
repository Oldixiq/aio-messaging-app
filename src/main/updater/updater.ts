import { EventEmitter } from 'node:events';
import type { UpdateState } from '@shared/types/app';
import { createLogger } from '../logger';

const log = createLogger('updater');

/**
 * Pluggable update backend. Phase 5 adds an implementation backed by
 * electron-updater (signed NSIS builds + a release feed). The contract covers
 * the whole lifecycle so the UI never changes when a real provider lands.
 */
export interface UpdateProvider {
  /** `null` when updates are possible; otherwise a user-facing reason. */
  unsupportedReason(): string | null;
  check(): Promise<{ version: string } | null>;
  download(onProgress: (percent: number) => void): Promise<void>;
  /** Quits and installs. Implementations must leave the current version intact on failure. */
  install(): void;
}

/** Used until packaging/release infrastructure exists. Reports that honestly. */
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

export class UpdaterService extends EventEmitter<{ state: [UpdateState] }> {
  private state: UpdateState;

  constructor(private readonly provider: UpdateProvider) {
    super();
    const reason = provider.unsupportedReason();
    this.state = reason ? { kind: 'unsupported', reason } : { kind: 'idle', lastChecked: null };
  }

  getState(): UpdateState {
    return this.state;
  }

  private set(state: UpdateState): void {
    this.state = state;
    this.emit('state', state);
  }

  async check(): Promise<UpdateState> {
    if (this.state.kind === 'unsupported' || this.state.kind === 'checking' || this.state.kind === 'downloading') return this.state;
    this.set({ kind: 'checking' });
    try {
      const result = await this.provider.check();
      this.set(result ? { kind: 'available', version: result.version } : { kind: 'idle', lastChecked: Date.now() });
    } catch (error) {
      log.warn('update check failed', error);
      this.set({ kind: 'error', message: error instanceof Error ? error.message : 'Update check failed' });
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
