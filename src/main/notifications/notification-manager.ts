import { ipcMain, nativeImage, Notification, type BrowserWindow, type NativeImage, type WebContents } from 'electron';
import { join } from 'node:path';
import type { NotificationRecord } from '@shared/types/notifications';
import { getServiceDefinition } from '@integrations/index';
import { safeParseUrl } from '@shared/utils/domains';
import { createLogger } from '../logger';
import type { ConfigStore } from '../storage/config-store';
import type { ServiceViewManager } from '../services/service-view-manager';

const log = createLogger('notifications');

const HISTORY_LIMIT = 50;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 4;
const MAX_ICON_BYTES = 256 * 1024;

interface IncomingPayload {
  id: string;
  title: string;
  body: string;
  tag: string;
  icon: string;
  silent: boolean;
}

function parsePayload(raw: unknown): IncomingPayload | null {
  if (typeof raw !== 'string' || raw.length > 20_000) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
    const id = str(p['id'], 32);
    if (!id) return null;
    return {
      id,
      title: str(p['title'], 200).trim(),
      body: str(p['body'], 1000).trim(),
      tag: str(p['tag'], 200),
      icon: str(p['icon'], 4096),
      silent: p['silent'] === true,
    };
  } catch {
    return null;
  }
}

export interface NotificationManagerDeps {
  config: ConfigStore;
  views: ServiceViewManager;
  getWindow: () => BrowserWindow | null;
  showWindow: () => void;
  emitHistory: (records: NotificationRecord[]) => void;
}

/**
 * Unified notification manager. Service pages hand their Web Notifications
 * to us (see preload/service.ts); we decide whether to show a Windows toast,
 * with which icon and text, and open the right service when it is clicked.
 * History lives in memory only and is gone when the app quits.
 */
export class NotificationManager {
  private history: NotificationRecord[] = [];
  /** Electron drops click handlers of garbage-collected notifications; keep them alive. */
  private readonly active = new Set<Notification>();
  private readonly recent = new Map<string, number[]>();
  private readonly appIcon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'));
  private seq = 0;

  constructor(private readonly deps: NotificationManagerDeps) {
    ipcMain.on('service:notification', (event, raw) => {
      // Only real service views may report; the service is never taken from the payload.
      const instanceId = deps.views.instanceIdFor(event.sender);
      if (!instanceId) return;
      const payload = parsePayload(raw);
      if (payload) void this.handle(instanceId, payload, event.sender);
    });
  }

  getHistory(): NotificationRecord[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
    this.deps.emitHistory(this.history);
  }

  /** Drops history entries of services that no longer exist. */
  prune(validIds: Set<string>): void {
    const next = this.history.filter((r) => validIds.has(r.instanceId));
    if (next.length !== this.history.length) {
      this.history = next;
      this.deps.emitHistory(this.history);
    }
  }

  private decide(instanceId: string): NotificationRecord['delivery'] {
    const { settings, ui } = this.deps.config.get();
    const instance = this.deps.config.getInstance(instanceId);
    if (!settings.notifications.enabled) return 'muted';
    if (!instance?.notifications.enabled || !instance.enabled) return 'service-muted';
    const win = this.deps.getWindow();
    const looking = !!win && win.isFocused() && win.isVisible() && ui.view === 'service' && ui.activeInstanceId === instanceId;
    if (looking) return 'focused';
    const now = Date.now();
    const times = (this.recent.get(instanceId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX) return 'rate-limited';
    times.push(now);
    this.recent.set(instanceId, times);
    return 'shown';
  }

  private async handle(instanceId: string, payload: IncomingPayload, sender: WebContents): Promise<void> {
    const instance = this.deps.config.getInstance(instanceId);
    const definition = instance && getServiceDefinition(instance.type);
    if (!instance || !definition) return;

    const delivery = this.decide(instanceId);
    const record: NotificationRecord = {
      key: `${instanceId}:${++this.seq}`,
      instanceId,
      title: payload.title || definition.name,
      body: payload.body,
      at: Date.now(),
      delivery,
    };
    this.history = [record, ...this.history].slice(0, HISTORY_LIMIT);
    this.deps.emitHistory(this.history);
    log.debug(`${definition.id}: ${delivery}`);
    if (delivery !== 'shown' || !Notification.isSupported()) return;

    const { settings, services } = this.deps.config.get();
    const multipleAccounts = services.filter((s) => s.type === instance.type).length > 1;
    const heading = multipleAccounts ? `${definition.name} · ${instance.label}` : definition.name;
    const previews = settings.notifications.previews;
    const body = previews ? [payload.title, payload.body].filter(Boolean).join(': ') || 'New notification' : 'New notification';
    const icon = (previews ? await this.loadIcon(payload.icon, sender) : null) ?? this.serviceIcon(instanceId) ?? this.appIcon;

    const toast = new Notification({
      title: heading,
      body,
      icon,
      silent: payload.silent || !settings.notifications.sound || !instance.notifications.sound,
    });
    this.active.add(toast);
    const release = () => this.active.delete(toast);
    toast.on('click', () => {
      release();
      this.deps.showWindow();
      this.deps.views.activate(instanceId);
      // Lets the page run its own click handler, e.g. open that conversation.
      if (!sender.isDestroyed()) sender.send('service:notification-click', payload.id);
    });
    toast.on('close', release);
    toast.on('failed', (_e, error) => {
      release();
      log.warn('toast failed', error);
    });
    toast.show();
    // Safety net: Windows keeps toasts in Action Center long after they disappear.
    setTimeout(release, 10 * 60_000).unref();
  }

  private serviceIcon(instanceId: string): NativeImage | null {
    const favicon = this.deps.views.get(instanceId)?.getState().favicon;
    if (!favicon) return null;
    const image = nativeImage.createFromDataURL(favicon);
    return image.isEmpty() ? null : image;
  }

  /** Sender avatar, fetched through the service's own session (never the app's). */
  private async loadIcon(url: string, sender: WebContents): Promise<NativeImage | null> {
    const parsed = safeParseUrl(url);
    if (!parsed || sender.isDestroyed()) return null;
    try {
      if (parsed.protocol === 'data:') {
        if (url.length > MAX_ICON_BYTES) return null;
        const image = nativeImage.createFromDataURL(url);
        return image.isEmpty() ? null : image;
      }
      if (parsed.protocol !== 'https:') return null;
      const response = await sender.session.fetch(url);
      if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_ICON_BYTES) return null;
      const image = nativeImage.createFromBuffer(bytes);
      return image.isEmpty() ? null : image;
    } catch {
      return null;
    }
  }
}
