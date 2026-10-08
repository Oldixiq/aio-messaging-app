/** Returns true if `hostname` matches any pattern (`example.com` or `*.example.com`). */
export function hostMatches(hostname: string, patterns: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return patterns.some((raw) => {
    const pattern = raw.toLowerCase();
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === pattern;
  });
}

export function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  const url = safeParseUrl(value);
  return url !== null && (url.protocol === 'https:' || url.protocol === 'http:');
}
