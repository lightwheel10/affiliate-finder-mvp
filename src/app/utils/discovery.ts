/**
 * =============================================================================
 * DISCOVERY MATCH REASONS HELPER
 * =============================================================================
 *
 * Created: January 22, 2026
 * Updated: January 23, 2026 - Added 'brand' discovery method support
 * 
 * Purpose: [CLIENT REQUEST] Explain WHY a result was shown
 *
 * CLIENT CONTEXT:
 * ---------------
 * The client wants transparency about match logic (keyword + competitor + brand).
 * This helper focuses ONLY on match reasons, not stats or engagement.
 *
 * DISCOVERY METHOD TYPES:
 * -----------------------
 * - keyword: Found via user's search keyword
 * - brand: Found via brand search (existing affiliates of user's brand)
 * - competitor: Found via competitor search (affiliates of competitors)
 * - topic: Found via onboarding topic
 * - tagged: Manually tagged
 *
 * =============================================================================
 */

import type { SupabaseUserData } from '../hooks/useSupabaseUser';
import type { ResultItem } from '../types';

// =============================================================================
// DISCOVERY REASON KEYS - Updated January 23, 2026
// Added 'brand' for brand search results (existing affiliates)
// =============================================================================
export type DiscoveryReasonKey =
  | 'searchKeyword'
  | 'brand'
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

  // ==========================================================================
  // 1) Primary discovery method - January 23, 2026
  // 
  // Shows the main reason why this result was found:
  // - 'keyword': User's search keyword
  // - 'brand': Brand search (existing affiliates of user's brand)
  // - 'competitor': Competitor search (affiliates of competitors)
  // - 'topic' / 'tagged': Other discovery methods
  // ==========================================================================
  if (affiliate.discoveryMethod) {
    const { type, value } = affiliate.discoveryMethod;
    if (type === 'brand') {
      // Brand search: Found someone already promoting the user's brand
      addReason('brand', value, 1);
    } else if (type === 'competitor') {
      // Competitor search: Found someone promoting a competitor
      addReason('competitor', value, 1);
    } else {
      // Keyword/topic/tagged: Show as search keyword
      addReason('searchKeyword', value, 1);
    }
  }

  // ==========================================================================
  // 2) If brand/competitor was used, also show the search query - January 23, 2026
  // 
  // For brand/competitor searches, the actual search query (e.g., "guffles review")
  // is stored in affiliate.keyword. Show it as secondary context.
  // ==========================================================================
  if ((affiliate.discoveryMethod?.type === 'competitor' || affiliate.discoveryMethod?.type === 'brand') && affiliate.keyword) {
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
