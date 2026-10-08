import type { AppConfig, AppSettings, DeepPartial } from '@shared/types/config';
import type { ServiceInstance } from '@shared/types/service';
import { DEFAULT_CONFIG } from '@shared/constants/defaults';
import { getServiceDefinition } from '@integrations/index';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Allowed values for enum-like settings, keyed by dotted path. */
const ENUMS: Record<string, readonly string[]> = {
  'general.launchBehavior': ['dashboard', 'last-service'],
  'appearance.theme': ['system', 'light', 'dark'],
  'appearance.sidebarMode': ['compact', 'expanded'],
  'appearance.iconSize': ['small', 'medium', 'large'],
  'general.language': ['en'],
};

const RANGES: Record<string, [number, number]> = {
  'performance.suspendAfterMinutes': [1, 24 * 60],
};

function validLeaf(path: string, value: unknown, template: unknown): boolean {
  if (typeof value !== typeof template) return false;
  if (typeof value === 'string') {
    const allowed = ENUMS[path];
    if (allowed) return allowed.includes(value);
    if (path === 'appearance.accentColor') return /^#[0-9a-fA-F]{6}$/.test(value);
    return value.length <= 200;
  }
  if (typeof value === 'number') {
    const range = RANGES[path];
    return Number.isFinite(value) && (!range || (value >= range[0] && value <= range[1]));
  }
  return true;
}

/**
 * Deep-merges `patch` into `base`, accepting only keys that exist in `template`
 * with a valid type/value. Unknown or invalid keys are dropped, so neither a
 * hand-edited config file nor a compromised renderer can inject arbitrary data.
 */
function mergeKnown(base: Json, patch: unknown, template: Json, prefix = ''): Json {
  const out: Json = { ...base };
  if (!isObject(patch)) return out;
  for (const key of Object.keys(template)) {
    if (!(key in patch)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const tpl = template[key];
    const value = patch[key];
    if (isObject(tpl)) {
      out[key] = mergeKnown(isObject(base[key]) ? (base[key] as Json) : tpl, value, tpl, path);
    } else if (validLeaf(path, value, tpl)) {
      out[key] = value;
    }
  }
  return out;
}

export function applySettingsPatch(current: AppSettings, patch: DeepPartial<AppSettings>): AppSettings {
  const template = DEFAULT_CONFIG.settings as unknown as Json;
  return mergeKnown(current as unknown as Json, patch, template) as unknown as AppSettings;
}

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

export function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/[\u0000-\u001f]/g, '').trim();
  return trimmed.length > 0 && trimmed.length <= 40 ? trimmed : null;
}

export function sanitizeInstance(raw: unknown): ServiceInstance | null {
  if (!isObject(raw)) return null;
  const { id, type, label, enabled, notifications, createdAt } = raw;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (typeof type !== 'string' || !getServiceDefinition(type)) return null;
  const notif = isObject(notifications) ? notifications : {};
  return {
    id,
    type,
    label: sanitizeLabel(label) ?? 'Account',
    enabled: typeof enabled === 'boolean' ? enabled : true,
    notifications: {
      enabled: typeof notif['enabled'] === 'boolean' ? notif['enabled'] : true,
      sound: typeof notif['sound'] === 'boolean' ? notif['sound'] : true,
    },
    createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
  };
}

/** Builds a fully valid config from whatever was on disk. */
export function sanitizeConfig(raw: unknown): AppConfig {
  const source = isObject(raw) ? raw : {};
  const settings = applySettingsPatch(DEFAULT_CONFIG.settings, source['settings'] as DeepPartial<AppSettings>);
  const seen = new Set<string>();
  const services = (Array.isArray(source['services']) ? source['services'] : [])
    .map(sanitizeInstance)
    .filter((s): s is ServiceInstance => s !== null && !seen.has(s.id) && (seen.add(s.id), true));
  const ui = isObject(source['ui']) ? source['ui'] : {};
  const activeInstanceId =
    typeof ui['activeInstanceId'] === 'string' && services.some((s) => s.id === ui['activeInstanceId'])
      ? (ui['activeInstanceId'] as string)
      : null;
  return {
    schemaVersion: 1,
    settings,
    services,
    ui: { activeInstanceId, view: ui['view'] === 'service' && activeInstanceId ? 'service' : 'dashboard' },
  };
}
