import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'reddit',
  name: 'Reddit',
  description: 'Reddit Chat.',
  category: 'social',
  brandColor: '#FF4500',
  icon: { kind: 'monogram', text: 'R' },
  url: 'https://www.reddit.com/chat',
  webview: {
    allowedDomains: ['*.reddit.com', '*.redd.it', '*.redditstatic.com', '*.redditmedia.com', ...SSO_DOMAINS.google, ...SSO_DOMAINS.apple],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    "Reddit's public API does not cover the current chat system; this uses the official web client.",
    'Reddit may not put an unread count in the page title, in which case no badge is shown.',
  ],
});
