/**
 * =============================================================================
 * AFFILIATE GROUPING
 * =============================================================================
 *
 * Created: 2026-06-14 (paras)
 *
 * David's request: "is it possible to group the postings by Domain?" — for web
 * postings group by domain, and for social postings (YouTube/Instagram/TikTok)
 * group by CREATOR (one row per channel/creator instead of one per posting).
 *
 * WHY A SHARED HELPER:
 * --------------------
 * Discovered and Saved both need the exact same grouping, and Find already has
 * an inline (web-only) version. One tested helper avoids three copies drifting.
 *
 * GROUPING KEY (validated against production data on 2026-06-14):
 * --------------------------------------------------------------
 *   - Web    → domain (e.g. "weleda.de"). domain is always populated.
 *   - Social → the creator's stable identity, in priority order:
 *       channel.link  (handle URL, e.g. https://www.tiktok.com/@teepir — unique)
 *       → channel.name (display name fallback)
 *       → link         (last resort: the posting's own URL, so a creator with
 *                       no identity at all never wrongly merges with another).
 *   The key is lowercased and namespaced by source so a web domain can never
 *   collide with a creator that happens to share the same string.
 *
 * DB cross-check (David, user 63): only 11 of ~1190 discovered social rows had
 * no creator identity at all (fall back to per-posting link = singleton group);
 * every saved social row had an identity. Grouping collapses ~1261→1007
 * (discovered) and ~527→376 (saved) rows.
 * =============================================================================
 */

import type { ResultItem } from '../types';

const SOCIAL_SOURCES = ['youtube', 'instagram', 'tiktok'];

/**
 * Returns the stable group key for a single affiliate posting.
 * Web → "web::<domain>", Social → "<source>::<creator-identity>".
 */
export function groupKeyOf(item: ResultItem): string {
  // The same creator/domain may legitimately exist in several markets. Keep
  // those rows separate in an aggregated multi-location view so actions and
  // counts retain their location meaning.
  const locationScope = item.brandLocationId ?? 'legacy';
  const source = (item.source || '').toLowerCase();
  if (SOCIAL_SOURCES.includes(source)) {
    const creator = item.channel?.link || item.channel?.name || item.link || '';
    return `${locationScope}::${source}::${creator.toLowerCase()}`;
  }
  const domain = (item.domain || item.link || '').toLowerCase().replace(/^www\./, '');
  return `${locationScope}::web::${domain}`;
}

/** A location-aware key for row selection and optimistic updates. */
export function affiliateIdentityKey(item: Pick<ResultItem, 'brandLocationId' | 'link'>): string {
  return `${item.brandLocationId ?? 'legacy'}::${item.link}`;
}

export interface AffiliateGroup {
  /** The representative posting shown in the collapsed row (first/newest). */
  main: ResultItem;
  /** The remaining postings under the same domain/creator. */
  subItems: ResultItem[];
}

/** Returns every database record represented by one visible affiliate row. */
export function affiliateGroupItems(group: AffiliateGroup): ResultItem[] {
  return [group.main, ...group.subItems];
}

/**
 * Collapses a flat, already-sorted list of postings into groups. Insertion
 * order is preserved (Map keeps first-seen order), so when the input is sorted
 * newest-first the group's `main` is its newest posting.
 */
export function groupAffiliates(items: ResultItem[]): AffiliateGroup[] {
  const groups = new Map<string, ResultItem[]>();
  for (const item of items) {
    const key = groupKeyOf(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.values()).map(arr => ({ main: arr[0], subItems: arr.slice(1) }));
}

export interface AffiliateGroupSelectionSummary {
  /** Visible affiliate rows selected by the user. */
  selectedGroups: AffiliateGroup[];
  /** Database records hidden inside those visible rows. */
  selectedItems: ResultItem[];
  /** Number shown to the user: one per domain/creator and location. */
  selectedGroupCount: number;
  /** Selected visible rows for which every underlying record is complete. */
  completeGroupCount: number;
  /** Selected visible rows that still contain at least one actionable record. */
  actionableGroupCount: number;
  /** Incomplete database records to send to the mutation API. */
  actionableItems: ResultItem[];
}

/**
 * Builds the single source of truth for grouped bulk actions.
 *
 * The UI always talks in visible affiliate groups, while mutation APIs still
 * receive the exact underlying records. Keeping both units in this named
 * summary prevents a raw posting count from being presented as an affiliate
 * count (for example, 78 postings hidden inside 69 visible affiliates).
 */
export function summarizeAffiliateGroupSelection(
  groups: readonly AffiliateGroup[],
  selectedGroupKeys: ReadonlySet<string>,
  isItemComplete: (item: ResultItem) => boolean,
): AffiliateGroupSelectionSummary {
  const selectedGroups = groups.filter(group => selectedGroupKeys.has(groupKeyOf(group.main)));
  const selectedItems: ResultItem[] = [];
  const actionableItems: ResultItem[] = [];
  let completeGroupCount = 0;
  let actionableGroupCount = 0;

  for (const group of selectedGroups) {
    const items = affiliateGroupItems(group);
    selectedItems.push(...items);

    const incompleteItems = items.filter(item => !isItemComplete(item));
    if (incompleteItems.length === 0) {
      completeGroupCount += 1;
    } else {
      actionableGroupCount += 1;
      actionableItems.push(...incompleteItems);
    }
  }

  return {
    selectedGroups,
    selectedItems,
    selectedGroupCount: selectedGroups.length,
    completeGroupCount,
    actionableGroupCount,
    actionableItems,
  };
}

/**
 * Group counts per source (number of distinct groups, not postings) for the
 * filter-tab badges. Source-namespaced keys mean no cross-source collisions.
 */
export function groupCountsBySource(items: ResultItem[]): {
  All: number; Web: number; YouTube: number; Instagram: number; TikTok: number;
} {
  const all = new Set<string>();
  const web = new Set<string>();
  const youtube = new Set<string>();
  const instagram = new Set<string>();
  const tiktok = new Set<string>();
  for (const item of items) {
    const key = groupKeyOf(item);
    all.add(key);
    switch (item.source) {
      case 'Web': web.add(key); break;
      case 'YouTube': youtube.add(key); break;
      case 'Instagram': instagram.add(key); break;
      case 'TikTok': tiktok.add(key); break;
    }
  }
  return { All: all.size, Web: web.size, YouTube: youtube.size, Instagram: instagram.size, TikTok: tiktok.size };
}
