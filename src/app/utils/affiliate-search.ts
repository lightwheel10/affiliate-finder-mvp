/**
 * =============================================================================
 * AFFILIATE SEARCH PREDICATE
 * =============================================================================
 *
 * Created: April 28, 2026
 *
 * Purpose: Single source of truth for the dashboard search-box predicate used
 * on Find, Discovered, and Saved pages. Before this helper, each page had its
 * own inline OR-chain — Find searched 4 fields, Discovered/Saved searched 3,
 * none searched the creator's name/handle. A user typing "mrbeast" into the
 * search box would get zero hits even when MrBeast was clearly in the list,
 * because the match was only checking title / domain / keyword.
 *
 * WHAT THIS MATCHES:
 * ------------------
 * Case-insensitive substring match on ANY of the following fields. Adding
 * fields to this OR-chain is purely additive — it can only return MORE rows,
 * never fewer, so existing user queries that worked before still work.
 *
 *   - title              (article / video / page title)
 *   - domain             (website domain)
 *   - snippet            (search-result excerpt)
 *   - keyword            (the search keyword that surfaced this result)
 *   - personName         (affiliate / creator full name, when known)
 *   - summary            (creator bio / summary text)
 *   - channel.name       (YouTube channel name, TikTok creator name)
 *   - instagramUsername  (e.g. "mrbeast")
 *   - instagramFullName  (e.g. "Jimmy Donaldson")
 *   - tiktokUsername     (e.g. "mrbeast")
 *   - tiktokDisplayName  (e.g. "MrBeast")
 *
 * WHY EXTRACTED:
 * --------------
 * Three pages (Find, Discovered, Saved) need the SAME match logic. Inlining
 * 11-field OR-chains in three places guarantees future drift — a bug fix or
 * new field will land in one and not the others. The helper costs ~30 lines
 * but removes ~30 lines of duplication and keeps the three surfaces in sync.
 *
 * NOT USED BY OUTREACH:
 * ---------------------
 * src/app/(dashboard)/outreach/page.tsx has its own search predicate that
 * matches on title / domain / email / personName. That page is people-focused
 * (you're picking a contact to email), so its set of searchable fields is
 * intentionally different. Out of scope for this helper.
 *
 * =============================================================================
 */

import type { ResultItem } from '../types';

/**
 * Returns true when the affiliate matches the user's free-text search query.
 *
 * Empty / whitespace-only query is treated as "no filter" (always matches).
 * All optional fields are guarded — undefined / null fields simply don't
 * contribute to the match, they never throw.
 */
export function affiliateMatchesSearchQuery(
  item: ResultItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const includes = (value?: string | null): boolean =>
    typeof value === 'string' && value.toLowerCase().includes(q);

  return (
    includes(item.title) ||
    includes(item.domain) ||
    includes(item.snippet) ||
    includes(item.keyword) ||
    includes(item.personName) ||
    includes(item.summary) ||
    includes(item.channel?.name) ||
    includes(item.instagramUsername) ||
    includes(item.instagramFullName) ||
    includes(item.tiktokUsername) ||
    includes(item.tiktokDisplayName)
  );
}
