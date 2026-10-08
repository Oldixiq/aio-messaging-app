import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { env, type LogLevel } from './env';

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const MAX_LOG_BYTES = 5 * 1024 * 1024;

let stream: WriteStream | null = null;

/** Opens logs/main.log, rotating the previous file when it grows past 5 MB. */
export function initLogFile(logsDir: string): void {
  mkdirSync(logsDir, { recursive: true });
  const file = join(logsDir, 'main.log');
  try {
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) renameSync(file, join(logsDir, 'main.old.log'));
  } catch {
    // Rotation is best effort; logging must never break startup.
  }
  stream = createWriteStream(file, { flags: 'a' });
}

function format(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function write(level: LogLevel, scope: string, parts: unknown[]): void {
  if (LEVELS[level] > LEVELS[env.logLevel]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${parts.map(format).join(' ')}`;
  stream?.write(`${line}\n`);
  if (env.isDev) (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export interface Logger {
  error(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  debug(...parts: unknown[]): void;
}

/**
 * Scoped logger. Never log message contents, cookies or full URLs of service
 * pages (they can carry tokens); log hosts instead.
 */
export function createLogger(scope: string): Logger {
  return {
    error: (...p) => write('error', scope, p),
    warn: (...p) => write('warn', scope, p),
    info: (...p) => write('info', scope, p),
    debug: (...p) => write('debug', scope, p),
  };
}

export function closeLogFile(): void {
  stream?.end();
  stream = null;
}
