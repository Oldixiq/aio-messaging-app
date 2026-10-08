import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'google-chat',
  name: 'Google Chat',
  description: 'Google Chat on the web.',
  category: 'work',
  brandColor: '#00AC47',
  icon: { kind: 'monogram', text: 'GC' },
  url: 'https://chat.google.com/',
  webview: {
    allowedDomains: ['chat.google.com', 'mail.google.com', '*.google.com', '*.googleusercontent.com', ...SSO_DOMAINS.google],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title', titlePattern: /\(([\d,]+)\)/ },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'Google can refuse sign-in from embedded browsers ("This browser or app may not be secure"). If that happens there is no legitimate workaround besides Google allowing it.',
    'The Google Chat API is for bots and Workspace apps, not for reading your personal chats.',
  ],
});
