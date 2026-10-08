import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Reads JSON; returns `undefined` if missing and throws if the file is corrupt. */
export function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** Writes via a temp file + rename so a crash mid-write never leaves a truncated file. */
export function writeJsonFileAtomic(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, path);
}

/** Moves an unreadable file aside so the user can recover it, and returns the new path. */
export function quarantineFile(path: string): string {
  const target = `${path}.corrupt-${Date.now()}`;
  renameSync(path, target);
  return target;
}
