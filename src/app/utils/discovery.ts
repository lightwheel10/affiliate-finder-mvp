/**
 * =============================================================================
 * DISCOVERY MATCH REASONS HELPER
 * =============================================================================
 *
 * Created: January 22, 2026
 * Purpose: [CLIENT REQUEST] Explain WHY a result was shown
 *
 * CLIENT CONTEXT:
 * ---------------
 * The client wants transparency about match logic (keyword + competitor).
 * This helper focuses ONLY on match reasons, not stats or engagement.
 *
 * =============================================================================
 */

import type { SupabaseUserData } from '../hooks/useSupabaseUser';
import type { ResultItem } from '../types';

export type DiscoveryReasonKey =
  | 'searchKeyword'
  | 'competitor'
  | 'matchedTerms'
  | 'mentionsCompetitor'
  | 'searchRank';

export interface DiscoveryReason {
  key: DiscoveryReasonKey;
  value: string;
  priority: number;
}

const MAX_VALUE_LENGTH = 80;
const MAX_MATCH_TERMS = 3;

function truncateValue(value: string): string {
  if (value.length <= MAX_VALUE_LENGTH) return value;
  return value.slice(0, MAX_VALUE_LENGTH - 3) + '...';
}

function normalizeCompetitor(value: string): string {
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

function findCompetitorMention(text: string, competitors: string[]): string | null {
  const haystack = text.toLowerCase();
  for (const competitor of competitors) {
    const needle = normalizeCompetitor(competitor);
    if (!needle) continue;
    if (haystack.includes(needle)) {
      return competitor;
    }
  }
  return null;
}

export function getDiscoveryReasons(
  affiliate: ResultItem,
  user?: SupabaseUserData | null
): DiscoveryReason[] {
  const reasons: DiscoveryReason[] = [];
  if (!affiliate) return reasons;

  const addReason = (key: DiscoveryReasonKey, value: string, priority: number) => {
    const cleanValue = value?.trim();
    if (!cleanValue) return;
    const dedupeKey = `${key}:${cleanValue.toLowerCase()}`;
    if (reasons.some((r) => `${r.key}:${r.value.toLowerCase()}` === dedupeKey)) {
      return;
    }
    reasons.push({
      key,
      value: truncateValue(cleanValue),
      priority,
    });
  };

  // 1) Primary discovery method (keyword or competitor)
  if (affiliate.discoveryMethod) {
    const { type, value } = affiliate.discoveryMethod;
    if (type === 'competitor') {
      addReason('competitor', value, 1);
    } else {
      addReason('searchKeyword', value, 1);
    }
  }

  // 2) If competitor was used, also show keyword when present
  if (affiliate.discoveryMethod?.type === 'competitor' && affiliate.keyword) {
    addReason('searchKeyword', affiliate.keyword, 2);
  }

  // 3) Matched terms in content
  if (affiliate.highlightedWords && affiliate.highlightedWords.length > 0) {
    const terms = affiliate.highlightedWords.slice(0, MAX_MATCH_TERMS).join(', ');
    addReason('matchedTerms', terms, 3);
  }

  // 4) Competitor mention in title/snippet (if user data exists)
  if (user?.competitors && user.competitors.length > 0) {
    const text = `${affiliate.title || ''} ${affiliate.snippet || ''}`.trim();
    if (text) {
      const mentioned = findCompetitorMention(text, user.competitors);
      if (mentioned && affiliate.discoveryMethod?.type !== 'competitor') {
        addReason('mentionsCompetitor', mentioned, 4);
      }
    }
  }

  // 5) Rank position for this search (available across all sources)
  if (typeof affiliate.rank === 'number' && affiliate.rank > 0) {
    addReason('searchRank', `#${affiliate.rank}`, 5);
  }

  return reasons.sort((a, b) => a.priority - b.priority);
}
