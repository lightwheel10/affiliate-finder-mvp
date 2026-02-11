'use client';

/**
 * =============================================================================
 * FIND NEW AFFILIATES PAGE - January 3rd, 2026
 * Updated: January 29, 2026 - Migrated from streaming to polling architecture
 * =============================================================================
 * 
 * This page provides the main "Find New Affiliates" functionality:
 *   - Multi-keyword search across YouTube, Instagram, TikTok, and Web
 *   - Polling-based results with progress indicator
 *   - Bulk selection and save to pipeline
 *   - Advanced filtering by platform, subscribers, date, etc.
 * 
 * SEARCH ARCHITECTURE (January 29, 2026):
 * ---------------------------------------
 * Uses polling-based approach via usePollingSearch hook:
 *   1. POST /api/search/start → starts Apify run, returns jobId
 *   2. GET /api/search/status?jobId=X → poll until done
 *   3. Status endpoint handles enrichment and filtering server-side
 *   4. Final results returned with all metadata (followers, views, etc.)
 * 
 * This replaced the previous streaming approach (/api/scout) to avoid
 * Vercel timeout issues with Apify's 40-95 second search duration.
 * 
 * LAYOUT NOTES:
 * -------------
 * This page is part of the (dashboard) route group, which means:
 *   - URL is /find (not /(dashboard)/find)
 *   - Sidebar is rendered in the parent layout.tsx (not here)
 *   - AuthGuard is also in the parent layout.tsx
 *   - Navigation to other dashboard pages won't remount the Sidebar
 * 
 * =============================================================================
 */

import { useState, useMemo, useEffect, useRef } from 'react';
// =============================================================================
// January 17th, 2026: Added useSearchParams for auto-open modal feature
// When user clicks "Find Affiliates" button on other pages (discovered, saved,
// outreach), they are routed to /find?openModal=true and the modal opens
// automatically. See useEffect below that handles this.
// =============================================================================
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { AffiliateRow } from '../../components/AffiliateRow';
import { AffiliateRowSkeleton } from '../../components/AffiliateRowSkeleton';
import { Modal } from '../../components/Modal';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import { ScanCountdown } from '../../components/ScanCountdown';
import { CreditsDisplay } from '../../components/CreditsDisplay';
import { useNeonUser } from '../../hooks/useNeonUser';
import { 
  Plus, 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  Music,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Save,
  Loader2,
  X,
  Clock,  // Added January 6th, 2026 for neo-brutalist header
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultItem, FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../../hooks/useAffiliates';
import { useBlockedDomains } from '../../hooks/useBlockedDomains';
import { usePollingSearch, SearchProgress } from '../../hooks/usePollingSearch';
import { FilterPanel } from '../../components/FilterPanel';
import { Platform } from '../../services/search';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

// Helper to format traffic numbers (e.g., 1234567 → "1.2M")
function formatTraffic(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const MAX_KEYWORDS = 5;

export default function FindNewPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  
  // ==========================================================================
  // AUTO-OPEN MODAL FROM URL PARAM - January 17th, 2026
  // 
  // PURPOSE:
  // When users click the "Find Affiliates" button on other pages (discovered,
  // saved, outreach), they are routed to /find?openModal=true. This hook
  // reads that query parameter.
  // 
  // WHY THIS EXISTS:
  // Previously, the "Find Affiliates" buttons on other pages were non-functional
  // (just styled elements with no onClick handler). Now they route here AND
  // automatically open the search modal for a seamless user experience.
  // 
  // HOW IT WORKS:
  // 1. User clicks "Find Affiliates" on /discovered, /saved, or /outreach
  // 2. Link navigates to /find?openModal=true
  // 3. This component reads the searchParams
  // 4. useEffect below detects openModal=true and opens the modal
  // ==========================================================================
  const searchParams = useSearchParams();
  
  // ==========================================================================
  // USER DATA - January 4th, 2026
  // 
  // Get user object from useNeonUser to access onboarding data:
  // - user.brand: The user's website URL entered during onboarding
  // - user.competitors: Array of competitor URLs entered during onboarding
  // These are displayed in the "Find Affiliates" modal instead of placeholders.
  // ==========================================================================
  const { userId, user } = useNeonUser();
  
  // Hooks for data management
  const { 
    savedAffiliates, 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved,
    saveAffiliatesBulk,
    isLoading: savedLoading 
  } = useSavedAffiliates();
  
  const { 
    discoveredAffiliates, 
    saveDiscoveredAffiliate,
    saveDiscoveredAffiliates,
    removeDiscoveredAffiliate,
    removeDiscoveredAffiliatesBulk,
    isLoading: discoveredLoading
  } = useDiscoveredAffiliates();

  const { blockedDomains, blockDomain, isBlocked, isAtLimit: isBlockLimitReached } = useBlockedDomains();

  // ==========================================================================
  // POLLING SEARCH HOOK - January 29, 2026
  // 
  // Replaces streaming /api/scout with polling /api/search/start + /api/search/status
  // This avoids Vercel timeout issues with long-running Apify searches.
  // ==========================================================================
  const { 
    searchWithPolling, 
    cancelSearch, 
    isSearching: isPollingSearching,
    progress: searchProgress,
    error: searchError,
  } = usePollingSearch();

  // Multiple keywords support
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showWarning, setShowWarning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [groupByDomain, setGroupByDomain] = useState(false);

  // ============================================================================
  // BULK SELECTION STATE (Added Dec 2025)
  // Tracks which affiliates are selected for bulk operations (save/delete)
  // Uses Set<string> with link as unique identifier for O(1) lookups
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
  // CREDIT ERROR STATE - January 4th, 2026
  // 
  // Tracks when a search fails due to insufficient topic_search credits.
  // When the API returns 402 (Payment Required), we display an error banner
  // instead of silently showing "No results found".
  // 
  // This provides clear feedback to users about WHY the search failed,
  // rather than making them think there were simply no matching affiliates.
  // ============================================================================
  const [creditError, setCreditError] = useState<{
    message: string;
    remaining: number;
  } | null>(null);

  // ============================================================================
  // ADVANCED FILTER STATE (Added Dec 2025)
  // ============================================================================
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // ============================================================================
  // AUTO-OPEN MODAL EFFECT - January 17th, 2026
  // 
  // This effect detects when user navigated here via "Find Affiliates" button
  // from another page (/discovered, /saved, /outreach).
  // 
  // Those pages link to /find?openModal=true, and this effect opens the modal
  // automatically so the user doesn't have to click the button again.
  // 
  // The URL is cleaned up after opening to prevent the modal from reopening
  // if the user refreshes the page or navigates back.
  // 
  // January 17th, 2026 FIX: Added null check for searchParams.
  // useSearchParams() can return null during SSR/initial render.
  // Without this check, TypeScript error TS18047: 'searchParams' is possibly 'null'
  // ============================================================================
  useEffect(() => {
    // Guard against null searchParams (can happen during SSR)
    if (!searchParams) return;
    
    const shouldOpenModal = searchParams.get('openModal') === 'true';
    if (shouldOpenModal) {
      setIsFindModalOpen(true);
      // Clean up URL to remove the query param (prevents re-opening on refresh)
      // Using replaceState so it doesn't add a new history entry
      window.history.replaceState({}, '', '/find');
    }
  }, [searchParams]);

  // Add keyword to list
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < MAX_KEYWORDS) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  // Remove keyword from list
  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(k => k !== keywordToRemove));
  };

  // ==========================================================================
  // KEYWORDS INITIALIZATION - January 4th, 2026
  // ==========================================================================
  // 
  // PROBLEM (RACE CONDITION BUG):
  // Previously, we had TWO separate useEffect hooks:
  //   1. Effect 1: Pre-populate keywords from user.topics (onboarding)
  //   2. Effect 2: Restore keywords from previous search (discoveredAffiliates)
  // 
  // Both effects ran independently and could race each other:
  //   - SWR returns cached discoveredAffiliates INSTANTLY
  //   - User data from useNeonUser might load slightly later
  //   - Effect 2 would run first, set hasSearched = true
  //   - Effect 1 would then fail its !hasSearched check
  //   - Result: Topics never appeared, or keywords got overwritten
  // 
  // Additionally, both effects captured the same closure values, so even when
  // running in the same commit phase, Effect 2's check for !hasPrePopulated
  // would pass (seeing the old false value) and overwrite Effect 1's keywords.
  // 
  // SOLUTION:
  // Use a useRef to track initialization state that persists across renders
  // and effect runs. This ensures we only initialize keywords ONCE, with
  // proper priority:
  //   1. FIRST PRIORITY: User's onboarding topics (if available)
  //   2. SECOND PRIORITY: Previous search keywords (if no topics)
  // 
  // The ref tracks: 'pending' | 'topics' | 'restored' | 'none'
  //   - 'pending': Haven't decided yet (waiting for data)
  //   - 'topics': Initialized from onboarding topics
  //   - 'restored': Initialized from previous search
  //   - 'none': No data to initialize from
  // 
  // ==========================================================================
  const keywordsInitRef = useRef<'pending' | 'topics' | 'restored' | 'none'>('pending');
  const [hasPrePopulated, setHasPrePopulated] = useState(false);

  useEffect(() => {
    // Already initialized - don't run again
    if (keywordsInitRef.current !== 'pending') {
      return;
    }

    // Wait for user data to load before making any decisions
    // This prevents the restore effect from "winning" just because SWR is faster
    const userDataReady = user !== undefined && user !== null;
    const discoveredDataReady = !discoveredLoading;

    // If user data isn't ready yet, wait (don't let restore effect win by default)
    if (!userDataReady) {
      return;
    }

    // PRIORITY 1: Pre-populate from onboarding topics
    // If user has topics from onboarding, use those as the starting keywords
    if (user?.topics && user.topics.length > 0) {
      const topicsToAdd = user.topics.slice(0, MAX_KEYWORDS);
      setKeywords(topicsToAdd);
      setHasPrePopulated(true);
      keywordsInitRef.current = 'topics';
      
      // Still restore RESULTS from previous search (just not keywords)
      // This way user sees their previous results but with topic keywords ready
      if (discoveredDataReady && discoveredAffiliates.length > 0) {
        const lastKeyword = discoveredAffiliates[0]?.searchKeyword;
        if (lastKeyword) {
          const lastSearchResults = discoveredAffiliates.filter(
            (d) => d.searchKeyword === lastKeyword
          );
          setResults(lastSearchResults);
          setHasSearched(true);
        }
      }
      return;
    }

    // PRIORITY 2: Restore from previous search (no topics available)
    // Only restore keywords if user doesn't have onboarding topics
    if (discoveredDataReady && discoveredAffiliates.length > 0) {
      const lastKeyword = discoveredAffiliates[0]?.searchKeyword;
      if (lastKeyword) {
        const lastSearchResults = discoveredAffiliates.filter(
          (d) => d.searchKeyword === lastKeyword
        );
        setResults(lastSearchResults);
        
        // Restore keywords from previous search
        const restoredKeywords = lastKeyword.split(' | ').filter(Boolean);
        setKeywords(restoredKeywords);
        setHasSearched(true);
        keywordsInitRef.current = 'restored';
        return;
      } else {
        // ======================================================================
        // DEFENSIVE FIX - January 4th, 2026
        // 
        // Edge case: discoveredAffiliates has items but searchKeyword is null.
        // This shouldn't happen in normal operation (searchKeyword is always
        // set when saving), but if it does, we should NOT block future 
        // initialization by setting ref to 'none'.
        // 
        // Stay in 'pending' state so effect can retry when data updates.
        // ======================================================================
        console.warn('[FindNewPage] discoveredAffiliates exists but searchKeyword is null');
        return;
      }
    }

    // No topics and no previous search - mark as initialized with nothing
    // Only reach here when discoveredAffiliates is truly empty (user never searched)
    if (discoveredDataReady && discoveredAffiliates.length === 0) {
      keywordsInitRef.current = 'none';
    }
  // Including all relevant dependencies for proper re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, discoveredLoading, discoveredAffiliates]);

  // ==========================================================================
  // HANDLE FIND AFFILIATES - Updated January 29, 2026
  // February 4, 2026: Batched search - all keywords in 1 API call, 1 credit per session
  // 
  // MIGRATION: Changed from streaming /api/scout to polling-based approach:
  // - POST /api/search/start → returns jobId
  // - GET /api/search/status?jobId=X → poll until done
  // 
  // This avoids Vercel timeout issues with long-running Apify searches
  // (40-95 seconds). The polling approach allows the Apify run to complete
  // in the background while the frontend shows progress.
  // 
  // FLOW:
  // 1. Send ALL keywords in single API call → poll until done → process results
  // 2. Results are enriched server-side (YouTube, Instagram, TikTok metadata)
  // 3. Filtering is applied server-side (language, TLD, e-commerce block)
  // 4. Final results saved to discovered_affiliates via existing hooks
  // ==========================================================================
  const handleFindAffiliates = async () => {
    if (keywords.length === 0) return;
    
    const hadPreviousResults = results.length > 0;
    
    setLoading(true);
    setResults([]);
    setHasSearched(true);
    setIsFindModalOpen(false);
    setCurrentPage(1);
    setAnimationKey(prev => prev + 1);
    // Clear any previous credit error
    setCreditError(null);
    
    if (hadPreviousResults) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    }

    const combinedKeyword = keywords.join(' | ');
    const sources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];

    try {
      // ==========================================================================
      // BATCHED KEYWORD SEARCH - February 4, 2026
      // 
      // All keywords are sent in a single API call. This ensures:
      // - 1 Apify run for all keywords (batched)
      // - 1 credit consumed per search session (not per keyword)
      // ==========================================================================
      const searchResults = await searchWithPolling(keywords, sources, {
        onProgress: (progress) => {
        },
      });
      
      // ==================================================================
      // PROCESS RESULTS
      // 
      // Add discovery method (if not present) and save to discovered.
      // Server already provides discoveryMethod, but we add fallback.
      // 
      // NOTE: SearchResult type doesn't include all ResultItem fields,
      // but the status endpoint actually returns enriched data with
      // these fields. We cast to any to access them safely.
      // ==================================================================
      const allResults: ResultItem[] = [];
      
      for (let i = 0; i < searchResults.length; i++) {
        // Cast to any to access additional fields from status endpoint
        const result = searchResults[i] as any;
        
        // Use server's discoveryMethod if present, else fallback to first keyword
        let discoveryMethod = result.discoveryMethod;
        if (!discoveryMethod) {
          const firstKw = keywords[0] || '';
          const isCompetitor = firstKw.toLowerCase().includes('alternative') || 
                             firstKw.toLowerCase().includes('vs') || 
                             firstKw.toLowerCase().includes('competitor');
          let methodValue = firstKw;
          if (isCompetitor) {
            methodValue = firstKw.replace(/alternative|vs|competitor/gi, '').trim();
          }
          discoveryMethod = {
            type: isCompetitor ? 'competitor' as const : 'keyword' as const,
            value: methodValue || firstKw
          };
        }
        
        // February 3, 2026: Construct nested similarWeb object from flat API properties
        // This standardizes the data format so modal and save functions work correctly
        const similarWeb = result.similarwebMonthlyVisits ? {
          domain: result.domain,
          monthlyVisits: result.similarwebMonthlyVisits,
          monthlyVisitsFormatted: formatTraffic(result.similarwebMonthlyVisits),
          globalRank: result.similarwebGlobalRank || null,
          countryRank: result.similarwebCountryRank || null,
          countryCode: result.similarwebCountryCode || null,
          bounceRate: result.similarwebBounceRate || 0,
          pagesPerVisit: result.similarwebPagesPerVisit || 0,
          timeOnSite: result.similarwebTimeOnSite || 0,
          trafficSources: result.similarwebTrafficSources || {
            direct: 0, search: 0, social: 0, referrals: 0, mail: 0, paid: 0
          },
          topCountries: result.similarwebTopCountries || [],
          category: result.similarwebCategory || null,
          siteTitle: result.similarwebSiteTitle || null,
          siteDescription: result.similarwebSiteDescription || null,
          screenshot: result.similarwebScreenshot || null,
          categoryRank: result.similarwebCategoryRank || null,
          monthlyVisitsHistory: result.similarwebMonthlyVisitsHistory || null,
          topKeywords: result.similarwebTopKeywords || null,
          snapshotDate: result.similarwebSnapshotDate || null,
        } : undefined;
        
        const enhancedResult: ResultItem = {
          ...result,
          rank: result.rank || i + 1,
          keyword: result.keyword || combinedKeyword,
          discoveryMethod,
          date: result.date || undefined,
          similarWeb,  // Add the nested object
        };
        
        allResults.push(enhancedResult);
      }
      
      // Update UI with all results
      setResults(allResults);
      
      // Batch save all results
      if (allResults.length > 0) {
        try {
          const resultsToSave = allResults.map((result, i) => ({
            ...result,
            rank: result.rank || i + 1,
            keyword: result.keyword || combinedKeyword,
            discoveryMethod: result.discoveryMethod || { type: 'keyword' as const, value: keywords[0] || '' },
          } as ResultItem));
          await saveDiscoveredAffiliates(resultsToSave, combinedKeyword);
        } catch (saveErr) {
          console.error('Failed to save discovered affiliates:', saveErr);
        }
      }

      // ==========================================================================
      // CREDITS REFRESH
      // 
      // After search completes, the backend has consumed topic_search credits.
      // Dispatch event to trigger useCredits hook to refetch from database.
      // ==========================================================================
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }
      
    } catch (searchErr: any) {
      // ====================================================================
      // ERROR HANDLING
      // ====================================================================
      
      // Credit error
      if (searchErr.creditError) {
        setCreditError({
          message: searchErr.message || 'Insufficient topic search credits',
          remaining: searchErr.remaining ?? 0,
        });
        toast.warning(t.toasts.warning.insufficientCredits);
      } else if (searchErr.name === 'AbortError' || searchErr.code === 'CANCELLED') {
        // Search cancelled by user - no notification needed
      } else {
        // Other errors
        console.error('[handleFindAffiliates] Search error:', searchErr);
        toast.error(t.toasts.error.searchFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (item: ResultItem) => {
    if (isAffiliateSaved(item.link)) {
      removeAffiliate(item.link);
    } else {
      saveAffiliate(item);
    }
  };

  // Group results by domain (used for display and counts)
  const groupResultsByDomain = (items: ResultItem[]) => {
    const groups: { [key: string]: ResultItem[] } = {};
    items.forEach(item => {
      if (!groups[item.domain]) {
        groups[item.domain] = [];
      }
      groups[item.domain].push(item);
    });
    return Object.values(groups).map(items => ({
      main: items[0],
      subItems: items.slice(1)
    }));
  };

  // Calculate real counts from results
  const counts = useMemo(() => {
    if (!hasSearched) return { All: 0, Web: 0, YouTube: 0, Instagram: 0, TikTok: 0 };
    
    return {
      All: results.length,
      Web: results.filter(r => r.source === 'Web').length,
      YouTube: results.filter(r => r.source === 'YouTube').length,
      Instagram: results.filter(r => r.source === 'Instagram').length,
      TikTok: results.filter(r => r.source === 'TikTok').length,
    };
  }, [results, hasSearched]);

  // ==========================================================================
  // LOADING MESSAGE - Updated January 29, 2026
  // 
  // Now uses searchProgress from usePollingSearch hook for better feedback.
  // Shows elapsed time during the Apify polling phase.
  // ==========================================================================
  const loadingMessage = useMemo(() => {
    // If we have search progress from polling hook, use it
    if (searchProgress && searchProgress.status !== 'idle' && searchProgress.status !== 'done') {
      const elapsed = searchProgress.elapsedSeconds || 0;
      
      switch (searchProgress.status) {
        case 'starting':
          return {
            title: 'Starting search...',
            subtitle: 'Initializing search across all platforms',
            badge: 'Starting'
          };
        case 'running':
          return {
            title: `Searching... (${elapsed}s)`,
            subtitle: 'Apify is scanning YouTube, Instagram, TikTok, and Web',
            badge: `${elapsed}s`
          };
        case 'processing':
          return {
            title: 'Processing results...',
            subtitle: 'Enriching and filtering results',
            badge: 'Processing'
          };
        default:
          break;
      }
    }
    
    // Fallback: show results count if we have them
    if (results.length === 0) {
      return {
        title: t.dashboard.find.loading.scanning,
        subtitle: t.dashboard.find.loading.subtitle,
        badge: t.dashboard.find.loading.badge
      };
    }
    
    const platformResults: string[] = [];
    if (counts.YouTube > 0) platformResults.push(`${counts.YouTube} ${t.dashboard.find.loading.fromYouTube}`);
    if (counts.Instagram > 0) platformResults.push(`${counts.Instagram} ${t.dashboard.find.loading.fromInstagram}`);
    if (counts.TikTok > 0) platformResults.push(`${counts.TikTok} ${t.dashboard.find.loading.fromTikTok}`);
    if (counts.Web > 0) platformResults.push(`${counts.Web} ${t.dashboard.find.loading.fromWebsites}`);
    
    const titles = [
      t.dashboard.find.loading.progressTitles.title1,
      t.dashboard.find.loading.progressTitles.title2,
      t.dashboard.find.loading.progressTitles.title3,
      t.dashboard.find.loading.progressTitles.title4,
    ];
    const titleIndex = Math.min(Math.floor(results.length / 10), titles.length - 1);
    
    return {
      title: titles[titleIndex],
      subtitle: platformResults.length > 0 
        ? platformResults.join(" • ") 
        : t.dashboard.find.loading.analyzing,
      badge: `${results.length} ${t.dashboard.find.loading.found}`
    };
  }, [results.length, counts, t, searchProgress]);

  // Filter tabs data with real counts
  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} className="text-blue-500" />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} className="text-red-600" />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} className="text-pink-600" />, count: counts.Instagram },
    { id: 'TikTok', icon: <Music size={14} className="text-cyan-500" />, count: counts.TikTok },
  ];

  // Filter results based on active filter, search query, AND advanced filters
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Filter by user-blocked domains (hide blocked for this user)
    filtered = filtered.filter(r => !isBlocked(r.domain));

    // Filter by source
    if (activeFilter !== 'All') {
      filtered = filtered.filter(r => r.source === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.domain.toLowerCase().includes(query) ||
        r.snippet?.toLowerCase().includes(query) ||
        r.keyword?.toLowerCase().includes(query)
      );
    }

    // ============================================================================
    // ADVANCED FILTERS (Added Dec 2025)
    // ============================================================================

    // Filter by competitors
    if (advancedFilters.competitors.length > 0) {
      filtered = filtered.filter(r =>
        r.discoveryMethod?.type === 'competitor' &&
        advancedFilters.competitors.includes(r.discoveryMethod.value)
      );
    }

    // ============================================================================
    // TOPICS FILTER - BUG FIX January 25, 2026
    // 
    // Previously, this filter matched on r.keyword for ALL affiliates,
    // including those discovered via competitor search. This caused affiliates
    // discovered via "apollo.io" with keyword "bedrop" to incorrectly appear
    // when filtering by topic "bedrop".
    // 
    // FIX: Only match on r.keyword if the affiliate was NOT discovered
    // via competitor or brand search. Topic filter should only show affiliates
    // actually discovered through topic/keyword searches.
    // ============================================================================
    if (advancedFilters.topics.length > 0) {
      filtered = filtered.filter(r =>
        (r.discoveryMethod?.type === 'topic' && advancedFilters.topics.includes(r.discoveryMethod.value)) ||
        (r.discoveryMethod?.type === 'keyword' && advancedFilters.topics.includes(r.discoveryMethod.value)) ||
        (r.keyword && advancedFilters.topics.includes(r.keyword) && 
         r.discoveryMethod?.type !== 'competitor' && r.discoveryMethod?.type !== 'brand')
      );
    }

    // Filter by subscribers/followers
    if (advancedFilters.subscribers) {
      const { min, max } = advancedFilters.subscribers;
      filtered = filtered.filter(r => {
        let subCount = 0;
        if (r.channel?.subscribers) {
          subCount = parseSubscriberCount(r.channel.subscribers) || 0;
        } else if (r.instagramFollowers) {
          subCount = r.instagramFollowers;
        } else if (r.tiktokFollowers) {
          subCount = r.tiktokFollowers;
        }
        if (subCount === 0) return false;
        if (min !== undefined && subCount < min) return false;
        if (max !== undefined && subCount > max) return false;
        return true;
      });
    }

    // Filter by date published
    if (advancedFilters.datePublished) {
      const { start, end } = advancedFilters.datePublished;
      filtered = filtered.filter(r => {
        if (!r.date) return false;
        const itemDate = new Date(r.date);
        if (start && itemDate < new Date(start)) return false;
        if (end && itemDate > new Date(end)) return false;
        return true;
      });
    }

    // Filter by last posted
    if (advancedFilters.lastPosted) {
      const { start, end } = advancedFilters.lastPosted;
      filtered = filtered.filter(r => {
        if (!r.date) return false;
        const itemDate = new Date(r.date);
        if (start && itemDate < new Date(start)) return false;
        if (end && itemDate > new Date(end)) return false;
        return true;
      });
    }

    // Filter by content count
    if (advancedFilters.contentCount) {
      const { min, max } = advancedFilters.contentCount;
      filtered = filtered.filter(r => {
        let contentCount = 0;
        if (r.instagramPostsCount) {
          contentCount = r.instagramPostsCount;
        } else if (r.tiktokVideosCount) {
          contentCount = r.tiktokVideosCount;
        }
        if (contentCount === 0) return false;
        if (min !== undefined && contentCount < min) return false;
        if (max !== undefined && contentCount > max) return false;
        return true;
      });
    }

    return filtered;
  }, [results, activeFilter, searchQuery, advancedFilters, isBlocked]);

  // Group filtered results by domain OR show all individually
  const groupedResults = useMemo(() => {
    if (groupByDomain) {
      return groupResultsByDomain(filteredResults);
    }
    return filteredResults.map(item => ({
      main: item,
      subItems: []
    }));
  }, [filteredResults, groupByDomain]);

  // Pagination calculations
  const totalPages = Math.ceil(groupedResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = groupedResults.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // ============================================================================
  // VISIBLE SELECTION - Computed from selectedLinks and filteredResults
  // ============================================================================
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

  const deselectAll = () => {
    setSelectedLinks(new Set());
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
      const affiliatesToSave = results.filter(r => visibleSelectedLinks.has(r.link));
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
      const linksToDelete = Array.from(visibleSelectedLinks);
      await removeDiscoveredAffiliatesBulk(linksToDelete);
      
      setResults(prev => prev.filter(r => !visibleSelectedLinks.has(r.link)));
      
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

  // Clear selection when starting a new search
  useEffect(() => {
    if (loading) {
      setSelectedLinks(new Set());
    }
  }, [loading]);

  const handleSingleDelete = async (link: string) => {
    setResults(prev => prev.filter(r => r.link !== link));
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      newSet.delete(link);
      return newSet;
    });
    await removeDiscoveredAffiliate(link);
    
    setDeleteResult({ count: 1, show: true });
    setTimeout(() => {
      setDeleteResult(prev => prev ? { ...prev, show: false } : null);
    }, 3000);
  };

  const normalizeDomainForCompare = (d: string) => (d || '').toLowerCase().replace(/^www\./, '');
  const [isBulkBlocking, setIsBulkBlocking] = useState(false);
  const handleBulkBlockDomains = async () => {
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
      const blockedSet = new Set(toBlock);
      setResults(prev => prev.filter(r => !blockedSet.has(normalizeDomainForCompare(r.domain))));
      setSelectedLinks(prev => {
        const next = new Set(prev);
        selectedItems.filter(r => blockedSet.has(normalizeDomainForCompare(r.domain))).forEach(r => next.delete(r.link));
        return next;
      });
      toast.success(toBlock.length === 1 ? t.dashboard.find.bulkActions.blockDomainDone : `${toBlock.length} ${t.dashboard.find.bulkActions.blockDomainsDone}`);
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to block domain');
    } finally {
      setIsBulkBlocking(false);
    }
  };

  // ==========================================================================
  // RENDER - January 3rd, 2026 (Updated January 6th, 2026)
  // 
  // DESIGN UPDATE: Neo-brutalist style from DashboardDemo.tsx
  // - Bold borders (border-4)
  // - Industrial typography (uppercase, tracking)
  // - Neo-brutalist buttons with offset shadows
  // - Timer and credit pills in header
  // 
  // NOTE: The outer div with flex and Sidebar is NOT here.
  // It's in the parent layout.tsx file (src/app/(dashboard)/layout.tsx).
  // This component only renders the main content area.
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
        <h1 className="font-black text-xl uppercase tracking-tight">{t.dashboard.find.pageTitle}</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill - DashboardDemo exact styling:
              bg-[#1a1a1a] text-brandYellow px-3 py-1.5 rounded-full text-xs font-mono border border-brandBlack */}
          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-black">
            <Clock size={12} />
            <span>{t.dashboard.header.nextScan}</span>
            <ScanCountdown />
            <span className="text-white font-bold">{t.dashboard.header.pro}</span>
          </div>

          {/* Stats Pills - DashboardDemo exact styling:
              px-3 py-1.5 border-2 border-brandBlack rounded-md bg-white 
              Format: "Search | 10/10 Topic" */}
          <div className="hidden lg:flex items-center gap-3">
            <CreditsDisplay variant="neo" />
          </div>

          {/* Find Button - DashboardDemo exact styling:
              bg-brandYellow text-brandBlack font-black text-xs uppercase 
              border-2 border-brandBlack shadow-neo-sm hover effects */}
          <button 
            onClick={() => setIsFindModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
          </button>
        </div>
      </header>

      {/* 
        OLD_DESIGN - Header (pre-January 6th, 2026)
        The previous header used:
        - h-12 height, bg-white/80 backdrop-blur, border-b border-slate-100
        - D4E815 lime green accents
        - ScanCountdown component inline
        - CreditsDisplay without variant prop
        To restore: See git history for this file
      */}

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          
          OVERFLOW FIX - January 23, 2026
          Added overflow-x-hidden to prevent horizontal scrolling when results table
          renders with long content. This ensures the filter bar stays visible.
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
        
        {/* Previous Results Warning - Neo-brutalist style - Translated (January 9th, 2026) */}
        {showWarning && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#ffbf23]/20 border-2 border-[#ffbf23] rounded-lg mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-center w-8 h-8 bg-[#ffbf23] rounded shrink-0">
              <Search size={16} className="text-black" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-black">{t.dashboard.find.newSearchWarning.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {t.dashboard.find.newSearchWarning.subtitle}
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-black hover:text-gray-600 transition-colors p-1"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            
            LAYOUT FIX - January 23, 2026
            Restored justify-between layout. FilterPanel now uses a dropdown approach
            so filter pills don't take up horizontal space.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Search Input - DashboardDemo exact:
                border-2 border-brandBlack dark:border-gray-700 rounded bg-white dark:bg-gray-900 
                focus:border-brandYellow */}
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
            
            {/* Platform Filter Pills - DashboardDemo exact:
                bg-gray-100 dark:bg-gray-900 p-1 rounded border border-gray-200 dark:border-gray-800
                Active: bg-brandYellow text-brandBlack rounded shadow-sm */}
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
                  {hasSearched && tab.count > 0 && (
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
              affiliates={results}
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

        {/* 
          OLD_DESIGN - Filters Section (pre-January 6th, 2026)
          Previously used: D4E815 lime accents, rounded-lg pills, max-w-160px search
          To restore: See git history for this file
        */}

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
            {/* Left: Selection info - Neo-brutalist style */}
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

            {/* Right: Action buttons - Neo-brutalist style */}
            <div className="flex items-center gap-2">
              {/* Cancel button - Neo-brutalist outline */}
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white transition-all"
              >
                <X size={14} />
                {t.common.cancel}
              </button>

              {/* Block domain(s) - only when selection has domains not already at limit */}
              <button
                onClick={handleBulkBlockDomains}
                disabled={isBlockLimitReached || isBulkBlocking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={isBlockLimitReached ? t.dashboard.find.bulkActions.blockLimitReached : t.dashboard.find.bulkActions.blockDomains}
              >
                {isBulkBlocking ? <Loader2 size={14} className="animate-spin" /> : null}
                {t.dashboard.find.bulkActions.blockDomains}
              </button>

              {/* Delete button - Neo-brutalist red */}
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
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
                {isBulkSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${newToSaveCount} ${t.dashboard.find.bulkActions.saveToPipeline}`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE AREA - DashboardDemo.tsx EXACT STYLING
            bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 
            rounded-lg min-h-[500px] flex flex-col
            
            OVERFLOW FIX - January 23, 2026
            Added max-w-full and overflow-hidden to prevent long content (URLs, titles)
            from causing horizontal expansion that pushes filters off-screen.
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col max-w-full overflow-hidden">
          {/* Table Header - Translated (January 9th, 2026) */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input 
                type="checkbox" 
                checked={filteredResults.length > 0 && visibleSelectedLinks.size === filteredResults.length}
                onChange={() => visibleSelectedLinks.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
                className="accent-[#ffbf23]" 
              />
            </div>
            <div className="col-span-3">{t.dashboard.table.affiliate}</div>
            <div className="col-span-3">{t.dashboard.table.relevantContent}</div>
            <div className="col-span-2">{t.dashboard.table.discoveryMethod}</div>
            <div className="col-span-1">{t.dashboard.table.date}</div>
            <div className="col-span-2 text-right">{t.dashboard.table.action}</div>
          </div>

          {/* Results Content */}
          <div className="flex-1 divide-y divide-gray-100 dark:divide-gray-800">

        {/* 
          OLD_DESIGN - Table Header (pre-January 6th, 2026)
          Previously used: fixed grid columns, rounded-xl corners, slate colors
          To restore: See git history for this file
        */}
          {hasSearched && (loading || groupedResults.length > 0) ? (
            <div>
              {loading ? (
                <>
                  {/* =============================================================================
                      LOADING PROGRESS INDICATOR - NEO-BRUTALIST DESIGN
                      Updated: January 16, 2026
                      
                      Changed from #D4E815 (lime) to #ffbf23 (brand yellow)
                      Matches neo-brutalist design system across dashboard
                      ============================================================================= */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#ffbf23]/10 border-b-2 border-[#ffbf23]/30">
                    <div className="w-5 h-5 border-2 border-[#ffbf23] border-t-transparent rounded-full animate-spin"></div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900 dark:text-white uppercase">
                        {loadingMessage.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {loadingMessage.subtitle}
                      </p>
                    </div>
                    <div className="text-xs font-black text-black bg-[#ffbf23] px-2.5 py-1 border-2 border-black">
                      {loadingMessage.badge}
                    </div>
                  </div>
                  
                  {/* Streamed results */}
                  {groupedResults.map((group, idx) => (
                    <div
                      key={`stream-${animationKey}-${idx}-${group.main.link}`}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ 
                        animationDelay: `${Math.min(idx, 3) * 60}ms`,
                        animationFillMode: 'backwards'
                      }}
                    >
                      <AffiliateRow 
                        title={group.main.title}
                        domain={group.main.domain}
                        link={group.main.link}
                        source={group.main.source}
                        rank={group.main.rank}
                        keyword={group.main.keyword}
                        isSaved={isAffiliateSaved(group.main.link)}
                        onSave={() => toggleSave(group.main)}
                        thumbnail={group.main.thumbnail}
                        views={group.main.views}
                        date={group.main.date}
                        snippet={group.main.snippet}
                        highlightedWords={group.main.highlightedWords}
                        discoveryMethod={group.main.discoveryMethod}
                        email={group.main.email}
                        subItems={group.subItems}
                        channel={group.main.channel}
                        duration={group.main.duration}
                        personName={group.main.personName}
                        isSelected={selectedLinks.has(group.main.link)}
                        onSelect={toggleSelectItem}
                        isSaving={savingLinks.has(group.main.link)}
                        onDelete={() => handleSingleDelete(group.main.link)}
                        affiliateData={group.main}
                        currentUser={user}
                      />
                    </div>
                  ))}
                  
                  {/* Skeletons for upcoming results */}
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`skeleton-${animationKey}-${idx}`}
                      className="opacity-50"
                    >
                      <AffiliateRowSkeleton />
                    </div>
                  ))}
                </>
              ) : (
                // COMPLETE MODE: Show paginated results
                paginatedGroups.map((group, idx) => (
                  <div
                    key={`result-${animationKey}-${group.main.link}-${idx}`}
                    className="row-appear"
                    style={{ 
                      animationDelay: `${idx * 60}ms`
                    }}
                  >
                    <AffiliateRow 
                      title={group.main.title}
                      domain={group.main.domain}
                      link={group.main.link}
                      source={group.main.source}
                      rank={group.main.rank}
                      keyword={group.main.keyword}
                      isSaved={isAffiliateSaved(group.main.link)}
                      onSave={() => toggleSave(group.main)}
                      thumbnail={group.main.thumbnail}
                      views={group.main.views}
                      date={group.main.date}
                      snippet={group.main.snippet}
                      highlightedWords={group.main.highlightedWords}
                      discoveryMethod={group.main.discoveryMethod}
                      email={group.main.email}
                      subItems={group.subItems}
                      channel={group.main.channel}
                      duration={group.main.duration}
                      personName={group.main.personName}
                      isSelected={selectedLinks.has(group.main.link)}
                      onSelect={toggleSelectItem}
                      isSaving={savingLinks.has(group.main.link)}
                      onDelete={() => handleSingleDelete(group.main.link)}
                      affiliateData={group.main}
                      currentUser={user}
                    />
                  </div>
                ))
              )}
            </div>
          ) : hasSearched && !loading && creditError ? (
            // =================================================================
            // CREDIT ERROR BANNER - January 4th, 2026
            // Translated (January 9th, 2026)
            // =================================================================
            <div className="py-12 text-center">
              <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-amber-800 mb-2">
                  {t.dashboard.find.creditError.title}
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  {creditError.message}
                </p>
                <p className="text-amber-600 text-xs">
                  {t.dashboard.find.creditError.upgradeHint}
                </p>
              </div>
            </div>
          ) : hasSearched && !loading && groupedResults.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              {t.dashboard.find.noResults}
            </div>
          ) : (
            /* Empty State - Neo-brutalist style - Translated (January 9th, 2026) */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Search size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                {t.dashboard.find.emptyState.title}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                {t.dashboard.find.emptyState.subtitle}
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Pagination Controls - Translated (January 9th, 2026) */}
        {hasSearched && groupedResults.length > 0 && !loading && (
          <div className="mt-4 flex items-center justify-center gap-6 py-4">
            <div className="text-xs text-slate-500">
              {t.dashboard.pagination.showing} <span className="font-semibold text-slate-900">{startIndex + 1}</span> {t.dashboard.pagination.toOf}{' '}
              <span className="font-semibold text-slate-900">{Math.min(endIndex, groupedResults.length)}</span> {t.common.of}{' '}
              <span className="font-semibold text-slate-900">{groupedResults.length}</span> {t.dashboard.pagination.affiliates}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  currentPage === 1
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                <ChevronLeft size={14} />
                {t.dashboard.pagination.previous}
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const showPage = 
                    page === 1 || 
                    page === totalPages || 
                    (page >= currentPage - 1 && page <= currentPage + 1);
                  
                  const showEllipsis = 
                    (page === currentPage - 2 && currentPage > 3) ||
                    (page === currentPage + 2 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return (
                      <span key={page} className="px-2 text-slate-400">
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-semibold transition-all",
                        page === currentPage
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  currentPage === totalPages
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                {t.dashboard.pagination.next}
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {itemsPerPage} {t.dashboard.pagination.perPage}
            </div>
          </div>
        )}

      </div>

      {/* Find Affiliates Modal - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <Modal 
        isOpen={isFindModalOpen} 
        onClose={() => setIsFindModalOpen(false)}
        title=""
        width="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Header - NEO-BRUTALIST - Translated (January 9th, 2026) */}
          <div className="text-center pb-2">
            <div className="w-14 h-14 bg-black border-4 border-black flex items-center justify-center mx-auto mb-3 shadow-[4px_4px_0px_0px_#ffbf23]">
              <Search size={24} className="text-[#ffbf23]" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide">{t.dashboard.find.modal.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t.dashboard.find.modal.subtitle}
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column - Keywords - NEO-BRUTALIST - Translated (January 9th, 2026) */}
            <div className="flex flex-col">
              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 uppercase tracking-wide">
                <Search size={14} className="text-black dark:text-white" />
                {t.dashboard.find.modal.keywordsLabel}
                <span className="ml-auto text-xs font-bold text-gray-400">
                  {keywords.length}/{MAX_KEYWORDS}
                </span>
              </label>
              
              <div className="relative mt-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder={t.dashboard.find.modal.keywordsPlaceholder}
                  disabled={keywords.length >= MAX_KEYWORDS}
                  className="w-full px-3 py-2.5 pr-16 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={addKeyword}
                  disabled={!keywordInput.trim() || keywords.length >= MAX_KEYWORDS}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black hover:bg-yellow-400 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  {t.dashboard.find.modal.addButton}
                </button>
              </div>

              <div className="flex-1 min-h-[140px] max-h-[140px] overflow-y-auto no-scrollbar space-y-1.5 p-2 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 mt-2">
                {keywords.length > 0 ? (
                  keywords.map((kw, idx) => (
                    <div
                      key={kw}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-sm group hover:border-red-400 transition-all"
                    >
                      <span className="w-5 h-5 flex items-center justify-center bg-[#ffbf23] text-black text-[10px] font-black border border-black shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 font-medium">{kw}</span>
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs font-medium">
                    {t.dashboard.find.modal.noKeywordsYet}
                  </div>
                )}
              </div>

              <div className="h-5 mt-1.5">
                {keywords.length > 0 && (
                  <button
                    onClick={() => setKeywords([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors font-bold"
                  >
                    {t.dashboard.find.modal.clearAllKeywords}
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Website & Competitors - Translated (January 9th, 2026) */}
            <div className="flex flex-col">
              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 uppercase tracking-wide">
                <Globe size={14} className="text-gray-500" />
                {t.dashboard.find.modal.websiteLabel}
              </label>
              <div className={`px-3 py-2.5 border-2 text-sm mt-2 flex items-center gap-2 ${
                user?.brand 
                  ? 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' 
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 italic'
              }`}>
                {user?.brand && (
                  <img 
                    src={`https://www.google.com/s2/favicons?domain=${user.brand}&sz=16`}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="font-medium">{user?.brand || t.dashboard.find.modal.notSetDuringOnboarding}</span>
              </div>

              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 mt-3 uppercase tracking-wide">
                <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {t.dashboard.find.modal.competitorsLabel}
                {user?.competitors && user.competitors.length > 0 && (
                  <span className="ml-auto text-[10px] text-gray-500 font-bold">
                    {user.competitors.length} {t.dashboard.find.modal.competitorsAdded}
                  </span>
                )}
              </label>
              {user?.competitors && user.competitors.length > 0 ? (
                <div className="p-2 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 mt-2 overflow-y-auto max-h-[80px]">
                  <div className="flex flex-wrap gap-1.5">
                    {user.competitors.map((competitor, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium border border-gray-200 dark:border-gray-600"
                      >
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${competitor}&sz=16`}
                          alt=""
                          className="w-3.5 h-3.5"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {competitor}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 mt-2">
                  <p className="text-center text-gray-400 text-xs font-medium">{t.dashboard.find.modal.noCompetitors}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Button - NEO-BRUTALIST - Translated (January 9th, 2026) */}
          <button
            onClick={handleFindAffiliates}
            disabled={keywords.length === 0 || loading}
            className="w-full py-3.5 bg-[#ffbf23] text-black font-black uppercase tracking-wide border-4 border-black hover:bg-yellow-400 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-3 border-black border-t-transparent animate-spin"></div>
                {t.dashboard.find.modal.searching}
              </>
            ) : (
              <>
                <Search size={18} />
                {t.dashboard.find.modal.ctaButton}
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-gray-400 font-medium">
            {t.dashboard.find.modal.tip}
          </p>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
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

