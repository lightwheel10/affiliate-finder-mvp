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
import { useBlockedDomains } from '../../hooks/useBlockedDomains';
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
// April 28, 2026: Unified search predicate (Find/Discovered/Saved) — see utils/affiliate-search.ts
import { affiliateMatchesSearchQuery } from '../../utils/affiliate-search';
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

  const { blockDomain, isBlocked, blockedDomains, isAtLimit: isBlockLimitReached } = useBlockedDomains();

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

  const normalizeDomainForCompare = (d: string) => (d || '').toLowerCase().replace(/^www\./, '');

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return discoveredAffiliates.filter(item => {
      if (isBlocked(item.domain)) return false;
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;

      // April 28, 2026: Now uses the shared affiliateMatchesSearchQuery helper.
      // Previously matched only on title / domain / keyword. The helper adds
      // snippet + personName + summary + channel.name + IG/TT username/display
      // name so users can find creators by handle/name. Find + Saved use the
      // same helper. See utils/affiliate-search.ts for the full field list.
      if (searchQuery && !affiliateMatchesSearchQuery(item, searchQuery)) {
        return false;
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
  }, [discoveredAffiliates, activeFilter, searchQuery, advancedFilters, isBlocked]);

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

  const [isBulkBlocking, setIsBulkBlocking] = useState(false);
  const handleBulkBlockDomains = useCallback(async () => {
    if (visibleSelectedLinks.size === 0) return;
    const selectedItems = filteredResults.filter(r => selectedLinks.has(r.link));
    const domainsToBlock = [...new Set(selectedItems.map(r => normalizeDomainForCompare(r.domain)))];
    const canAdd = Math.max(0, 10 - blockedDomains.length);
    const toBlock = domainsToBlock.slice(0, canAdd);
    if (toBlock.length === 0) {
      toast.error(t.dashboard.find.bulkActions.blockLimitReached);
      return;
    }
    setIsBulkBlocking(true);
    try {
      for (const domain of toBlock) {
        await blockDomain(domain);
      }
      setSelectedLinks(prev => {
        const next = new Set(prev);
        selectedItems.filter(r => toBlock.includes(normalizeDomainForCompare(r.domain))).forEach(r => next.delete(r.link));
        return next;
      });
      toast.success(toBlock.length === 1 ? t.dashboard.find.bulkActions.blockDomainDone : `${toBlock.length} ${t.dashboard.find.bulkActions.blockDomainsDone}`);
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to block domain');
    } finally {
      setIsBulkBlocking(false);
    }
  }, [visibleSelectedLinks.size, filteredResults, selectedLinks, blockedDomains.length, blockDomain, t.dashboard.find.bulkActions]);

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
          TOP BAR — SMOOVER REFRESH (April 23rd, 2026 · Phase 2d)
          Unified sticky dashboard header: hairline border, Archivo display title,
          rounded yellow CTA matching the landing page hero button.
          Previously neo-brutalist (Jan 6, 2026) — see git blame for prior version.
          ============================================================================= */}
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        {/* Page Title — Archivo display, bold, normal case (matches sidebar brand + landing) */}
        <h1 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">{t.dashboard.discovered.pageTitle}</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill — softer slate bg + hairline border + subtle lift */}
          <div className="hidden md:flex items-center gap-2 bg-[#0f172a] dark:bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-[#0f172a]/10 dark:border-gray-800 shadow-soft-sm">
            <Clock size={12} />
            <span>{t.dashboard.header.nextScan}</span>
            <ScanCountdown />
            <span className="text-white font-semibold">{t.dashboard.header.pro}</span>
          </div>

          {/* Credits pills — visual refresh lives inside CreditsDisplay.tsx ("neo" variant) */}
          <div className="hidden lg:flex items-center gap-3">
            <CreditsDisplay variant="neo" />
          </div>

          {/* =================================================================
              Find Button — January 17th, 2026: functional, wrapped in Link.
              Smoover refresh (April 23rd, 2026): rounded-full yellow CTA with
              soft glow, matching the landing hero button. Behavior unchanged:
              clicking navigates to /find?openModal=true which auto-opens the
              search modal.
              ================================================================= */}
          <Link href="/find?openModal=true">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-[#0f172a] font-semibold text-sm rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-0.5 transition-all duration-200"
            >
              <Plus size={14} strokeWidth={2.5} /> {t.dashboard.header.findAffiliates}
            </button>
          </Link>
        </div>
      </header>

      {/* =============================================================================
          ENRICHMENT STATUS BANNER
          ---------------------------------------------------------------------------
          HISTORY:
            Jan 30, 2026 — Introduced. Shows while background enrichment jobs
                           are running; indicates which sources have completed
                           vs which are still processing.
            Apr 23, 2026 — Smoover refresh (Phase 2e). Previously border-b-2
                           amber + font-bold headings. Now softened to a
                           hairline border-b, lighter spinner ring, font-
                           semibold headings. Gradient fill + semantic amber/
                           emerald colours preserved so the warning signal is
                           not lost.
          ============================================================================= */}
      {enrichmentStatus?.hasActiveJobs && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-5 h-5 border-[2px] border-amber-500 rounded-full animate-spin border-t-transparent"></div>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
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
            FILTERS ROW
            
            LAYOUT FIX - January 23, 2026
            FilterPanel now uses a dropdown approach so filter pills don't take 
            up horizontal space.

            SMOOVER REFRESH - April 23, 2026
            Mirrored from find/page.tsx. Scope: search input + platform pill
            segmented control on the LEFT side only. See find/page.tsx for the
            full rationale (hairline borders, rounded-full pills, soft shadows,
            yellow glow on active state, muted text colors). NOTE: the count
            badge here renders whenever `tab.count > 0` (no `hasSearched &&`
            gate, unlike the find page) — that per-page difference is preserved.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Search Input — Translated (January 9th, 2026).
                Smoover refresh (April 23, 2026) — see find/page.tsx. */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#8898aa]" size={16} />
              <input 
                type="text" 
                placeholder={t.dashboard.filters.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-4 border border-[#e6ebf1] dark:border-gray-800 rounded-full bg-white dark:bg-[#0f0f0f] text-sm text-[#0f172a] dark:text-white placeholder:text-[#8898aa] focus:outline-none focus:border-[#ffbf23] focus:shadow-yellow-glow-sm transition-all"
              />
            </div>
            
            {/* Platform Filter Pills — segmented control.
                Smoover refresh (April 23, 2026) — see find/page.tsx. */}
            <div className="flex items-center gap-1 bg-[#f6f9fc] dark:bg-[#0f0f0f] p-1 rounded-full border border-[#e6ebf1] dark:border-gray-800 shadow-soft-sm">
              {filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-semibold",
                    activeFilter === tab.id
                      ? "bg-[#ffbf23] text-[#0f172a] shadow-yellow-glow-sm"
                      : "text-[#8898aa] hover:text-[#425466] dark:hover:text-gray-300"
                  )}
                  title={tab.id}
                >
                  {tab.icon || <Globe size={16} />}
                  {tab.id === 'All' && <span>{t.dashboard.filters.all}</span>}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                      activeFilter === tab.id
                        ? "bg-[#0f172a]/10 text-[#0f172a]"
                        : "bg-white dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 border border-[#e6ebf1] dark:border-gray-700"
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
            BULK ACTIONS BAR
            Smoover refresh (April 23rd, 2026) — Phase 2e
            Mirror of /find bulk bar (same structure, same translations).
            See find/page.tsx for full rationale.
            ============================================================================= */}
        {visibleSelectedLinks.size > 0 && (() => {
          const alreadySavedCount = Array.from(visibleSelectedLinks).filter(link => isAffiliateSaved(link)).length;
          const newToSaveCount = visibleSelectedLinks.size - alreadySavedCount;
          const allVisibleSelected = visibleSelectedLinks.size === filteredResults.length;
          
          return (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Checkbox icon — rounded yellow badge with soft glow */}
                <div className="w-6 h-6 bg-[#ffbf23] rounded-full flex items-center justify-center shadow-yellow-glow-sm">
                  <Check size={14} className="text-[#0f172a]" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-[#0f172a] dark:text-white">
                  {visibleSelectedLinks.size} {t.dashboard.find.bulkActions.selected}
                </span>
                {alreadySavedCount > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {alreadySavedCount} {t.dashboard.find.bulkActions.alreadyInPipeline}
                  </span>
                )}
              </div>
              <div className="h-4 w-px bg-[#e6ebf1] dark:bg-gray-800"></div>
              <button
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                className="text-xs font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
              >
                {allVisibleSelected ? t.dashboard.find.bulkActions.deselectAll : t.dashboard.find.bulkActions.selectAllVisible}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Cancel — soft outline */}
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white border border-[#e6ebf1] dark:border-gray-800 rounded-full hover:bg-[#f6f9fc] dark:hover:bg-gray-900 transition-all"
              >
                <X size={14} strokeWidth={2} />
                {t.common.cancel}
              </button>
              {/* Block domain(s) — amber warning */}
              <button
                onClick={handleBulkBlockDomains}
                disabled={isBlockLimitReached || isBulkBlocking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-full shadow-soft-sm hover:bg-amber-600 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                title={isBlockLimitReached ? t.dashboard.find.bulkActions.blockLimitReached : t.dashboard.find.bulkActions.blockDomains}
              >
                {isBulkBlocking ? <Loader2 size={14} className="animate-spin" /> : null}
                {t.dashboard.find.bulkActions.blockDomains}
              </button>
              {/* Delete — destructive red */}
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-full shadow-soft-sm hover:bg-red-600 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                {t.dashboard.find.bulkActions.deleteSelected}
              </button>
              {/* Save — primary yellow CTA */}
              <button
                onClick={handleBulkSave}
                disabled={isBulkSaving || newToSaveCount === 0}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all",
                  newToSaveCount === 0
                    ? "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] border border-[#e6ebf1] dark:border-gray-700 cursor-not-allowed"
                    : "bg-[#ffbf23] text-[#0f172a] shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
                title={newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${t.dashboard.find.bulkActions.saveToPipeline} (${newToSaveCount})`}
              >
                {isBulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
                {newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${newToSaveCount} ${t.dashboard.find.bulkActions.saveToPipeline}`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE AREA — smoover refresh (April 25, 2026)
            -----------------------------------------------------------------------------
            Brutalist border-4 + heavy column header -> hairline rounded-xl shell
            with soft tinted header (matches Settings -> Plan invoice table from
            PR #33 and the Find / Saved page tables).

            Outer:  border-4 border-gray-200 + rounded-lg
                    -> border border-[#e6ebf1] + rounded-xl + shadow-soft-sm.
            Header: border-b-2 + font-black + text-gray-400 + tracking-widest
                    -> bg-[#f6f9fc] subtle tint + hairline border-b + font-
                    semibold + text-[#8898aa] + tracking-wider (smoover eyebrow).

            Behaviour preserved: 12-column grid, identical column spans, all
            i18n keys, accent-[#ffbf23] checkbox. The full design rationale +
            "must stay in sync" callout lives in /find/page.tsx above the
            equivalent block — mirror any future visual tweak across all 3
            dashboard tables.
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl shadow-soft-sm min-h-[500px] flex flex-col">
          {/* Table Header — smoover (Apr 25, 2026); see docblock above. */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#f6f9fc] dark:bg-gray-800/50 border-b border-[#e6ebf1] dark:border-gray-800 text-[10px] font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
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
            /* =========================================================================
               LOADING STATE
               Smoover refresh (April 23rd, 2026) — Phase 2e
               Ring weights dropped 4 → 3, gray track uses hairline #e6ebf1,
               label uses muted #8898aa.
               ========================================================================= */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 border-[3px] border-[#e6ebf1] dark:border-gray-800 rounded-full"></div>
                <div className="absolute inset-0 border-[3px] border-[#ffbf23] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-[#8898aa] text-sm mt-4 font-medium">{t.dashboard.discovered.loading}</p>
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
                currentUser={user}
                searchQuery={searchQuery}
              />
            ))
          ) : (
            /* =========================================================================
               EMPTY STATE — Smoover refresh (April 23rd, 2026) — Phase 2e
               Soft icon badge + font-semibold heading + muted body.
               ========================================================================= */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-[#f6f9fc] dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-[#e6ebf1] dark:border-gray-800 shadow-soft-sm">
                <Search size={24} className="text-[#8898aa]" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold text-[#0f172a] dark:text-white mb-1">
                {t.dashboard.discovered.emptyState.title}
              </h3>
              <p className="text-[#8898aa] text-sm max-w-xs">
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
          DASHBOARD FEEDBACK TOASTS — smoover refresh (April 25, 2026)
          -----------------------------------------------------------------------------
          Bulk-save success + delete toasts. Same template + same brutalist
          -> smoover mapping as on /find and /saved. Full design rationale
          lives in /find/page.tsx above the equivalent block — mirror any
          future visual tweak across all three files for consistency.
          Behaviour preserved 1:1 (positioning, animation, dismiss handler,
          every i18n key — these even share the t.dashboard.find.toasts.*
          dictionary with /find).
          ============================================================================= */}
      {bulkSaveResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 shadow-soft-sm">
                <Check size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[#0f172a] dark:text-white">
                  {bulkSaveResult.savedCount > 0
                    ? `${bulkSaveResult.savedCount} ${t.dashboard.find.toasts.affiliatesSaved}`
                    : t.dashboard.find.toasts.noNewAffiliatesSaved
                  }
                </h4>
                <p className="text-xs text-[#425466] dark:text-gray-400 mt-0.5">
                  {bulkSaveResult.savedCount > 0 && t.dashboard.find.toasts.addedToPipeline}
                  {bulkSaveResult.duplicateCount > 0 && (
                    <span className="block text-amber-600 font-semibold mt-1">
                      {bulkSaveResult.duplicateCount} {t.dashboard.find.toasts.alreadyInPipeline}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setBulkSaveResult(prev => prev ? { ...prev, show: false } : null)}
                aria-label="Dismiss"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors shrink-0"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete feedback toast — smoover (Apr 25, 2026); see docblock above. */}
      {deleteResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shrink-0 shadow-soft-sm">
                <Trash2 size={20} className="text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[#0f172a] dark:text-white">
                  {deleteResult.count === 1
                    ? t.dashboard.find.toasts.affiliateDeleted
                    : `${deleteResult.count} ${t.dashboard.find.toasts.affiliatesDeleted}`
                  }
                </h4>
                <p className="text-xs text-[#425466] dark:text-gray-400 mt-0.5">
                  {t.dashboard.find.toasts.removedFromDiscovered}
                </p>
              </div>
              <button
                onClick={() => setDeleteResult(prev => prev ? { ...prev, show: false } : null)}
                aria-label="Dismiss"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors shrink-0"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

