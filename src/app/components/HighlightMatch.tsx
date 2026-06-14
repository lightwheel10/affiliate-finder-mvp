/**
 * =============================================================================
 * HighlightMatch — subtle in-row highlighting for the dashboard search query
 * =============================================================================
 *
 * Created: April 28, 2026
 *
 * Wraps occurrences of `query` inside `text` in a soft-yellow <mark> so users
 * can see WHY a row matched what they typed in the dashboard search box. Used
 * by AffiliateRow on Find / Discovered / Saved.
 *
 * Behaviour:
 *   - Empty / whitespace-only query    → renders plain text (zero overhead).
 *   - Match is case-insensitive.
 *   - Regex special chars in the query are escaped, so typing "(", "." or "+"
 *     never produces an invalid pattern.
 *   - Output is rendered as React text children (never innerHTML), so user
 *     input cannot inject markup.
 *
 * Visual choice — bg-[#fff4d1] is the same soft-yellow tint already used by
 * the legal-page coming-soon callouts, so we're not introducing a new design
 * token. No font-weight or color shift on the matched span — keeps it subtle.
 *
 * NOT to be confused with renderHighlightedSnippet() in AffiliateRow.tsx,
 * which highlights the original DISCOVERY keyword inside the snippet (only
 * shown in the Relevant Content modal). That's a different feature with a
 * different colour (bg-yellow-100). They never render in the same surface.
 * =============================================================================
 */

import React from 'react';

interface HighlightMatchProps {
  // 2026-06-14 (paras): widened from `string` to `string | null | undefined`.
  // Callers pass nullable DB fields (e.g. keyword, which is null for many web
  // rows). The old `string` type was a lie — null arrived at runtime and the
  // type system couldn't catch it. Now the type tells the truth.
  text?: string | null;
  /** The user's free-text search query. Empty string disables highlighting. */
  query?: string;
}

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

export const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, query }) => {
  // 2026-06-14 (paras): coerce null/undefined to '' so .split() below can never
  // throw. Without this, searching on Saved/Discovered/Find crashed the whole
  // page (caught by the dashboard ErrorBoundary) whenever a visible row had a
  // null highlighted field. Guarding here protects every current + future
  // caller, instead of patching each call site.
  const safeText = text ?? '';
  const q = (query ?? '').trim();
  if (!q) return <>{safeText}</>;

  const pattern = q.replace(REGEX_ESCAPE, '\\$&');
  const parts = safeText.split(new RegExp(`(${pattern})`, 'gi'));
  const lower = q.toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark key={i} className="bg-[#fff4d1] dark:bg-[#ffbf23]/25 text-inherit rounded-sm">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};
