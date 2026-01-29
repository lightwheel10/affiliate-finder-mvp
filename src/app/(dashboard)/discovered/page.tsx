'use client';

/**
 * =============================================================================
 * DISCOVERED AFFILIATES PAGE
 * =============================================================================
 * 
 * Updated: January 3rd, 2026
 * Updated: January 30th, 2026 - Added enrichment status banner & auto-polling
 * 
 * Shows ALL discovered affiliates from all searches.
 * 
 * ARCHITECTURE CHANGE (January 3rd, 2026):
 * -----------------------------------------
 * This page is now part of the (dashboard) route group. The layout handles:
 *   - AuthGuard (authentication + onboarding check)
 *   - ErrorBoundary (error handling)
 *   - Sidebar (navigation - persists across page navigation)
 *   - Main container with ml-52 margin
 * 
 * This page only renders the content: header + main content area + modals.
 * The Sidebar no longer remounts on navigation, eliminating the skeleton flash.
 * 
 * FEATURES:
 * ---------
 * - Bulk selection for save/delete operations (Dec 2025)
 * - Advanced filtering by competitors, topics, subscribers (Dec 2025)
 * - Single item delete with feedback toast (Dec 2025)
 * - Enrichment status banner with auto-polling (Jan 2026)
 * 
 * =============================================================================
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
// =============================================================================
// January 17th, 2026: Added Link for "Find Affiliates" button navigation
// When clicked, routes to /find?openModal=true to auto-open the search modal
// =============================================================================
import Link from 'next/link';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { AffiliateRow } from '../../components/AffiliateRow';
import { ScanCountdown } from '../../components/ScanCountdown';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import { CreditsDisplay } from '../../components/CreditsDisplay';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  Music,
  Plus,
  Check,
  Trash2,
  Save,
  Loader2,
  X,
  Clock  // Added January 6th, 2026 for neo-brutalist header
} from 'lucide-react';
import { ResultItem, FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { FilterPanel } from '../../components/FilterPanel';
import { useNeonUser } from '../../hooks/useNeonUser';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

export default function DiscoveredPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  // User data for filter options (January 13th, 2026)
  const { user } = useNeonUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Data hooks
  const { 
    discoveredAffiliates, 
    removeDiscoveredAffiliate,
    removeDiscoveredAffiliatesBulk,
    isLoading: loading 
  } = useDiscoveredAffiliates();
  
  const { 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved,
    saveAffiliatesBulk
  } = useSavedAffiliates();

  // ============================================================================
  // BULK SELECTION STATE (Added Dec 2025)
  // ============================================================================
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // ============================================================================
  // BULK OPERATION VISUAL FEEDBACK STATE (Added Dec 2025)
  // ============================================================================
  const [savingLinks, setSavingLinks] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bulkSaveResult, setBulkSaveResult] = useState<{
    savedCount: number;
    duplicateCount: number;
    show: boolean;
  } | null>(null);
  
  // ============================================================================
  // DELETE FEEDBACK STATE (Added Dec 2025)
  // ============================================================================
  const [deleteResult, setDeleteResult] = useState<{
    count: number;
    show: boolean;
  } | null>(null);

  // ============================================================================
  // ADVANCED FILTER STATE (Added Dec 2025)
  // ============================================================================
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // ============================================================================
  // ENRICHMENT STATUS STATE (Added January 30, 2026)
  // 
  // Shows a banner when enrichment is in progress and polls for new results.
  // This ensures users see partial results immediately and get updates as
  // more affiliates are discovered.
  // ============================================================================
  const [enrichmentStatus, setEnrichmentStatus] = useState<{
    hasActiveJobs: boolean;
    jobs: Array<{
      jobId: number;
      keyword: string;
      completedActors: number;
      totalActors: number;
      platforms: Record<string, string>;
    }>;
  } | null>(null);
  const [isPollingEnrichment, setIsPollingEnrichment] = useState(false);
  const [previousAffiliateCount, setPreviousAffiliateCount] = useState<number>(0);

  // Check for active enrichment jobs and poll for updates
  const checkEnrichmentStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/search/enrichment-status');
      if (!res.ok) return;
      
      const data = await res.json();
      setEnrichmentStatus(data);
      
      // If there are active jobs and we have a jobId, poll the status endpoint
      // to trigger incremental saves
      if (data.hasActiveJobs && data.jobs.length > 0) {
        for (const job of data.jobs) {
          // Poll status endpoint to trigger incremental saves
          await fetch(`/api/search/status?jobId=${job.jobId}`);
        }
      }
      
      return data.hasActiveJobs;
    } catch (error) {
      console.error('[Discovered] Failed to check enrichment status:', error);
      return false;
    }
  }, []);

  // Start polling when page loads, stop when enrichment completes
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let mounted = true;

    const startPolling = async () => {
      if (!mounted) return;
      
      const hasActive = await checkEnrichmentStatus();
      
      if (hasActive && mounted) {
        setIsPollingEnrichment(true);
        // Poll every 5 seconds while enrichment is active
        pollInterval = setInterval(async () => {
          if (!mounted) return;
          const stillActive = await checkEnrichmentStatus();
          if (!stillActive && mounted) {
            setIsPollingEnrichment(false);
            if (pollInterval) clearInterval(pollInterval);
          }
        }, 5000);
      }
    };

    startPolling();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [checkEnrichmentStatus]);

  // Track affiliate count changes and show toast when new results arrive
  useEffect(() => {
    if (previousAffiliateCount > 0 && discoveredAffiliates.length > previousAffiliateCount) {
      const newCount = discoveredAffiliates.length - previousAffiliateCount;
      toast.success(`${newCount} new affiliate${newCount > 1 ? 's' : ''} found!`);
    }
    setPreviousAffiliateCount(discoveredAffiliates.length);
  }, [discoveredAffiliates.length, previousAffiliateCount]);

  const toggleSave = (item: ResultItem) => {
    if (isAffiliateSaved(item.link)) {
      removeAffiliate(item.link);
    } else {
      saveAffiliate(item);
    }
  };

  const handleSingleDelete = async (link: string) => {
    await removeDiscoveredAffiliate(link);
    setDeleteResult({ count: 1, show: true });
    setTimeout(() => {
      setDeleteResult(prev => prev ? { ...prev, show: false } : null);
    }, 3000);
  };

  // ============================================================================
  // BULK SELECTION HANDLERS (Added Dec 2025)
  // ============================================================================
  const toggleSelectItem = (link: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(link)) {
        newSet.delete(link);
      } else {
        newSet.add(link);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach(r => newSet.add(r.link));
      return newSet;
    });
  };
  
  const deselectAllVisible = () => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach(r => newSet.delete(r.link));
      return newSet;
    });
  };

  const handleBulkSave = async () => {
    if (visibleSelectedLinks.size === 0) return;
    setIsBulkSaving(true);
    setSavingLinks(new Set(visibleSelectedLinks));
    
    try {
      const affiliatesToSave = discoveredAffiliates.filter(r => visibleSelectedLinks.has(r.link));
      const result = await saveAffiliatesBulk(affiliatesToSave);
      
      // =======================================================================
      // SUCCESS STATE - January 16, 2026
      // Sets state to show custom neo-brutalist toast JSX
      // =======================================================================
      setBulkSaveResult({
        savedCount: result.savedCount,
        duplicateCount: result.duplicateCount,
        show: true
      });
      
      setTimeout(() => {
        setBulkSaveResult(prev => prev ? { ...prev, show: false } : null);
      }, 4000);
      
      setSelectedLinks(prev => {
        const newSet = new Set(prev);
        visibleSelectedLinks.forEach(link => newSet.delete(link));
        return newSet;
      });
    } catch (err) {
      console.error('Bulk save failed:', err);
      // January 5th, 2026: Added error toast
      // i18n: January 10th, 2026
      toast.error(t.toasts.error.saveFailed);
    } finally {
      setIsBulkSaving(false);
      setSavingLinks(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (visibleSelectedLinks.size === 0) return;
    setIsDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (visibleSelectedLinks.size === 0) return;
    const deleteCount = visibleSelectedLinks.size;
    setIsBulkDeleting(true);
    try {
      await removeDiscoveredAffiliatesBulk(Array.from(visibleSelectedLinks));
      setSelectedLinks(prev => {
        const newSet = new Set(prev);
        visibleSelectedLinks.forEach(link => newSet.delete(link));
        return newSet;
      });
      setIsDeleteModalOpen(false);
      
      // =======================================================================
      // SUCCESS STATE - January 16, 2026
      // Sets state to show custom neo-brutalist toast JSX
      // =======================================================================
      setDeleteResult({ count: deleteCount, show: true });
      setTimeout(() => {
        setDeleteResult(prev => prev ? { ...prev, show: false } : null);
      }, 3000);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error(t.toasts.error.deleteFailed);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return discoveredAffiliates.filter(item => {
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (
          item.title?.toLowerCase().includes(q) ||
          item.domain?.toLowerCase().includes(q) ||
          (item.keyword && item.keyword.toLowerCase().includes(q))
        );
        if (!matchesSearch) return false;
      }

      // Advanced filters
      if (advancedFilters.competitors.length > 0) {
        if (
          item.discoveryMethod?.type !== 'competitor' ||
          !advancedFilters.competitors.includes(item.discoveryMethod.value)
        ) {
          return false;
        }
      }

      // ========================================================================
      // TOPICS FILTER - BUG FIX January 25, 2026
      // 
      // Previously, this filter matched on item.keyword for ALL affiliates,
      // including those discovered via competitor search. This caused affiliates
      // discovered via "apollo.io" with keyword "bedrop" to incorrectly appear
      // when filtering by topic "bedrop".
      // 
      // FIX: Only match on item.keyword if the affiliate was NOT discovered
      // via competitor or brand search. Topic filter should only show affiliates
      // actually discovered through topic/keyword searches.
      // ========================================================================
      if (advancedFilters.topics.length > 0) {
        const matchesTopic =
          (item.discoveryMethod?.type === 'topic' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.discoveryMethod?.type === 'keyword' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.keyword && advancedFilters.topics.includes(item.keyword) && 
           item.discoveryMethod?.type !== 'competitor' && item.discoveryMethod?.type !== 'brand');
        if (!matchesTopic) return false;
      }

      if (advancedFilters.subscribers) {
        const { min, max } = advancedFilters.subscribers;
        let subCount = 0;
        if (item.channel?.subscribers) {
          subCount = parseSubscriberCount(item.channel.subscribers) || 0;
        } else if (item.instagramFollowers) {
          subCount = item.instagramFollowers;
        } else if (item.tiktokFollowers) {
          subCount = item.tiktokFollowers;
        }
        if (subCount === 0) return false;
        if (min !== undefined && subCount < min) return false;
        if (max !== undefined && subCount > max) return false;
      }

      if (advancedFilters.datePublished) {
        const { start, end } = advancedFilters.datePublished;
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        if (start && itemDate < new Date(start)) return false;
        if (end && itemDate > new Date(end)) return false;
      }

      if (advancedFilters.lastPosted) {
        const { start, end } = advancedFilters.lastPosted;
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        if (start && itemDate < new Date(start)) return false;
        if (end && itemDate > new Date(end)) return false;
      }

      if (advancedFilters.contentCount) {
        const { min, max } = advancedFilters.contentCount;
        let contentCount = 0;
        if (item.instagramPostsCount) {
          contentCount = item.instagramPostsCount;
        } else if (item.tiktokVideosCount) {
          contentCount = item.tiktokVideosCount;
        }
        if (contentCount === 0) return false;
        if (min !== undefined && contentCount < min) return false;
        if (max !== undefined && contentCount > max) return false;
      }

      return true;
    });
  }, [discoveredAffiliates, activeFilter, searchQuery, advancedFilters]);

  const visibleSelectedLinks = useMemo(() => {
    const visibleLinks = new Set(filteredResults.map(r => r.link));
    const visible = new Set<string>();
    selectedLinks.forEach(link => {
      if (visibleLinks.has(link)) {
        visible.add(link);
      }
    });
    return visible;
  }, [selectedLinks, filteredResults]);

  const counts = useMemo(() => {
    return {
      All: discoveredAffiliates.length,
      Web: discoveredAffiliates.filter(r => r.source === 'Web').length,
      YouTube: discoveredAffiliates.filter(r => r.source === 'YouTube').length,
      Instagram: discoveredAffiliates.filter(r => r.source === 'Instagram').length,
      TikTok: discoveredAffiliates.filter(r => r.source === 'TikTok').length,
    };
  }, [discoveredAffiliates]);

  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} className="text-blue-500" />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} className="text-red-600" />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} className="text-pink-600" />, count: counts.Instagram },
    { id: 'TikTok', icon: <Music size={14} className="text-cyan-500" />, count: counts.TikTok },
  ];

  // ==========================================================================
  // RENDER - January 3rd, 2026
  // 
  // Note: The outer container with Sidebar is now handled by the layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* =============================================================================
          TOP BAR - NEW DESIGN (January 6th, 2026)
          Neo-brutalist header - MATCHES DashboardDemo.tsx EXACTLY
          ============================================================================= */}
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 border-b-4 border-black dark:border-white flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a]">
        {/* Page Title - font-black uppercase tracking-tight */}
        <h1 className="font-black text-xl uppercase tracking-tight">{t.dashboard.discovered.pageTitle}</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill - DashboardDemo exact styling */}
          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-black">
            <Clock size={12} />
            <span>{t.dashboard.header.nextScan}</span>
            <ScanCountdown />
            <span className="text-white font-bold">{t.dashboard.header.pro}</span>
          </div>

          {/* Stats Pills - DashboardDemo exact styling */}
          <div className="hidden lg:flex items-center gap-3">
            <CreditsDisplay variant="neo" />
          </div>

          {/* =================================================================
              Find Button - January 17th, 2026: Now functional!
              
              PREVIOUS: Button was non-functional (just styled, no onClick)
              NEW: Wrapped with Link to /find?openModal=true
              
              When clicked:
              1. Navigates to /find page
              2. Query param openModal=true triggers auto-open of search modal
              3. User can immediately start searching without clicking again
              ================================================================= */}
          <Link href="/find?openModal=true">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
            </button>
          </Link>
        </div>
      </header>

      {/* =============================================================================
          ENRICHMENT STATUS BANNER - January 30, 2026
          
          Shows when affiliates are still being discovered in the background.
          Indicates which sources have completed vs still processing.
          ============================================================================= */}
      {enrichmentStatus?.hasActiveJobs && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-b-2 border-amber-200 dark:border-amber-800 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-5 h-5 border-2 border-amber-500 rounded-full animate-spin border-t-transparent"></div>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Still finding more affiliates...
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {enrichmentStatus.jobs.map(job => {
                    const platforms = Object.entries(job.platforms || {});
                    const completed = platforms.filter(([_, status]) => status === 'SUCCEEDED').map(([p]) => p);
                    const running = platforms.filter(([_, status]) => status === 'RUNNING').map(([p]) => p);
                    return (
                      <span key={job.jobId}>
                        {completed.length > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ✓ {completed.join(', ')}
                          </span>
                        )}
                        {completed.length > 0 && running.length > 0 && ' • '}
                        {running.length > 0 && (
                          <span>Processing: {running.join(', ')}</span>
                        )}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-amber-600 dark:text-amber-400">
              {enrichmentStatus.jobs[0] && (
                <span>{enrichmentStatus.jobs[0].completedActors}/{enrichmentStatus.jobs[0].totalActors} sources</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          
          OVERFLOW FIX - January 23, 2026
          Added overflow-x-hidden to prevent horizontal scrolling when results table
          renders with long content. This ensures the filter bar stays visible.
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            
            LAYOUT FIX - January 23, 2026
            FilterPanel now uses a dropdown approach so filter pills don't take 
            up horizontal space.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Search Input - Translated (January 9th, 2026) */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder={t.dashboard.filters.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-black dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-[#ffbf23]"
              />
            </div>
            
            {/* Platform Filter Pills - DashboardDemo exact styling with counts */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded border border-gray-200 dark:border-gray-800">
              {filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded transition-colors text-xs font-bold",
                    activeFilter === tab.id
                      ? "bg-[#ffbf23] text-black shadow-sm"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                  title={tab.id}
                >
                  {tab.icon || <Globe size={16} />}
                  {tab.id === 'All' && <span>{t.dashboard.filters.all}</span>}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                      activeFilter === tab.id ? "bg-black/20 text-black" : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Advanced Filter */}
          {/* January 13th, 2026: Pass onboarding data for filter options */}
          {/* January 23, 2026: Filter pills now render in dropdown, not inline */}
          <div className="flex items-center gap-3">
            <FilterPanel
              affiliates={discoveredAffiliates}
              activeFilters={advancedFilters}
              onFilterChange={setAdvancedFilters}
              isOpen={isFilterPanelOpen}
              onClose={() => setIsFilterPanelOpen(false)}
              onOpen={() => setIsFilterPanelOpen(true)}
              userCompetitors={user?.competitors || undefined}
              userTopics={user?.topics || undefined}
            />
          </div>
        </div>

        {/* =============================================================================
            BULK ACTIONS BAR - NEO-BRUTALIST DESIGN
            Updated: January 16, 2026
            
            Matches the Saved page styling for design consistency across dashboard.
            - Yellow (#ffbf23) accent color with black borders
            - font-black uppercase text
            - Neo-brutalist shadow-[2px_2px_0px_0px_#000] on buttons
            ============================================================================= */}
        {visibleSelectedLinks.size > 0 && (() => {
          const alreadySavedCount = Array.from(visibleSelectedLinks).filter(link => isAffiliateSaved(link)).length;
          const newToSaveCount = visibleSelectedLinks.size - alreadySavedCount;
          const allVisibleSelected = visibleSelectedLinks.size === filteredResults.length;
          
          return (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Checkbox icon - Neo-brutalist yellow square */}
                <div className="w-6 h-6 bg-[#ffbf23] border-2 border-black flex items-center justify-center">
                  <Check size={14} className="text-black" />
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {visibleSelectedLinks.size} {t.dashboard.find.bulkActions.selected}
                </span>
                {alreadySavedCount > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border-2 border-emerald-200 px-2 py-0.5">
                    {alreadySavedCount} {t.dashboard.find.bulkActions.alreadyInPipeline}
                  </span>
                )}
              </div>
              <div className="h-4 w-0.5 bg-black dark:bg-gray-600"></div>
              <button
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                className="text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                {allVisibleSelected ? t.dashboard.find.bulkActions.deselectAll : t.dashboard.find.bulkActions.selectAllVisible}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Cancel button - Neo-brutalist outline */}
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white transition-all"
              >
                <X size={14} />
                {t.common.cancel}
              </button>
              {/* Delete button - Neo-brutalist red */}
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t.dashboard.find.bulkActions.deleteSelected}
              </button>
              {/* Save button - Neo-brutalist yellow */}
              <button
                onClick={handleBulkSave}
                disabled={isBulkSaving || newToSaveCount === 0}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase transition-all border-2",
                  newToSaveCount === 0
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                    : "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title={newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${t.dashboard.find.bulkActions.saveToPipeline} (${newToSaveCount})`}
              >
                {isBulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${newToSaveCount} ${t.dashboard.find.bulkActions.saveToPipeline}`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE AREA - DashboardDemo.tsx EXACT STYLING
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col">
          {/* Table Header - Translated (January 9th, 2026) */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input 
                type="checkbox" 
                checked={filteredResults.length > 0 && visibleSelectedLinks.size === filteredResults.length}
                onChange={() => visibleSelectedLinks.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
                className="accent-[#ffbf23] w-4 h-4" 
              />
            </div>
            <div className="col-span-3">{t.dashboard.table.affiliate}</div>
            <div className="col-span-3">{t.dashboard.table.relevantContent}</div>
            <div className="col-span-2">{t.dashboard.table.discoveryMethod}</div>
            <div className="col-span-1">{t.dashboard.table.date}</div>
            <div className="col-span-2 text-right">{t.dashboard.table.action}</div>
          </div>

          {/* Results Content */}
          <div className="flex-1">
          {loading ? (
            /* Loading State - Neo-brutalist style */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#ffbf23] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-500 text-sm mt-4 font-medium">{t.dashboard.discovered.loading}</p>
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((item) => (
              <AffiliateRow 
                key={item.link}
                title={item.title}
                domain={item.domain}
                link={item.link}
                source={item.source}
                rank={item.rank}
                keyword={item.keyword}
                isSaved={isAffiliateSaved(item.link)}
                onSave={() => toggleSave(item)}
                thumbnail={item.thumbnail}
                views={item.views}
                date={item.date}
                snippet={item.snippet}
                highlightedWords={item.highlightedWords}
                discoveryMethod={item.discoveryMethod}
                email={item.email}
                channel={item.channel}
                duration={item.duration}
                personName={item.personName}
                isSelected={selectedLinks.has(item.link)}
                onSelect={toggleSelectItem}
                isSaving={savingLinks.has(item.link)}
                onDelete={() => handleSingleDelete(item.link)}
                affiliateData={item}
                // Match reasons in View Modal (Discovered page) - January 22, 2026
                currentUser={user}
              />
            ))
          ) : (
            /* Empty State - Neo-brutalist style - Translated (January 9th, 2026) */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Search size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                {t.dashboard.discovered.emptyState.title}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                {t.dashboard.discovered.emptyState.subtitle}
              </p>
            </div>
          )}
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        itemCount={visibleSelectedLinks.size}
        isDeleting={isBulkDeleting}
        itemType="affiliate"
      />

      {/* =============================================================================
          BULK SAVE FEEDBACK TOAST - NEO-BRUTALIST DESIGN
          Updated: January 16, 2026
          ============================================================================= */}
      {/* January 17, 2026: Updated with i18n translations */}
      {bulkSaveResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_#000] p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-500 border-2 border-black flex items-center justify-center shrink-0">
                <Check size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {bulkSaveResult.savedCount > 0 
                    ? `${bulkSaveResult.savedCount} ${t.dashboard.find.toasts.affiliatesSaved}`
                    : t.dashboard.find.toasts.noNewAffiliatesSaved
                  }
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {bulkSaveResult.savedCount > 0 && t.dashboard.find.toasts.addedToPipeline}
                  {bulkSaveResult.duplicateCount > 0 && (
                    <span className="block text-amber-600 font-bold mt-1">
                      {bulkSaveResult.duplicateCount} {t.dashboard.find.toasts.alreadyInPipeline}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setBulkSaveResult(prev => prev ? { ...prev, show: false } : null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================
          DELETE FEEDBACK TOAST - NEO-BRUTALIST DESIGN
          Updated: January 16, 2026
          ============================================================================= */}
      {/* January 17, 2026: Updated with i18n translations */}
      {deleteResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_#000] p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500 border-2 border-black flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {deleteResult.count === 1 
                    ? t.dashboard.find.toasts.affiliateDeleted
                    : `${deleteResult.count} ${t.dashboard.find.toasts.affiliatesDeleted}`
                  }
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {t.dashboard.find.toasts.removedFromDiscovered}
                </p>
              </div>
              <button
                onClick={() => setDeleteResult(prev => prev ? { ...prev, show: false } : null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

