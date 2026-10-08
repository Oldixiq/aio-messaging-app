import type { Session } from 'electron';
import type { ServiceDefinition, ServicePermission } from '@shared/types/service';
import { hostMatches, safeParseUrl } from '@shared/utils/domains';
import { createLogger } from '../logger';

const log = createLogger('permissions');

/** Electron permission names that map onto our ServicePermission vocabulary. */
const PERMISSION_MAP: Record<string, ServicePermission> = {
  notifications: 'notifications',
  media: 'media',
  'display-capture': 'display-capture',
  'clipboard-read': 'clipboard-read',
  'clipboard-sanitized-write': 'clipboard-sanitized-write',
  fullscreen: 'fullscreen',
  pointerLock: 'pointerLock',
};

export interface PermissionContext {
  definition: ServiceDefinition;
}

function decide(ctx: PermissionContext, permission: string, origin: string): boolean {
  const mapped = PERMISSION_MAP[permission];
  if (!mapped || !ctx.definition.webview.permissions.includes(mapped)) return false;
  // Only the service's own domains get permissions, never off-site pages.
  const url = safeParseUrl(origin);
  if (!url || url.protocol !== 'https:' || !hostMatches(url.hostname, ctx.definition.webview.allowedDomains)) return false;
  // Notifications are always granted to the page so it keeps emitting them;
  // the NotificationManager decides what is actually shown (mute, per-service).
  return true;
}

/** Installs deny-by-default permission handlers on a service session. */
export function applyPermissionPolicy(session: Session, ctx: PermissionContext): void {
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    const granted = decide(ctx, permission, origin);
    if (!granted) log.debug(`denied ${permission} for ${ctx.definition.id} (${safeParseUrl(origin)?.hostname ?? '?'})`);
    callback(granted);
  });
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    decide(ctx, permission, requestingOrigin),
  );
  session.setDevicePermissionHandler(() => false); // WebHID/WebUSB/Serial: never
}
