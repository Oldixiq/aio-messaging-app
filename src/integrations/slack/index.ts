import { CHROME_UA, SSO_DOMAINS, defineService } from '../define';

export default defineService({
  id: 'slack',
  name: 'Slack',
  description: 'Slack in the browser. Add once per workspace sign-in.',
  category: 'work',
  brandColor: '#4A154B',
  icon: { kind: 'monogram', text: 'SL' },
  url: 'https://app.slack.com/client',
  webview: {
    allowedDomains: ['slack.com', '*.slack.com', '*.slack-edge.com', '*.slack-imgs.com', ...SSO_DOMAINS.google, ...SSO_DOMAINS.microsoft, ...SSO_DOMAINS.apple],
    userAgent: CHROME_UA,
    permissions: ['notifications', 'media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'],
  },
  // Slack marks unread activity with a leading "*" or "!" rather than a count.
  badges: { strategy: 'title', indicatorPattern: /^\s*[*!]/ },
  capabilities: { multipleAccounts: true, webNotifications: true, search: false },
  limitations: [
    "Slack's API needs an app installed by a workspace admin, so this uses the official web client.",
    'Slack does not expose an unread count in its page title; you get an activity dot, not a number.',
    'Huddles and screen sharing depend on browser support and a screen picker (later phase).',
  ],
});
