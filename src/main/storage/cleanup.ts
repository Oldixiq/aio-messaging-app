import { existsSync, rmSync } from 'node:fs';
import { createLogger } from '../logger';
import { readJsonFile, writeJsonFileAtomic } from './json-file';
import type { AppPaths } from './paths';

const log = createLogger('cleanup');

interface PendingCleanup {
  wipeAll: boolean;
  dirs: string[];
}

function read(paths: AppPaths): PendingCleanup {
  try {
    const raw = readJsonFile(paths.pendingCleanup) as Partial<PendingCleanup> | undefined;
    return {
      wipeAll: raw?.wipeAll === true,
      dirs: Array.isArray(raw?.dirs) ? raw.dirs.filter((d): d is string => typeof d === 'string') : [],
    };
  } catch {
    return { wipeAll: false, dirs: [] };
  }
}

function isInside(child: string, parent: string): boolean {
  return child.startsWith(parent) && child.length > parent.length;
}

/**
 * Chromium keeps session files open (and Windows locks open files), so a
 * removed account's folder is deleted on the next start, before any session
 * is created.
 */
export function scheduleDirDeletion(paths: AppPaths, dir: string): void {
  if (!isInside(dir, paths.sessions)) throw new Error('refusing to schedule deletion outside sessions folder');
  const pending = read(paths);
  if (!pending.dirs.includes(dir)) pending.dirs.push(dir);
  writeJsonFileAtomic(paths.pendingCleanup, pending);
}

export function scheduleFullWipe(paths: AppPaths): void {
  writeJsonFileAtomic(paths.pendingCleanup, { ...read(paths), wipeAll: true });
}

/** Runs at startup before sessions or config are opened. */
export function runPendingCleanup(paths: AppPaths): void {
  if (!existsSync(paths.pendingCleanup)) return;
  const pending = read(paths);
  const targets = pending.wipeAll ? [paths.sessions, paths.config, paths.windowState] : pending.dirs;
  for (const target of targets) {
    if (!pending.wipeAll && !isInside(target, paths.sessions)) continue;
    try {
      rmSync(target, { recursive: true, force: true });
      log.info(`deleted ${pending.wipeAll ? target : 'removed account data'}`);
    } catch (error) {
      log.warn('could not delete pending data; will retry next start', error);
      return;
    }
  }
  rmSync(paths.pendingCleanup, { force: true });
}
