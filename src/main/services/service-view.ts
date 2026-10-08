import { mkdirSync } from 'node:fs';
import { session as electronSession, WebContentsView, type Rectangle, type Session } from 'electron';
import type { ServiceDefinition, ServiceInstance, ServiceRuntimeState } from '@shared/types/service';
import { readBadgeFromTitle } from '@shared/utils/badges';
import { hostMatches, safeParseUrl } from '@shared/utils/domains';
import { createLogger, type Logger } from '../logger';
import { attachContextMenu } from './context-menu';
import { decideNavigation, isAllowedInService, openExternalSafely } from './navigation-policy';
import { applyPermissionPolicy } from './permissions';
import { resolveUserAgent } from './user-agent';
import { attachShortcuts, type ShortcutMatcher } from '../system/shortcuts';
import type { CommandId } from '@shared/constants/commands';

/** Chromium "aborted" — fired for superseded navigations, not a real failure. */
const ERR_ABORTED = -3;
const MAX_FAVICON_BYTES = 256 * 1024;

export interface ServiceViewDeps {
  sessionDir: string;
  isDev: boolean;
  shortcuts: ShortcutMatcher;
  notificationsAllowed: () => boolean;
  onState: (state: ServiceRuntimeState) => void;
  onCommand: (command: CommandId) => void;
  /** Creates popup windows (OAuth) parented to the main window. */
  popupParent: () => Electron.BrowserWindow | null;
}

/** Sessions are process-wide singletons per path; configure each only once. */
const configuredSessions = new WeakSet<Session>();

/**
 * One running web service account: a WebContentsView in its own on-disk
 * session, its own renderer process, and its own crash/error handling.
 * The view is created lazily on first activation.
 */
export class ServiceView {
  readonly instanceId: string;
  private view: WebContentsView | null = null;
  private state: ServiceRuntimeState;
  private hasLoadedOnce = false;
  /** Set after a main-frame load failure until the next explicit load; Chromium's error page must not count as "ready". */
  private failed = false;
  private readonly log: Logger;

  constructor(
    private instance: ServiceInstance,
    readonly definition: ServiceDefinition,
    private readonly deps: ServiceViewDeps,
  ) {
    this.instanceId = instance.id;
    this.log = createLogger(`service:${definition.id}:${instance.id.slice(0, 6)}`);
    this.state = {
      instanceId: instance.id,
      status: 'idle',
      unread: null,
      hasActivity: false,
      title: definition.name,
      favicon: null,
      canGoBack: false,
      canGoForward: false,
      offsiteHost: null,
    };
  }

  getState(): ServiceRuntimeState {
    return this.state;
  }

  getView(): WebContentsView | null {
    return this.view;
  }

  isCreated(): boolean {
    return this.view !== null;
  }

  /** True when the page itself should be shown (vs. the shell's loading/error UI). */
  isDisplayable(): boolean {
    return this.view !== null && this.hasLoadedOnce && (this.state.status === 'ready' || this.state.status === 'loading' || this.state.status === 'unresponsive');
  }

  updateInstance(instance: ServiceInstance): void {
    this.instance = instance;
  }

  getSession(): Session {
    mkdirSync(this.deps.sessionDir, { recursive: true });
    const ses = electronSession.fromPath(this.deps.sessionDir);
    if (!configuredSessions.has(ses)) {
      configuredSessions.add(ses);
      ses.setUserAgent(resolveUserAgent(this.definition.webview.userAgent));
      applyPermissionPolicy(ses, {
        definition: this.definition,
        notificationsAllowed: () => this.deps.notificationsAllowed(),
      });
    }
    return ses;
  }

  /** Creates the view and starts loading. Idempotent. */
  ensureCreated(): WebContentsView {
    if (this.view) return this.view;
    this.log.info('creating view');
    const view = new WebContentsView({
      webPreferences: {
        session: this.getSession(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
        backgroundThrottling: true,
        navigateOnDragDrop: false,
        safeDialogs: true,
      },
    });
    // Pages that don't paint a background assume white, like in a browser.
    view.setBackgroundColor('#ffffff');
    view.setBorderRadius(10); // matches the shell's content card
    view.setVisible(false);
    this.view = view;
    this.wire(view);
    this.load();
    return view;
  }

  private wire(view: WebContentsView): void {
    const wc = view.webContents;

    attachShortcuts(wc, this.deps.shortcuts, this.deps.onCommand);
    attachContextMenu(wc, { isDev: this.deps.isDev, onReload: () => this.reload() });

    wc.on('did-start-loading', () => {
      if (this.failed) return;
      if (!this.hasLoadedOnce || this.state.status !== 'ready') this.patch({ status: 'loading', error: undefined });
    });
    wc.on('dom-ready', () => {
      if (this.failed) return;
      this.hasLoadedOnce = true;
      const css = this.definition.webview.customCss;
      if (css) wc.insertCSS(css).catch((e: unknown) => this.log.warn('insertCSS failed', e));
      this.patch({ status: 'ready', error: undefined });
    });
    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === ERR_ABORTED) return;
      this.log.warn(`load failed: ${code} ${description} (${safeParseUrl(url)?.hostname ?? '?'})`);
      this.hasLoadedOnce = false;
      this.failed = true;
      this.patch({ status: 'error', error: { code, description, url } });
    });
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit') return;
      this.log.error(`renderer gone: ${details.reason} (exit ${details.exitCode})`);
      this.hasLoadedOnce = false;
      this.patch({ status: 'crashed' });
    });
    wc.on('unresponsive', () => this.patch({ status: 'unresponsive' }));
    wc.on('responsive', () => this.patch({ status: 'ready' }));

    wc.on('page-title-updated', (_e, title) => {
      const badge = readBadgeFromTitle(title, this.definition.badges);
      this.patch({ title, unread: badge.unread, hasActivity: badge.hasActivity });
    });
    wc.on('page-favicon-updated', (_e, favicons) => {
      void this.updateFavicon(favicons[0]);
    });

    const onNavigated = () => {
      const url = safeParseUrl(wc.getURL());
      const offsite = url && !hostMatches(url.hostname, this.definition.webview.allowedDomains) ? url.hostname : null;
      this.patch({
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
        offsiteHost: offsite,
      });
    };
    wc.on('did-navigate', onNavigated);
    wc.on('did-navigate-in-page', onNavigated);

    wc.on('will-navigate', (event) => {
      const decision = decideNavigation(event.url);
      if (decision === 'allow') return;
      event.preventDefault();
      if (decision === 'external') openExternalSafely(event.url);
    });
    wc.on('will-redirect', (event) => {
      if (decideNavigation(event.url) !== 'allow') event.preventDefault();
    });

    wc.setWindowOpenHandler(({ url, features, disposition }) => {
      const isPopup = disposition === 'new-window' || features.includes('width') || url === 'about:blank';
      if (isPopup && (url === 'about:blank' || isAllowedInService(this.definition, url))) {
        // Sign-in popups (e.g. "Continue with Google") need the same session.
        const parent = this.deps.popupParent();
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            ...(parent ? { parent } : {}),
            width: 520,
            height: 720,
            autoHideMenuBar: true,
            webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
          },
        };
      }
      if (isAllowedInService(this.definition, url) && disposition === 'foreground-tab' && this.isSameApp(url)) {
        void wc.loadURL(url);
        return { action: 'deny' };
      }
      openExternalSafely(url);
      return { action: 'deny' };
    });

    wc.on('did-create-window', (child) => {
      child.webContents.on('will-navigate', (event) => {
        if (decideNavigation(event.url) !== 'allow') event.preventDefault();
      });
      child.webContents.setWindowOpenHandler(({ url }) => {
        openExternalSafely(url);
        return { action: 'deny' };
      });
    });

    if (this.deps.isDev) {
      wc.on('console-message', (event) => {
        if (event.level === 'error') this.log.debug(`page console error: ${event.message.slice(0, 200)}`);
      });
    }
  }

  /** Links to the service's own start host open in place (e.g. Discord invite links). */
  private isSameApp(url: string): boolean {
    const target = safeParseUrl(url);
    const home = safeParseUrl(this.definition.url);
    return target !== null && home !== null && target.hostname === home.hostname;
  }

  private async updateFavicon(url: string | undefined): Promise<void> {
    if (!url || !this.view) return;
    const parsed = safeParseUrl(url);
    if (!parsed) return;
    if (parsed.protocol === 'data:') {
      if (url.length <= MAX_FAVICON_BYTES) this.patch({ favicon: url });
      return;
    }
    if (parsed.protocol !== 'https:') return;
    try {
      // Fetched through the service's own session so the shell never contacts third parties.
      const response = await this.view.webContents.session.fetch(url);
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !type.startsWith('image/')) return;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_FAVICON_BYTES) return;
      this.patch({ favicon: `data:${type.split(';')[0]};base64,${bytes.toString('base64')}` });
    } catch (error) {
      this.log.debug('favicon fetch failed', error);
    }
  }

  private patch(partial: Partial<ServiceRuntimeState>): void {
    this.state = { ...this.state, ...partial };
    this.deps.onState(this.state);
  }

  load(): void {
    if (!this.view) return;
    this.failed = false;
    this.patch({ status: 'loading', error: undefined });
    this.view.webContents.loadURL(this.definition.url).catch(() => {
      // Failures are reported through did-fail-load.
    });
  }

  reload(): void {
    if (!this.view) {
      this.ensureCreated();
      return;
    }
    const wc = this.view.webContents;
    if (this.state.status === 'crashed' || this.state.status === 'error' || wc.isCrashed() || !wc.getURL()) {
      this.load();
    } else {
      wc.reload();
    }
  }

  navigate(action: 'back' | 'forward' | 'home'): void {
    const wc = this.view?.webContents;
    if (!wc) return;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    else if (action === 'home') void wc.loadURL(this.definition.url);
  }

  setBounds(bounds: Rectangle): void {
    this.view?.setBounds(bounds);
  }

  setVisible(visible: boolean): void {
    this.view?.setVisible(visible);
  }

  focus(): void {
    this.view?.webContents.focus();
  }

  openDevTools(): void {
    this.view?.webContents.openDevTools({ mode: 'detach' });
  }

  getOSProcessId(): number | null {
    const wc = this.view?.webContents;
    return wc && !wc.isDestroyed() ? wc.getOSProcessId() : null;
  }

  async capture(): Promise<string | null> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed() || !this.isDisplayable()) return null;
    try {
      const image = await wc.capturePage();
      return image.resize({ width: Math.max(1, Math.round(image.getSize().width / 2)) }).toDataURL();
    } catch {
      return null;
    }
  }

  async clearCache(): Promise<void> {
    const ses = this.getSession();
    await ses.clearCache();
    await ses.clearCodeCaches({});
  }

  /** Removes all cookies and site storage for this account, then reloads to the login page. */
  async logout(): Promise<void> {
    const ses = this.getSession();
    await ses.clearStorageData();
    await ses.clearAuthCache();
    await ses.clearCache();
    this.patch({ unread: null, hasActivity: false });
    if (this.view) this.load();
  }

  /** Destroys the view and its renderer process. Session data stays on disk. */
  destroy(): void {
    if (!this.view) return;
    this.log.info('destroying view');
    const wc = this.view.webContents;
    this.view = null;
    this.hasLoadedOnce = false;
    if (!wc.isDestroyed()) wc.close();
    this.patch({ status: 'idle', canGoBack: false, canGoForward: false });
  }
}
