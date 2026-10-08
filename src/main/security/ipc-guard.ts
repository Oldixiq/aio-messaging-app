import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { InvokeChannel, InvokeChannels } from '@shared/types/ipc';
import { createLogger } from '../logger';

const log = createLogger('ipc');

type Handler<C extends InvokeChannel> = (
  ...args: unknown[]
) => Promise<InvokeChannels[C]['result']> | InvokeChannels[C]['result'];

/**
 * Registers IPC handlers that only answer the shell's own top-level frame.
 * Service pages have no preload and cannot reach ipcRenderer at all; this is
 * defence in depth. Handlers receive `unknown[]` and must validate.
 */
export function createIpcRegistry(getWindow: () => BrowserWindow | null) {
  const isTrusted = (event: IpcMainInvokeEvent): boolean => {
    const win = getWindow();
    return !!win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
  };

  return function handle<C extends InvokeChannel>(channel: C, handler: Handler<C>): void {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      if (!isTrusted(event)) {
        log.warn(`rejected ${channel} from untrusted sender`);
        throw new Error('Unauthorized');
      }
      try {
        return await handler(...args);
      } catch (error) {
        log.error(`${channel} failed`, error);
        throw error;
      }
    });
  };
}

export const assert = {
  string(value: unknown, name: string, max = 200): string {
    if (typeof value !== 'string' || value.length > max) throw new TypeError(`${name} must be a string`);
    return value;
  },
  boolean(value: unknown, name: string): boolean {
    if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`);
    return value;
  },
  oneOf<T extends string>(value: unknown, options: readonly T[], name: string): T {
    if (typeof value !== 'string' || !options.includes(value as T)) throw new TypeError(`${name} is invalid`);
    return value as T;
  },
  object(value: unknown, name: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
    return value as Record<string, unknown>;
  },
  rect(value: unknown): { x: number; y: number; width: number; height: number } {
    const r = assert.object(value, 'bounds');
    const n = (k: string) => {
      const v = r[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100_000) throw new TypeError(`bounds.${k} invalid`);
      return Math.round(v);
    };
    return { x: n('x'), y: n('y'), width: n('width'), height: n('height') };
  },
};
