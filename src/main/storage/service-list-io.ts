import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ServiceInstance } from '@shared/types/service';
import { getServiceDefinition } from '@integrations/index';
import { sanitizeLabel } from './sanitize';
import { writeJsonFileAtomic } from './json-file';

/**
 * Portable service list: which services/accounts you use, their names, order
 * and notification choices. Never includes sessions, cookies or anything that
 * could sign someone in.
 */
interface ExportFile {
  format: 'aio-messenger/services';
  version: 1;
  exportedAt: string;
  services: { type: string; label: string; enabled: boolean; notifications: { enabled: boolean; sound: boolean } }[];
}

const MAX_IMPORT_BYTES = 256 * 1024;
const MAX_IMPORT_SERVICES = 200;

export function exportServiceList(path: string, services: ServiceInstance[]): void {
  const file: ExportFile = {
    format: 'aio-messenger/services',
    version: 1,
    exportedAt: new Date().toISOString(),
    services: services.map(({ type, label, enabled, notifications }) => ({ type, label, enabled, notifications })),
  };
  writeJsonFileAtomic(path, file);
}

export interface ImportResult {
  added: ServiceInstance[];
  skipped: number;
}

/**
 * Parses an export file into new accounts. Each imported account starts signed
 * out. Entries matching an existing account (same service and name) are
 * skipped, so importing the same file twice doesn't duplicate anything.
 */
export function importServiceList(path: string, existing: ServiceInstance[]): ImportResult {
  const raw = readFileSync(path);
  if (raw.byteLength > MAX_IMPORT_BYTES) throw new Error('File is too large to be a service list');
  const data = JSON.parse(raw.toString('utf8')) as Partial<ExportFile>;
  if (data.format !== 'aio-messenger/services' || !Array.isArray(data.services)) throw new Error('Not an AIO Messenger service list');

  const key = (type: string, label: string) => `${type}\u0000${label.toLowerCase()}`;
  const seen = new Set(existing.map((s) => key(s.type, s.label)));
  const added: ServiceInstance[] = [];
  let skipped = 0;
  for (const entry of data.services.slice(0, MAX_IMPORT_SERVICES)) {
    const type = typeof entry?.type === 'string' ? entry.type : '';
    const label = sanitizeLabel(entry?.label) ?? 'Account';
    if (!getServiceDefinition(type) || seen.has(key(type, label))) {
      skipped++;
      continue;
    }
    seen.add(key(type, label));
    const n = entry.notifications;
    added.push({
      id: randomUUID(),
      type,
      label,
      enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
      notifications: {
        enabled: typeof n?.enabled === 'boolean' ? n.enabled : true,
        sound: typeof n?.sound === 'boolean' ? n.sound : true,
      },
      keepAwake: false,
      createdAt: Date.now(),
    });
  }
  skipped += Math.max(0, data.services.length - MAX_IMPORT_SERVICES);
  return { added, skipped };
}
