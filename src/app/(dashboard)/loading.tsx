/**
 * =============================================================================
 * DASHBOARD LOADING - January 3rd, 2026
 * =============================================================================
 * 
 * This loading state is shown by Next.js during page transitions within the
 * (dashboard) route group using React Suspense.
 * 
 * IMPORTANT: Since the layout contains Sidebar, and the layout stays mounted
 * during navigation, the Sidebar will remain visible while this loading state
 * is shown for the main content area.
 * 
 * This creates a smooth transition where:
 * 1. Sidebar stays intact (no skeleton)
 * 2. Only the main content area shows loading state
 * 
 * =============================================================================
 */

/**
 * ContentLoadingSkeleton - January 3rd, 2026
 * 
 * A skeleton that matches the general page content structure.
 * Shows:
 * - Header skeleton
 * - Content area skeleton
 * 
 * NOTE: This does NOT include Sidebar - the layout handles that.
 */
function ContentLoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton - matches h-12 header in pages */}
      <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded"></div>
        </div>
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-6 w-24 bg-slate-100 rounded-lg"></div>
          <div className="h-8 w-32 bg-slate-200 rounded-lg"></div>
        </div>
      </header>

      {/* Content Skeleton */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full animate-pulse">
        <div className="space-y-6">
          {/* Controls bar skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-8 w-40 bg-slate-100 rounded-lg"></div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-slate-100 rounded-lg"></div>
              <div className="h-8 w-16 bg-slate-100 rounded-lg"></div>
              <div className="h-8 w-16 bg-slate-100 rounded-lg"></div>
            </div>
          </div>

          {/* Content rows skeleton */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0"
              >
                <div className="w-5 h-5 bg-slate-100 rounded"></div>
                <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-200 rounded"></div>
                  <div className="h-3 w-32 bg-slate-100 rounded"></div>
                </div>
                <div className="h-6 w-20 bg-slate-100 rounded-lg"></div>
                <div className="h-6 w-16 bg-slate-100 rounded-lg"></div>
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

