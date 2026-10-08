import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'gmail',
  name: 'Gmail',
  description: 'Gmail on the web.',
  category: 'email',
  brandColor: '#EA4335',
  icon: { kind: 'monogram', text: 'GM' },
  url: 'https://mail.google.com/mail/u/0/',
  webview: {
    allowedDomains: ['mail.google.com', '*.google.com', '*.googleusercontent.com', ...SSO_DOMAINS.google],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'clipboard-sanitized-write', 'fullscreen'],
  },
  // e.g. "Inbox (1,234) - me@example.com - Gmail"
  badges: { strategy: 'title', titlePattern: /\(([\d,]+)\)/ },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'Google can refuse sign-in from embedded browsers ("This browser or app may not be secure").',
    'The Gmail API could power real unified search later, but needs an OAuth app verified by Google.',
    'The badge is the unread count of the label currently shown (normally the inbox).',
  ],
});
