import type { ServiceDefinition } from '@shared/types/service';

/** Identity helper that gives integration files full type checking. */
export function defineService(definition: ServiceDefinition): ServiceDefinition {
  return definition;
}

/** Shared hosts for services that offer "Sign in with Google/Microsoft/Apple". */
export const SSO_DOMAINS = {
  google: ['accounts.google.com', 'accounts.youtube.com', '*.gstatic.com'],
  microsoft: ['login.microsoftonline.com', 'login.live.com', '*.msauth.net', '*.msftauth.net', 'aadcdn.msftauth.net'],
  apple: ['appleid.apple.com', 'idmsa.apple.com'],
} as const;

export const CHROME_UA = { strategy: 'chrome' } as const;
