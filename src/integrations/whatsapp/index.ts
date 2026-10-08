import { CHROME_UA, defineService } from '../define';

export default defineService({
  id: 'whatsapp',
  name: 'WhatsApp',
  description: 'WhatsApp Web, linked to your phone as a companion device.',
  category: 'messaging',
  brandColor: '#25D366',
  icon: { kind: 'monogram', text: 'WA' },
  url: 'https://web.whatsapp.com/',
  webview: {
    allowedDomains: ['web.whatsapp.com', '*.whatsapp.com', '*.whatsapp.net'],
    // WhatsApp Web rejects user agents that contain "Electron".
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'There is no public API for personal WhatsApp accounts; this uses the official WhatsApp Web client.',
    'Login is by scanning a QR code with your phone. WhatsApp limits how many linked devices an account can have.',
    'Voice and video calls are not available in WhatsApp Web.',
    'The unread badge is the number of unread chats WhatsApp puts in the page title, not the number of messages.',
  ],
});
