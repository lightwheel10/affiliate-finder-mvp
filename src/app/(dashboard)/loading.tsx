/**
 * =============================================================================
 * DASHBOARD LOADING — Content Skeleton
 * =============================================================================
 *
 * January 8th,  2026 — Neo-brutalist content skeleton (border-2/4, sharp
 *                       edges, offset borders).
 * April 23rd,   2026 — "Smoover" header refresh (Phase 2d). The top <header>
 *                       skeleton was updated to match the unified dashboard
 *                       header (hairline border, sticky, rounded pulse blocks).
 *                       Content rows below remained brutalist.
 * April 25th,   2026 — "Smoover" content-skeleton refresh. The control-bar
 *                       chips + the rows container + every internal pulse
 *                       block are now smoover so the skeleton matches the
 *                       smoovered Find / Discovered / Saved tables and
 *                       AffiliateRow visuals (PRs #33, #35 + dashboard
 *                       tables-toasts-loading PR).
 *
 * Smoover refresh — April 25, 2026
 *   - Control-bar chips: `border-2 border-gray-200` -> `border border-
 *     [#e6ebf1] + rounded-md`. Pulse bg `bg-gray-100` -> `bg-[#f6f9fc]`
 *     (matches the header skeleton's `rounded-md bg-[#f6f9fc]` pattern).
 *   - Rows container: `border-4 border-black` -> `border border-[#e6ebf1]
 *     + rounded-xl + shadow-soft-sm` (mirrors the live table shells on
 *     /find /discovered /saved).
 *   - Row dividers: `border-b-2 border-gray-200` -> `border-b border-
 *     [#e6ebf1]` (hairline).
 *   - Row pulse blocks: all `border-2 border-gray-200` -> hairline +
 *     rounded-md + soft #f6f9fc bg.
 *   - The yellow `[#ffbf23]/30` action chip keeps its yellow tint as a
 *     visual reminder that an action button lives there, but the heavy
 *     gray border drops to a hairline yellow tint border.
 *
 * This loading state is shown by Next.js during page transitions within the
 * (dashboard) route group using React Suspense. Because the layout contains
 * the Sidebar and stays mounted during navigation, only the main content
 * area shows this loading state — Sidebar remains visible.
 * =============================================================================
 */

/**
 * ContentLoadingSkeleton
 *
 * A skeleton that matches the page content structure. Shows:
 *   - Header skeleton (smoover, Apr 23 refresh — hairline border, rounded
 *     pulse blocks).
 *   - Content area skeleton (smoover, Apr 25 refresh — same hairline +
 *     rounded language as the dashboard tables).
 *
 * NOTE: Does NOT include Sidebar — the dashboard layout handles that.
 */
function ContentLoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton — SMOOVER (April 23rd, 2026 · Phase 2d): matches the unified dashboard header */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        <div className="animate-pulse">
          <div className="h-5 w-40 rounded-md bg-[#f6f9fc] dark:bg-gray-800"></div>
        </div>
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-6 w-24 rounded-full bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
          <div className="h-8 w-32 rounded-full bg-[#ffbf23]/30 border border-[#ffbf23]/30"></div>
        </div>
      </header>

      {/* Content Skeleton — SMOOVER (April 25, 2026): matches the smoover table chrome on /find /discovered /saved. */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full animate-pulse">
        <div className="space-y-6">
          {/* Controls bar skeleton — hairline rounded chips with soft #f6f9fc bg. */}
          <div className="flex items-center gap-4">
            <div className="h-8 w-40 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
            <div className="h-8 w-px bg-[#e6ebf1] dark:bg-gray-700"></div>
            <div className="flex gap-2">
              <div className="h-8 w-16 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
              <div className="h-8 w-16 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
              <div className="h-8 w-16 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
            </div>
          </div>

          {/* Content rows skeleton — smoover rounded-xl shell with hairline row dividers. */}
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl shadow-soft-sm overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b border-[#e6ebf1] dark:border-gray-800 last:border-0"
              >
                <div className="w-5 h-5 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
                <div className="w-10 h-10 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded-md bg-[#f6f9fc] dark:bg-gray-700"></div>
                  <div className="h-3 w-32 rounded-md bg-[#f6f9fc] dark:bg-gray-800"></div>
                </div>
                <div className="h-6 w-20 rounded-md bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700"></div>
                <div className="h-6 w-16 rounded-full bg-[#ffbf23]/30 border border-[#ffbf23]/30"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Loading() {
  return <ContentLoadingSkeleton />;
}
