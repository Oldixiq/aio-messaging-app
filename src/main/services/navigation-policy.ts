import { shell } from 'electron';
import type { ServiceDefinition } from '@shared/types/service';
import { hostMatches, safeParseUrl } from '@shared/utils/domains';
import { createLogger } from '../logger';

const log = createLogger('navigation');

export type NavigationDecision = 'allow' | 'external' | 'block';

/** Schemes we hand to the OS. Everything else (custom app protocols, file:) is blocked. */
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

export function isAllowedInService(definition: ServiceDefinition, rawUrl: string): boolean {
  const url = safeParseUrl(rawUrl);
  return url !== null && url.protocol === 'https:' && hostMatches(url.hostname, definition.webview.allowedDomains);
}

/**
 * Decides what to do with a top-level navigation inside a service view.
 *
 * - Allow-listed https hosts load in the view.
 * - Other https hosts also load in the view, because sign-in flows (SAML/SSO
 *   identity providers) redirect through domains no list can predict. They get
 *   no permissions (see permissions.ts) and the title bar shows that the page
 *   is off-site with a way back.
 * - Plain http and other schemes never load in the view.
 */
export function decideNavigation(rawUrl: string): NavigationDecision {
  const url = safeParseUrl(rawUrl);
  if (!url) return 'block';
  if (url.protocol === 'https:') return 'allow';
  if (url.protocol === 'about:' && rawUrl === 'about:blank') return 'allow';
  return EXTERNAL_SCHEMES.has(url.protocol) ? 'external' : 'block';
}

export function openExternalSafely(rawUrl: string): void {
  const url = safeParseUrl(rawUrl);
  if (!url || !EXTERNAL_SCHEMES.has(url.protocol)) {
    log.warn(`blocked external open for scheme ${url?.protocol ?? 'invalid'}`);
    return;
  }
  shell.openExternal(url.toString()).catch((error: unknown) => log.warn('openExternal failed', error));
}
