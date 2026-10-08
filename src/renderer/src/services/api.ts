import type { AioBridge } from '@shared/types/ipc';

/** Typed access to the preload bridge. */
export const api: AioBridge = window.aio;
