import type { Input, WebContents } from 'electron';
import { DEFAULT_SHORTCUTS, type CommandId, type ShortcutBinding } from '@shared/constants/commands';

interface ParsedAccelerator {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

const KEY_ALIASES: Record<string, string> = { left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown' };

function parse(accelerator: string): ParsedAccelerator {
  const parts = accelerator.split('+').map((p) => p.trim().toLowerCase());
  const key = parts.pop() ?? '';
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: KEY_ALIASES[key] ?? key,
  };
}

/** Matches keyboard input against bindings. "Ctrl" means Cmd on macOS. */
export class ShortcutMatcher {
  private parsed: { binding: ShortcutBinding; acc: ParsedAccelerator }[] = [];

  constructor(bindings: ShortcutBinding[] = DEFAULT_SHORTCUTS) {
    this.setBindings(bindings);
  }

  setBindings(bindings: ShortcutBinding[]): void {
    this.parsed = bindings.map((binding) => ({ binding, acc: parse(binding.accelerator) }));
  }

  match(input: Input): CommandId | null {
    if (input.type !== 'keyDown' || input.isAutoRepeat && input.key !== 'Tab') return null;
    const ctrl = process.platform === 'darwin' ? input.meta : input.control;
    // Use the physical key for digits so Ctrl+Shift+1 layouts still resolve.
    const key = (/^Digit\d$/.test(input.code) ? input.code.slice(5) : input.key).toLowerCase();
    for (const { binding, acc } of this.parsed) {
      if (acc.ctrl === ctrl && acc.shift === input.shift && acc.alt === input.alt && acc.key === key) {
        return binding.command;
      }
    }
    return null;
  }
}

/**
 * Captures app shortcuts before the page sees them. Needed because a focused
 * service view swallows keyboard events the shell renderer would never get.
 */
export function attachShortcuts(webContents: WebContents, matcher: ShortcutMatcher, dispatch: (command: CommandId) => void): void {
  webContents.on('before-input-event', (event, input) => {
    const command = matcher.match(input);
    if (command) {
      event.preventDefault();
      dispatch(command);
    }
  });
}
