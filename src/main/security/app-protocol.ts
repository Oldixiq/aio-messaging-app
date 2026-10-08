import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

/**
 * The shell UI is served from `app://shell/` instead of file://. Installed
 * builds turn off Electron's extra file:// privileges (a fuse), and a custom
 * origin also keeps the shell's storage and CSP 'self' away from the disk.
 * Only the default session (the shell) has this protocol; service sessions don't.
 */
export const APP_SCHEME = 'app';
export const SHELL_URL = `${APP_SCHEME}://shell/index.html`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Serves files under `root` (the built renderer). Anything outside it is a 404. */
export function serveShell(root: string): void {
  const base = normalize(root + sep);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'shell') return new Response(null, { status: 404 });
    const file = normalize(join(base, decodeURIComponent(url.pathname)));
    if (!file.startsWith(base)) return new Response(null, { status: 404 });
    try {
      const body = await readFile(file);
      return new Response(body, { headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
