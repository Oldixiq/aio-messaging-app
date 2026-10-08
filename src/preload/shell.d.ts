import type { AioBridge } from '../shared/types/ipc';

declare global {
  interface Window {
    aio: AioBridge;
  }
}

export {};
