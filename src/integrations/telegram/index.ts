import { CHROME_UA, defineService } from '../define';

export default defineService({
  id: 'telegram',
  name: 'Telegram',
  description: 'Telegram Web (version A).',
  category: 'messaging',
  brandColor: '#26A5E4',
  icon: { kind: 'monogram', text: 'TG' },
  url: 'https://web.telegram.org/a/',
  webview: {
    allowedDomains: ['web.telegram.org', '*.telegram.org', 't.me'],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'Telegram does have an official client API (TDLib/MTProto). A native integration is possible later; for now this uses Telegram Web.',
    'Calls depend on what Telegram Web supports.',
  ],
});
