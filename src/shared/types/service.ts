/**
 * Service integration contract.
 *
 * A service integration is *declarative*: it describes how a third-party web app
 * should be hosted (URL, allowed domains, permissions, user agent, badge and
 * notification behaviour). The host application owns the lifecycle (create,
 * load, sleep, crash recovery, destroy) so an integration can never take down
 * the app, and adding one never requires touching unrelated code.
 *
 * Instance-level behaviour (login, logout, accounts) is the same for every
 * web-hosted service: each account is a separate `ServiceInstance` with its own
 * isolated browser session on disk. Logging in happens inside the service's own
 * page; logging out clears that instance's session storage.
 */

export type ServiceCategory = 'messaging' | 'social' | 'work' | 'email';

/** Browser permissions a service may request. Anything not listed is denied. */
export type ServicePermission =
  | 'notifications'
  | 'media' // camera + microphone (calls)
  | 'display-capture' // screen sharing
  | 'clipboard-read'
  | 'clipboard-sanitized-write'
  | 'fullscreen'
  | 'pointerLock';

export type ServiceIcon =
  /** Monogram rendered by the app in the service's brand colour. */
  | { kind: 'monogram'; text: string }
  /** Inline SVG markup (must be self-contained, no scripts). */
  | { kind: 'svg'; svg: string };

export interface UserAgentPolicy {
  /**
   * `chrome`: present as the bundled Chromium without Electron/app tokens.
   * Required by services that refuse "unsupported browsers" (e.g. WhatsApp Web).
   * `custom`: use `value` verbatim.
   */
  strategy: 'chrome' | 'custom';
  value?: string;
}

export interface BadgePolicy {
  /**
   * `title`: parse the unread count from the page title, e.g. "(3) Discord".
   * `none`: the service exposes nothing reliable; show no count.
   * DOM-based extraction per service is a later addition (see the roadmap).
   */
  strategy: 'title' | 'none';
  /** Regex whose first capture group is the unread count. Defaults to `^\((\d+)\)`. */
  titlePattern?: RegExp;
  /** When the title signals activity without a number (e.g. a leading "•"). */
  indicatorPattern?: RegExp;
}

export interface ServiceCapabilities {
  /** Service can be added more than once with independent sessions. */
  multipleAccounts: boolean;
  /** The web app uses the standard Web Notifications API we can observe. */
  webNotifications: boolean;
  /**
   * Message/contact search the app can query. No integration implements this
   * yet; it is the extension point for unified search.
   */
  search: false;
}

export interface ServiceDefinition {
  /** Stable, lowercase id. Also the folder name under src/integrations. */
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Hex colour used for the monogram and accents. */
  brandColor: string;
  icon: ServiceIcon;
  /** URL loaded when the service starts. Must be https. */
  url: string;
  webview: {
    /**
     * Hosts allowed to load inside the service view (top-level navigation).
     * `example.com` matches exactly; `*.example.com` matches the domain and
     * all subdomains. Anything else opens in the system browser.
     */
    allowedDomains: string[];
    userAgent?: UserAgentPolicy;
    /** CSS injected after every page load. Purely cosmetic. */
    customCss?: string;
    permissions: ServicePermission[];
  };
  badges: BadgePolicy;
  capabilities: ServiceCapabilities;
  /**
   * Honest, user-facing notes about what does not work or is not possible.
   * Shown when adding the service.
   */
  limitations: string[];
}

/** A configured service account. Persisted in the app config. */
export interface ServiceInstance {
  /** Random id; also names the instance's session directory. */
  id: string;
  /** References `ServiceDefinition.id`. */
  type: string;
  /** User-facing account label, e.g. "Personal" or "Work". */
  label: string;
  enabled: boolean;
  notifications: {
    enabled: boolean;
    sound: boolean;
  };
  /** Exempt from automatic sleeping (e.g. a service you need notifications from at all times). */
  keepAwake: boolean;
  createdAt: number;
}

export type ServiceStatus =
  | 'idle' // never loaded (lazy) or unloaded
  | 'loading'
  | 'ready'
  | 'error' // page failed to load
  | 'crashed' // renderer process died
  | 'unresponsive'
  | 'suspended'; // unloaded to save resources; session kept, reloads when opened

/** Live state of a running service view, owned by the main process. */
export interface ServiceRuntimeState {
  instanceId: string;
  status: ServiceStatus;
  /** Unread count, `null` when unknown, `0` when known to be zero. */
  unread: number | null;
  /** True when the service signals activity without a count. */
  hasActivity: boolean;
  title: string;
  /** Favicon URL reported by the page (http/https/data only). */
  favicon: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Set while the view shows a page outside the service's own domains (e.g. an SSO login page). */
  offsiteHost: string | null;
  error?: { code: number; description: string; url: string };
}

/** Incremental state update sent to the shell: only the fields that changed. */
export type ServiceStateUpdate = Partial<ServiceRuntimeState> & { instanceId: string };
