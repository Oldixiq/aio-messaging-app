import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'x',
  name: 'X',
  description: 'X (Twitter) direct messages.',
  category: 'social',
  brandColor: '#0F1419',
  icon: { kind: 'monogram', text: 'X' },
  url: 'https://x.com/messages',
  webview: {
    allowedDomains: ['x.com', '*.x.com', '*.twitter.com', '*.twimg.com', ...SSO_DOMAINS.google, ...SSO_DOMAINS.apple],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    "X's DM API requires a paid developer tier and app approval; this uses the official web client.",
    'The title count combines notifications and messages, as shown by x.com.',
  ],
});
