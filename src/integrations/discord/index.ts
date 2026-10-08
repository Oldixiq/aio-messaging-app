import { CHROME_UA, defineService } from '../define';

export default defineService({
  id: 'discord',
  name: 'Discord',
  description: 'The Discord web client.',
  category: 'messaging',
  brandColor: '#5865F2',
  icon: { kind: 'monogram', text: 'DC' },
  url: 'https://discord.com/app',
  webview: {
    allowedDomains: ['discord.com', '*.discord.com', '*.discordapp.com', '*.discordapp.net', 'discord.gg', '*.hcaptcha.com'],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'],
  },
  // Discord prefixes "(N)" for mentions and "•" for unread channels without mentions.
  badges: { strategy: 'title', indicatorPattern: /^\s*•/ },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    "Discord's API does not allow automating user accounts; this uses the official web client unmodified.",
    'Screen sharing needs a screen picker, which arrives in a later phase.',
    'The badge counts mentions/DMs; plain unread channels show a dot.',
  ],
});
