import { CHROME_UA, defineService } from '../define';

export default defineService({
  id: 'instagram',
  name: 'Instagram',
  description: 'Instagram Direct messages on the web.',
  category: 'social',
  brandColor: '#E1306C',
  icon: { kind: 'monogram', text: 'IG' },
  url: 'https://www.instagram.com/direct/inbox/',
  webview: {
    allowedDomains: ['*.instagram.com', '*.cdninstagram.com', '*.facebook.com', '*.fbcdn.net'],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    "Instagram's messaging API only covers Business/Creator accounts managed through Meta; personal DMs use the official web client.",
    'Instagram may challenge logins from a new device or browser.',
    'Calls are limited to what instagram.com supports in the browser.',
  ],
});
