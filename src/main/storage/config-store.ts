import { EventEmitter } from 'node:events';
import type { AppConfig, AppSettings, DeepPartial, UiState } from '@shared/types/config';
import type { ServiceInstance } from '@shared/types/service';
import { createLogger } from '../logger';
import { quarantineFile, readJsonFile, writeJsonFileAtomic } from './json-file';
import { applySettingsPatch, sanitizeConfig } from './sanitize';

const log = createLogger('config');
const SAVE_DEBOUNCE_MS = 250;

/**
 * Single source of truth for persisted configuration. Holds no secrets:
 * authentication lives only in each service's isolated session folder.
 */
export class ConfigStore extends EventEmitter<{ changed: [AppConfig] }> {
  private config: AppConfig;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string) {
    super();
    this.config = this.load();
  }

  private load(): AppConfig {
    try {
      const raw = readJsonFile(this.file);
      const config = sanitizeConfig(raw);
      log.info(`loaded config with ${config.services.length} service(s)`);
      return config;
    } catch (error) {
      log.error('config file unreadable, starting from defaults', error);
      try {
        log.warn(`moved corrupt config to ${quarantineFile(this.file)}`);
      } catch (moveError) {
        log.error('could not move corrupt config aside', moveError);
      }
      return sanitizeConfig(undefined);
    }
  }

  get(): AppConfig {
    return this.config;
  }

  getInstance(id: string): ServiceInstance | undefined {
    return this.config.services.find((s) => s.id === id);
  }

  updateSettings(patch: DeepPartial<AppSettings>): AppConfig {
    return this.commit({ ...this.config, settings: applySettingsPatch(this.config.settings, patch) });
  }

  updateUi(patch: Partial<UiState>): AppConfig {
    // UI state changes often and is not interesting to other listeners beyond persistence.
    return this.commit({ ...this.config, ui: { ...this.config.ui, ...patch } });
  }

  setServices(services: ServiceInstance[]): AppConfig {
    const ui = { ...this.config.ui };
    if (ui.activeInstanceId && !services.some((s) => s.id === ui.activeInstanceId)) {
      ui.activeInstanceId = null;
      ui.view = 'dashboard';
    }
    return this.commit({ ...this.config, services, ui });
  }

  private commit(next: AppConfig): AppConfig {
    this.config = next;
    this.scheduleSave();
    this.emit('changed', next);
    return next;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      writeJsonFileAtomic(this.file, this.config);
    } catch (error) {
      log.error('failed to save config', error);
    }
  }
}
