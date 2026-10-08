import { CHROME_UA, defineService } from '../define';

export default defineService({
  id: 'messenger',
  name: 'Messenger',
  description: 'Facebook Messenger on the web.',
  category: 'messaging',
  brandColor: '#0866FF',
  icon: { kind: 'monogram', text: 'M' },
  url: 'https://www.messenger.com/',
  webview: {
    allowedDomains: ['*.messenger.com', '*.facebook.com', '*.fbcdn.net', '*.fbsbx.com'],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'Meta offers no messaging API for personal accounts; this uses the official web client.',
    'Meta may redirect messenger.com to facebook.com/messages; both are allowed inside the view.',
    'Meta may ask for extra login verification the first time it sees this app.',
  ],
});
