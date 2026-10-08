import type { BadgePolicy } from '../types/service';

const DEFAULT_TITLE_PATTERN = /^\s*\((\d+)\+?\)/;

export interface BadgeReading {
  unread: number | null;
  hasActivity: boolean;
}

/** Extracts an unread count from a page title according to a badge policy. */
export function readBadgeFromTitle(title: string, policy: BadgePolicy): BadgeReading {
  if (policy.strategy !== 'title') return { unread: null, hasActivity: false };
  const match = (policy.titlePattern ?? DEFAULT_TITLE_PATTERN).exec(title);
  if (match?.[1]) {
    const count = Number.parseInt(match[1].replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(count)) return { unread: count, hasActivity: count > 0 };
  }
  const activity = policy.indicatorPattern ? policy.indicatorPattern.test(title) : false;
  return { unread: 0, hasActivity: activity };
}
