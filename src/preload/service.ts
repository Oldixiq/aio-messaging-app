/**
 * Preload for service pages (sandboxed, isolated world).
 *
 * Its only job: route the page's Web Notifications to the app's notification
 * manager instead of letting Chromium show them directly, so the app can
 * apply mute/per-service settings, show the service icon, and open the right
 * service on click. Nothing is exposed to the page; no message content is
 * stored beyond the app's in-memory recent list.
 */
import { contextBridge, ipcRenderer } from 'electron';

interface MainWorldHandle {
  click(id: string): void;
}

/** Runs in the page's main world. Must be self-contained (it is serialised). */
function installNotificationBridge(emit: (json: string) => void): MainWorldHandle | null {
  const Native = window.Notification;
  if (typeof Native !== 'function') return null;

  const live = new Map<string, EventTarget>();
  let seq = 0;
  const toAbsolute = (value: unknown): string => {
    if (typeof value !== 'string' || !value) return '';
    try {
      return new URL(value, location.href).href;
    } catch {
      return '';
    }
  };

  class AioNotification extends EventTarget {
    readonly title: string;
    readonly body: string;
    readonly tag: string;
    readonly icon: string;
    readonly silent: boolean;
    readonly data: unknown;
    onclick: ((ev: Event) => unknown) | null = null;
    onshow: ((ev: Event) => unknown) | null = null;
    onclose: ((ev: Event) => unknown) | null = null;
    onerror: ((ev: Event) => unknown) | null = null;
    private readonly aioId: string;

    constructor(title: string, options: NotificationOptions = {}) {
      super();
      this.title = String(title ?? '');
      this.body = options.body ? String(options.body) : '';
      this.tag = options.tag ? String(options.tag) : '';
      this.icon = toAbsolute(options.icon);
      this.silent = Boolean(options.silent);
      this.data = options.data;
      this.aioId = String(++seq);
      live.set(this.aioId, this);
      if (live.size > 100) live.delete(live.keys().next().value as string);
      if (Native.permission === 'granted') {
        emit(JSON.stringify({ id: this.aioId, title: this.title, body: this.body, tag: this.tag, icon: this.icon, silent: this.silent }));
        queueMicrotask(() => this.fire('show'));
      } else {
        queueMicrotask(() => this.fire('error'));
      }
    }

    fire(type: 'click' | 'show' | 'close' | 'error'): void {
      const event = new Event(type, { cancelable: true });
      this.dispatchEvent(event);
      const handler = this[`on${type}`];
      if (typeof handler === 'function') handler.call(this, event);
    }

    close(): void {
      if (live.delete(this.aioId)) this.fire('close');
    }

    static get permission(): NotificationPermission {
      return Native.permission;
    }
    static requestPermission(callback?: NotificationPermissionCallback): Promise<NotificationPermission> {
      return Native.requestPermission(callback);
    }
    static get maxActions(): number {
      return (Native as unknown as { maxActions?: number }).maxActions ?? 0;
    }
  }

  Object.defineProperty(window, 'Notification', { value: AioNotification, writable: true, configurable: true });

  // Pages may also show notifications through their service worker registration.
  const Registration = (window as unknown as { ServiceWorkerRegistration?: { prototype: Record<string, unknown> } }).ServiceWorkerRegistration;
  if (Registration) {
    Registration.prototype['showNotification'] = function showNotification(title: string, options?: NotificationOptions) {
      new AioNotification(title, options);
      return Promise.resolve();
    };
  }

  return {
    click(id: string) {
      const n = live.get(id) as AioNotification | undefined;
      if (!n) return;
      window.focus();
      n.fire('click');
    },
  };
}

let handle: MainWorldHandle | null = null;
try {
  handle = contextBridge.executeInMainWorld({
    func: installNotificationBridge,
    args: [(json: string) => ipcRenderer.send('service:notification', json)],
  }) as MainWorldHandle | null;
} catch (error) {
  // Without the bridge, Chromium shows the page's notifications itself.
  console.warn('[aio] notification bridge unavailable', error);
}

ipcRenderer.on('service:notification-click', (_event, id: unknown) => {
  if (typeof id === 'string') handle?.click(id);
});
