/**
 * =============================================================================
 * DASHBOARD LOADING - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Offset shadows
 * - Yellow accent color (#ffbf23)
 * - Dark mode support
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
 * ContentLoadingSkeleton - NEO-BRUTALIST (Updated January 8th, 2026)
 * 
 * A skeleton that matches the neo-brutalist page content structure.
 * Shows:
 * - Header skeleton with bold border
 * - Content area skeleton with sharp edges
 * 
 * NOTE: This does NOT include Sidebar - the layout handles that.
 */
function ContentLoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton - NEO-BRUTALIST (h-16 with border-b-4) */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b-4 border-black dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700"></div>
        </div>
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-6 w-24 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
          <div className="h-8 w-32 bg-[#ffbf23]/30 border-2 border-gray-200 dark:border-gray-700"></div>
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
