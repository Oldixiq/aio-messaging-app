/**
 * App-wide commands. Shortcuts are resolved in the main process (so they work
 * even when a service page has keyboard focus) and dispatched by id.
 */
export const COMMAND_IDS = [
  'search.open',
  'service.next',
  'service.previous',
  'service.goto.1',
  'service.goto.2',
  'service.goto.3',
  'service.goto.4',
  'service.goto.5',
  'service.goto.6',
  'service.goto.7',
  'service.goto.8',
  'service.goto.9',
  'service.reload',
  'service.back',
  'service.forward',
  'settings.open',
  'dashboard.open',
  'notifications.toggleMute',
  'sidebar.toggle',
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];

export interface ShortcutBinding {
  command: CommandId;
  /** Display string and matcher, e.g. "Ctrl+Shift+M". Configurable later. */
  accelerator: string;
  label: string;
}

const gotos: ShortcutBinding[] = Array.from({ length: 9 }, (_, i) => ({
  command: `service.goto.${i + 1}` as CommandId,
  accelerator: `Ctrl+${i + 1}`,
  label: `Go to service ${i + 1}`,
}));

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { command: 'search.open', accelerator: 'Ctrl+K', label: 'Search' },
  ...gotos,
  { command: 'service.next', accelerator: 'Ctrl+Tab', label: 'Next service' },
  { command: 'service.previous', accelerator: 'Ctrl+Shift+Tab', label: 'Previous service' },
  { command: 'service.reload', accelerator: 'Ctrl+R', label: 'Reload service' },
  { command: 'service.back', accelerator: 'Alt+Left', label: 'Back' },
  { command: 'service.forward', accelerator: 'Alt+Right', label: 'Forward' },
  { command: 'settings.open', accelerator: 'Ctrl+,', label: 'Settings' },
  { command: 'dashboard.open', accelerator: 'Ctrl+Shift+H', label: 'Home dashboard' },
  { command: 'notifications.toggleMute', accelerator: 'Ctrl+Shift+M', label: 'Mute notifications' },
  { command: 'sidebar.toggle', accelerator: 'Ctrl+B', label: 'Collapse/expand sidebar' },
];
