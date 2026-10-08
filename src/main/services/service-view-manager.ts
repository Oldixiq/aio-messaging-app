import type { BrowserWindow, Rectangle } from 'electron';
import type { AppConfig } from '@shared/types/config';
import type { ServiceRuntimeState } from '@shared/types/service';
import type { CommandId } from '@shared/constants/commands';
import { getServiceDefinition } from '@integrations/index';
import { createLogger } from '../logger';
import type { ConfigStore } from '../storage/config-store';
import { sessionDirFor, type AppPaths } from '../storage/paths';
import { scheduleDirDeletion } from '../storage/cleanup';
import type { ShortcutMatcher } from '../system/shortcuts';
import { ServiceView } from './service-view';

const log = createLogger('views');

export interface ServiceViewManagerDeps {
  window: BrowserWindow;
  config: ConfigStore;
  paths: AppPaths;
  isDev: boolean;
  shortcuts: ShortcutMatcher;
  onCommand: (command: CommandId) => void;
  emitState: (state: ServiceRuntimeState) => void;
  emitRemoved: (instanceId: string) => void;
}

/**
 * Owns every ServiceView and decides which one is attached, visible and where.
 * Views are created lazily on first activation, so a service you never open
 * costs nothing.
 */
export class ServiceViewManager {
  private readonly views = new Map<string, ServiceView>();
  private bounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 };
  private occluded = false;

  constructor(private readonly deps: ServiceViewManagerDeps) {
    this.sync(deps.config.get());
    deps.config.on('changed', (config) => this.sync(config));
  }

  /** Reconciles running views with the configured service list. */
  private sync(config: AppConfig): void {
    const configured = new Set(config.services.map((s) => s.id));
    for (const [id, view] of this.views) {
      if (!configured.has(id)) this.dispose(id, view);
    }
    for (const instance of config.services) {
      const existing = this.views.get(instance.id);
      if (existing) {
        existing.updateInstance(instance);
        if (!instance.enabled && existing.isCreated()) this.detach(existing);
        continue;
      }
      const definition = getServiceDefinition(instance.type);
      if (!definition) continue;
      this.views.set(
        instance.id,
        new ServiceView(instance, definition, {
          sessionDir: sessionDirFor(this.deps.paths, instance.type, instance.id),
          isDev: this.deps.isDev,
          shortcuts: this.deps.shortcuts,
          notificationsAllowed: () => {
            const current = this.deps.config.get();
            const inst = this.deps.config.getInstance(instance.id);
            return current.settings.notifications.enabled && (inst?.notifications.enabled ?? false);
          },
          onState: (state) => this.onState(state),
          onCommand: this.deps.onCommand,
          popupParent: () => (this.deps.window.isDestroyed() ? null : this.deps.window),
        }),
      );
    }
    this.layout();
  }

  private onState(state: ServiceRuntimeState): void {
    this.deps.emitState(state);
    if (state.instanceId === this.deps.config.get().ui.activeInstanceId) this.layout();
  }

  private detach(view: ServiceView): void {
    const native = view.getView();
    if (native && !this.deps.window.isDestroyed()) this.deps.window.contentView.removeChildView(native);
    view.destroy();
  }

  private dispose(id: string, view: ServiceView): void {
    this.detach(view);
    this.views.delete(id);
    this.deps.emitRemoved(id);
  }

  states(): ServiceRuntimeState[] {
    return [...this.views.values()].map((v) => v.getState());
  }

  get(id: string): ServiceView | undefined {
    return this.views.get(id);
  }

  activeView(): ServiceView | undefined {
    const { ui } = this.deps.config.get();
    return ui.view === 'service' && ui.activeInstanceId ? this.views.get(ui.activeInstanceId) : undefined;
  }

  activate(id: string): void {
    const view = this.views.get(id);
    const instance = this.deps.config.getInstance(id);
    if (!view || !instance) return;
    if (!instance.enabled) {
      log.info('activating a disabled service; enabling it');
      this.deps.config.setServices(this.deps.config.get().services.map((s) => (s.id === id ? { ...s, enabled: true } : s)));
    }
    if (!view.isCreated()) {
      const native = view.ensureCreated();
      this.deps.window.contentView.addChildView(native);
    }
    this.deps.config.updateUi({ view: 'service', activeInstanceId: id });
    this.layout();
    if (!this.occluded) view.focus();
  }

  showDashboard(): void {
    this.deps.config.updateUi({ view: 'dashboard' });
    this.layout();
  }

  setBounds(bounds: Rectangle): void {
    this.bounds = bounds;
    this.layout();
  }

  /** Hides the active page while shell UI (settings, dialogs) covers it. Returns a screenshot for a backdrop. */
  async setOccluded(occluded: boolean): Promise<string | null> {
    if (occluded === this.occluded) return null;
    const shot = occluded ? await this.activeView()?.capture() ?? null : null;
    this.occluded = occluded;
    this.layout();
    if (!occluded) this.activeView()?.focus();
    return shot;
  }

  private layout(): void {
    if (this.deps.window.isDestroyed()) return;
    const active = this.activeView();
    for (const view of this.views.values()) {
      if (!view.isCreated()) continue;
      const show = view === active && !this.occluded && view.isDisplayable();
      if (show) view.setBounds(this.bounds);
      view.setVisible(show);
    }
  }

  /** Destroys the view and schedules the account's session folder for deletion. */
  removeData(id: string, type: string): void {
    const dir = sessionDirFor(this.deps.paths, type, id);
    try {
      scheduleDirDeletion(this.deps.paths, dir);
    } catch (error) {
      log.error('could not schedule session deletion', error);
    }
  }

  /** Maps renderer process ids to service instances, for the performance page. */
  processMap(): Map<number, string> {
    const map = new Map<number, string>();
    for (const view of this.views.values()) {
      const pid = view.getOSProcessId();
      if (pid) map.set(pid, view.instanceId);
    }
    return map;
  }

  runningCount(): number {
    return [...this.views.values()].filter((v) => v.isCreated()).length;
  }

  destroyAll(): void {
    for (const view of this.views.values()) this.detach(view);
  }
}
