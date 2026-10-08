import { app } from 'electron';
import type { UserAgentPolicy } from '@shared/types/service';

/**
 * Electron's default user agent contains "Electron/x" and the app name, which
 * several services treat as an unsupported browser. The "chrome" policy
 * reports the bundled Chromium honestly, just without those tokens.
 */
export function chromeUserAgent(): string {
  return app.userAgentFallback
    .replace(/\sElectron\/\S+/i, '')
    .replace(new RegExp(`\\s${app.getName().replace(/[^\w-]/g, '')}\\/\\S+`, 'i'), '')
    .replace(/\sveya\/\S+/i, '');
}

export function resolveUserAgent(policy: UserAgentPolicy | undefined): string {
  if (policy?.strategy === 'custom' && policy.value) return policy.value;
  return chromeUserAgent();
}
