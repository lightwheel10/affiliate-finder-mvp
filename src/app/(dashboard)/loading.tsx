/**
 * =============================================================================
 * DASHBOARD LOADING — Content Skeleton
 * =============================================================================
 *
 * January 8th, 2026 — Neo-brutalist content skeleton
 *   Sharp edges, bold borders (border-2 to border-4 with black), offset
 *   shadows, yellow accent color (#ffbf23), dark mode support.
 *
 * April 23rd, 2026 — "Smoover" header refresh (Phase 2d)
 *   The top <header> skeleton now matches the new unified dashboard header
 *   (hairline border, sticky, rounded pulse blocks). The content rows below
 *   still use the neo-brutalist skeleton because the actual pages (Find New,
 *   Discovered, Saved, Outreach) haven't been restyled below the header yet.
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
 *   - Header skeleton (smoover: hairline border, rounded pulse blocks)
 *   - Content area skeleton (neo-brutalist: sharp edges, offset borders)
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

      {/* Content Skeleton - NEO-BRUTALIST */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full animate-pulse">
        <div className="space-y-6">
          {/* Controls bar skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-8 w-40 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
              <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
              <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
            </div>
          </div>

          {/* Content rows skeleton - NEO-BRUTALIST with sharp edges */}
          <div className="bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 px-4 py-3 border-b-2 border-gray-200 dark:border-gray-700 last:border-0"
              >
                <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800"></div>
                </div>
                <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
                <div className="h-6 w-16 bg-[#ffbf23]/30 border-2 border-gray-200 dark:border-gray-700"></div>
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
