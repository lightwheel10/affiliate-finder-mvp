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
  const source = (item.source || '').toLowerCase();
  if (SOCIAL_SOURCES.includes(source)) {
    const creator = item.channel?.link || item.channel?.name || item.link || '';
    return `${source}::${creator.toLowerCase()}`;
  }
  const domain = (item.domain || item.link || '').toLowerCase().replace(/^www\./, '');
  return `web::${domain}`;
}

export interface AffiliateGroup {
  /** The representative posting shown in the collapsed row (first/newest). */
  main: ResultItem;
  /** The remaining postings under the same domain/creator. */
  subItems: ResultItem[];
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
