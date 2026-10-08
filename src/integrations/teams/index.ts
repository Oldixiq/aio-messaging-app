import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'teams',
  name: 'Microsoft Teams',
  description: 'Microsoft Teams on the web (work, school or personal).',
  category: 'work',
  brandColor: '#6264A7',
  icon: { kind: 'monogram', text: 'T' },
  url: 'https://teams.microsoft.com/',
  webview: {
    allowedDomains: [
      'teams.microsoft.com', '*.teams.microsoft.com', 'teams.live.com', '*.cloud.microsoft', '*.office.com', '*.office.net',
      '*.microsoft.com', '*.skype.com', '*.sharepoint.com', ...SSO_DOMAINS.microsoft,
    ],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'display-capture', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'],
  },
  badges: { strategy: 'title' },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    'Microsoft Graph chat APIs need an organisation-registered app and admin consent; this uses the official web client.',
    'Your organisation may block Teams on the web or require a managed device (Conditional Access).',
    'Personal Teams accounts use teams.live.com and may redirect there after sign-in.',
  ],
});
