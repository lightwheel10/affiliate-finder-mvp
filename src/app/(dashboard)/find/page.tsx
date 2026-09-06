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

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Save,
  Loader2,
  X,
  Languages,
  MapPin,
  Clock,  // Added January 6th, 2026 for neo-brutalist header
  Pencil, // Added April 25, 2026 — replaces the ASCII ✎ glyph used in the Find Affiliates modal brand-edit button (smoover Phase 2g, chunk 2)
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultItem, FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../../hooks/useAffiliates';
import { useBlockedDomains } from '../../hooks/useBlockedDomains';
import { usePollingSearch, type SearchError } from '../../hooks/usePollingSearch';
import { FilterPanel } from '../../components/FilterPanel';
import { Platform, type SearchResult } from '../../services/search';
import { extractDiscoveryMethod } from '@/app/utils/localized-search';
// April 28, 2026: Unified search predicate (Find/Discovered/Saved) — see utils/affiliate-search.ts
import { affiliateMatchesSearchQuery } from '@/app/utils/affiliate-search';
import { SEARCH_INPUT_LIMITS } from '@/lib/plans/catalog';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';
import { useBrandLocation } from '@/contexts/BrandLocationContext';
import {
  BrandLocationApiError,
  requestBrandLocationApi,
} from '@/app/hooks/useBrandPortfolio';
import { affiliateIdentityKey } from '@/app/utils/affiliate-grouping';
import {
  getMarketCountryByIsoCode,
  getCountryFlagUrl,
  getMarketLanguageByIsoCode,
  MARKET_COUNTRIES,
  MARKET_LANGUAGES,
} from '@/lib/markets/catalog';
import {
  findActiveBrandMarketLocation,
  readLocationSearchDefaults,
  type ManagedLocation,
} from '@/lib/brand-locations/portfolio';

type PollingResult = SearchResult & Partial<ResultItem> & {
  similarwebMonthlyVisits?: number;
  similarwebGlobalRank?: number;
  similarwebCountryRank?: number;
  similarwebCountryCode?: string;
  similarwebBounceRate?: number;
  similarwebPagesPerVisit?: number;
  similarwebTimeOnSite?: number;
  similarwebTrafficSources?: ResultItem['similarWeb'] extends infer T
    ? T extends { trafficSources: infer TSources } ? TSources : never
    : never;
  similarwebTopCountries?: ResultItem['similarWeb'] extends infer T
    ? T extends { topCountries: infer TCountries } ? TCountries : never
    : never;
  similarwebCategory?: string;
  similarwebSiteTitle?: string;
  similarwebSiteDescription?: string;
  similarwebScreenshot?: string;
  similarwebCategoryRank?: number;
  similarwebMonthlyVisitsHistory?: Record<string, number>;
  similarwebTopKeywords?: Array<{ name: string; estimatedValue: number; cpc: number | null }>;
  similarwebSnapshotDate?: string;
};

// Helper to format traffic numbers (e.g., 1234567 → "1.2M")
function formatTraffic(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const MAX_KEYWORDS = SEARCH_INPUT_LIMITS.maxKeywords;
const MAX_COMPETITORS = SEARCH_INPUT_LIMITS.maxCompetitors;

export default function FindNewPage() {
  // Translation hook (January 9th, 2026)
  const { t, language } = useLanguage();
  
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
  // Supabase auth user (supabaseUser) is used for secure feature gating.
  // ==========================================================================
  const { userId, user, supabaseUser, refetch } = useNeonUser();
  const {
    activeBrand,
    activeLocation,
    featureEnabled: brandLocationsEnabled,
    locationScopeIds,
    selectLocation,
    refreshPortfolio,
  } = useBrandLocation();
  const displayedBrandDomain = brandLocationsEnabled
    ? activeBrand?.normalizedDomain ?? ''
    : user?.brand ?? '';
  
  // Hooks for data management
  const { 
    savedAffiliates, 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved,
    saveAffiliatesBulk,
    isLoading: savedLoading 
  } = useSavedAffiliates(locationScopeIds);
  
  const { 
    discoveredAffiliates, 
    removeDiscoveredAffiliate,
    removeDiscoveredAffiliatesBulk,
    isLoading: discoveredLoading
  } = useDiscoveredAffiliates(locationScopeIds);

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

  // Editable competitors (pre-filled from onboarding, add/remove per run)
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const keywordsInitRef = useRef<'pending' | 'topics' | 'restored' | 'none'>('pending');
  const competitorsInitRef = useRef<'pending' | 'done'>('pending');
  const modalLocationKeyRef = useRef<string | null | undefined>(undefined);
  const [editBrand, setEditBrand] = useState(displayedBrandDomain);
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const isSelecdooUser = !!supabaseUser?.email?.toLowerCase().endsWith('@selecdoo.com');
  const canEditBrandInline = isSelecdooUser && !brandLocationsEnabled;
  const normalizedUserBrand = displayedBrandDomain.trim();
  const hasBrandChange = !!editBrand.trim() && editBrand.trim() !== normalizedUserBrand;
  
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);
  const [searchCountryCode, setSearchCountryCode] = useState('');
  const [searchLanguageCode, setSearchLanguageCode] = useState('');
  const [isConfirmingNewLocation, setIsConfirmingNewLocation] = useState(false);
  const [isCreatingSearchLocation, setIsCreatingSearchLocation] = useState(false);
  const [searchLocationError, setSearchLocationError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showWarning, setShowWarning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [groupByDomain, setGroupByDomain] = useState(false);

  const matchingSearchLocation = useMemo(
    () => findActiveBrandMarketLocation(
      activeBrand,
      searchCountryCode,
      searchLanguageCode,
    ),
    [activeBrand, searchCountryCode, searchLanguageCode],
  );
  const selectedSearchCountry = getMarketCountryByIsoCode(searchCountryCode);
  const selectedSearchLanguage = getMarketLanguageByIsoCode(searchLanguageCode);
  const selectedSearchCountryLabel = language === 'de'
    ? selectedSearchCountry?.nameDE
    : selectedSearchCountry?.name;
  const selectedSearchLanguageLabel = language === 'de'
    ? selectedSearchLanguage?.nameDE
    : selectedSearchLanguage?.name;
  const selectedSearchCountryFlagUrl = getCountryFlagUrl(selectedSearchCountry?.isoCode);
  const selectedSearchMarketLabel = [
    selectedSearchCountryLabel,
    selectedSearchLanguageLabel,
  ].filter(Boolean).join(' · ');

  const loadSearchLocationDefaults = useCallback((location?: ManagedLocation | null) => {
    const defaults = readLocationSearchDefaults(location, MAX_KEYWORDS, MAX_COMPETITORS);
    keywordsInitRef.current = defaults.keywords.length > 0 ? 'topics' : 'none';
    competitorsInitRef.current = 'done';
    setKeywords(defaults.keywords);
    setKeywordInput('');
    setCompetitors(defaults.competitors);
    setCompetitorInput('');
  }, []);

  const selectSearchMarket = (countryCode: string, languageCode: string) => {
    setSearchCountryCode(countryCode);
    setSearchLanguageCode(languageCode);
    loadSearchLocationDefaults(
      findActiveBrandMarketLocation(activeBrand, countryCode, languageCode),
    );
    setSearchLocationError(null);
    setIsConfirmingNewLocation(false);
  };

  const formatSearchLocationError = (error: unknown): string => {
    if (!(error instanceof BrandLocationApiError)) {
      return t.dashboard.brandLocations.errors.generic;
    }
    switch (error.code) {
      case 'PLAN_LIMIT_REACHED':
        return t.dashboard.brandLocations.errors.planLimit;
      case 'SUBSCRIPTION_REQUIRED':
        return t.dashboard.brandLocations.errors.subscriptionRequired;
      case 'DUPLICATE_LOCATION_MARKET':
        return t.dashboard.brandLocations.errors.duplicateLocation;
      default:
        return t.dashboard.brandLocations.errors.generic;
    }
  };

  // ============================================================================
  // BULK SELECTION STATE (Added Dec 2025)
  // Tracks which affiliates are selected for bulk operations (save/delete)
  // Uses location + link as the unique identifier for O(1) lookups.
  // ============================================================================
  const [selectedAffiliateKeys, setSelectedAffiliateKeys] = useState<Set<string>>(new Set());
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

  // A search always runs in one concrete market. If the dashboard is showing
  // several locations, activeLocation is the brand's deterministic default.
  useEffect(() => {
    if (!isFindModalOpen || !brandLocationsEnabled) {
      modalLocationKeyRef.current = undefined;
      return;
    }
    const locationKey = activeLocation
      ? `${activeBrand?.id ?? ''}:${activeLocation.id}:${activeLocation.countryCode}:${activeLocation.languageCode}`
      : null;
    // Do not erase modal edits when the same portfolio record is revalidated.
    if (modalLocationKeyRef.current === locationKey) return;
    modalLocationKeyRef.current = locationKey;
    setSearchCountryCode(
      activeLocation?.countryCode ?? MARKET_COUNTRIES[0].isoCode,
    );
    setSearchLanguageCode(
      activeLocation?.languageCode ?? MARKET_LANGUAGES[0].isoCode,
    );
    loadSearchLocationDefaults(activeLocation);
    setSearchLocationError(null);
    setIsConfirmingNewLocation(false);
    setIsCreatingSearchLocation(false);
  }, [
    activeBrand?.id,
    activeLocation,
    brandLocationsEnabled,
    isFindModalOpen,
    loadSearchLocationDefaults,
  ]);

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

  // Add competitor to list (normalize: trim, lowercase for display consistency)
  const addCompetitor = () => {
    const raw = competitorInput.trim();
    if (!raw) return;
    // Normalize to domain-like: ensure no protocol, lowercase
    const normalized = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();
    if (normalized && !competitors.some(c => c.toLowerCase() === normalized) && competitors.length < MAX_COMPETITORS) {
      setCompetitors([...competitors, normalized]);
      setCompetitorInput('');
    }
  };

  // Remove competitor from list
  const removeCompetitor = (competitorToRemove: string) => {
    setCompetitors(competitors.filter(c => c !== competitorToRemove));
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
  const previousLocationScopeRef = useRef<string | undefined>(undefined);
  const locationScopeKey = brandLocationsEnabled && activeBrand && locationScopeIds?.length
    ? `${activeBrand.id}:${locationScopeIds.join(',')}`
    : undefined;
  const [hasPrePopulated, setHasPrePopulated] = useState(false);
  const savedTopics = brandLocationsEnabled ? activeLocation?.topics : user?.topics;
  const savedCompetitors = brandLocationsEnabled ? activeLocation?.competitors : user?.competitors;

  useEffect(() => {
    if (!brandLocationsEnabled) {
      previousLocationScopeRef.current = undefined;
      return;
    }
    if (!locationScopeKey) return;
    if (previousLocationScopeRef.current === undefined) {
      previousLocationScopeRef.current = locationScopeKey;
      return;
    }
    if (previousLocationScopeRef.current === locationScopeKey) return;

    previousLocationScopeRef.current = locationScopeKey;
    // Abort only this browser's old-location poll. The server job remains
    // attached to its immutable location and can finish safely in the
    // background; its result cannot populate the newly selected workspace.
    cancelSearch();
    keywordsInitRef.current = 'pending';
    competitorsInitRef.current = 'pending';
    setKeywords([]);
    setKeywordInput('');
    setCompetitors([]);
    setCompetitorInput('');
    setResults([]);
    setLoading(false);
    setHasSearched(false);
    setHasPrePopulated(false);
    setActiveFilter('All');
    setSearchQuery('');
    setCurrentPage(1);
    setShowWarning(false);
    setGroupByDomain(false);
    setSelectedAffiliateKeys(new Set());
    setSavingLinks(new Set());
    setIsBulkSaving(false);
    setIsBulkDeleting(false);
    setIsDeleteModalOpen(false);
    setBulkSaveResult(null);
    setDeleteResult(null);
    setCreditError(null);
    setAdvancedFilters(DEFAULT_FILTER_STATE);
    setIsFilterPanelOpen(false);
    setAnimationKey((current) => current + 1);
  }, [brandLocationsEnabled, cancelSearch, locationScopeKey]);

  useEffect(() => {
    const setupDataReady = brandLocationsEnabled ? activeLocation !== null : user != null;
    if (setupDataReady && competitorsInitRef.current === 'pending') {
      if (savedCompetitors && savedCompetitors.length > 0) {
        setCompetitors(savedCompetitors.slice(0, MAX_COMPETITORS));
      }
      competitorsInitRef.current = 'done';
    }

    // Already initialized - don't run again
    if (keywordsInitRef.current !== 'pending') {
      return;
    }

    // Wait for user data to load before making any decisions
    // This prevents the restore effect from "winning" just because SWR is faster
    const discoveredDataReady = !discoveredLoading;

    // If user data isn't ready yet, wait (don't let restore effect win by default)
    if (!setupDataReady) {
      return;
    }

    // PRIORITY 1: Pre-populate from onboarding topics
    // If user has topics from onboarding, use those as the starting keywords
    if (savedTopics && savedTopics.length > 0) {
      const topicsToAdd = savedTopics.slice(0, MAX_KEYWORDS);
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
  }, [
    activeLocation,
    brandLocationsEnabled,
    discoveredLoading,
    discoveredAffiliates,
    savedCompetitors,
    savedTopics,
    user,
  ]);

  // Keep editable brand in sync with the active portfolio context.
  useEffect(() => {
    setEditBrand(displayedBrandDomain);
    setIsEditingBrand(false);
    setIsSavingBrand(false);
  }, [displayedBrandDomain]);

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
  // 4. Final results and search occurrences are committed atomically by the server
  // ==========================================================================
  const runFindAffiliates = async (targetBrandLocationId?: string) => {
    if (keywords.length === 0) return;
    
    // ==========================================================================
    // PERSIST THE SELECTED LOCATION'S SEARCH DEFAULTS BEFORE SEARCH
    // 2026-07-13 — Paras
    //
    // WHY: each brand location now owns its topics and competitors. Persisting
    // those values on the immutable selected location keeps DE and GB searches
    // isolated even when the user switches brands or dashboard location scope.
    //
    // The legacy user-row write remains only for deployments where the
    // brand/location feature is disabled.
    // ==========================================================================
    if (brandLocationsEnabled && targetBrandLocationId) {
      try {
        await requestBrandLocationApi(`/api/brand-locations/${targetBrandLocationId}`, {
          method: 'PATCH',
          body: JSON.stringify({ topics: keywords, competitors }),
        });
        await refreshPortfolio();
      } catch (error) {
        // Saving reusable defaults must never launch a search in the wrong
        // location. The immutable location ID is still sent below; this warning
        // only means the edited defaults could not be persisted for next time.
        console.error('[FindNewPage] Failed to persist location search defaults:', error);
      }
    } else if (isSelecdooUser && userId) {
      try {
        const brandToSave = editBrand.trim() || (user?.brand || '');
        const setupUpdate: Record<string, unknown> = {
          topics: keywords,          // keywords[] is guaranteed non-empty (early return above)
          competitors: competitors,  // may be empty — saving reflects the current setup
        };
        // Only send brand when we actually have one, so we never blank it out.
        if (brandToSave) setupUpdate.brand = brandToSave;

        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setupUpdate),
        });
        await refetch?.();
      } catch (err) {
        console.error('[FindNewPage] Failed to persist brand setup before search:', err);
      }
    }

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
        competitors: competitors.length > 0 ? competitors : undefined,
        brandLocationId: targetBrandLocationId,
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
        const result = searchResults[i] as PollingResult;
        
        // Use server's discoveryMethod if present; else derive from searchQuery (competitor vs keyword)
        let discoveryMethod = result.discoveryMethod;
        if (!discoveryMethod && result.searchQuery) {
          const discovery = extractDiscoveryMethod(result.searchQuery, keywords, competitors);
          discoveryMethod = {
            type: discovery.type === 'competitor' ? 'competitor' as const : 'keyword' as const,
            value: discovery.value
          };
        }
        if (!discoveryMethod) {
          discoveryMethod = { type: 'keyword' as const, value: keywords[0] || '' };
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
          brandId: result.brandId ?? activeBrand?.id,
          brandLocationId: result.brandLocationId ?? targetBrandLocationId,
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
      
      // ==========================================================================
      // CREDITS REFRESH
      // 
      // After search completes, the backend has consumed topic_search credits.
      // Dispatch event to trigger useCredits hook to refetch from database.
      // ==========================================================================
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }
      
    } catch (searchErr: unknown) {
      // ====================================================================
      // ERROR HANDLING
      // ====================================================================
      
      // Credit error
      const typedError = searchErr as Partial<SearchError> & { name?: string };
      if (typedError.creditError) {
        setCreditError({
          message: typedError.message || 'Insufficient topic search credits',
          remaining: typedError.remaining ?? 0,
        });
        toast.warning(t.toasts.warning.insufficientCredits);
      } else if (typedError.name === 'AbortError' || typedError.code === 'CANCELLED') {
        // Search cancelled by user - no notification needed
      } else if (typedError.code === 'SERVICE_AT_CAPACITY') {
        // August 3, 2026 (Paras): Apify monthly usage cap reached (see
        // /api/search/start catch block). Retrying cannot succeed, so show the
        // dedicated "temporarily unavailable" toast instead of searchFailed.
        toast.error(t.toasts.error.searchAtCapacity);
      } else {
        // Other errors
        console.error('[handleFindAffiliates] Search error:', searchErr);
        toast.error(t.toasts.error.searchFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindAffiliates = async () => {
    if (keywords.length === 0) return;
    setSearchLocationError(null);

    if (!brandLocationsEnabled) {
      await runFindAffiliates();
      return;
    }

    if (!activeBrand || !searchCountryCode || !searchLanguageCode) {
      setSearchLocationError(t.dashboard.find.modal.locationRequired);
      return;
    }

    if (!matchingSearchLocation) {
      setIsConfirmingNewLocation(true);
      return;
    }

    // A search is a single-location operation. Make that location the visible
    // dashboard scope too, while suppressing the ordinary workspace-change
    // reset that would otherwise cancel the poll we are about to start.
    previousLocationScopeRef.current = `${activeBrand.id}:${matchingSearchLocation.id}`;
    selectLocation(matchingSearchLocation.id);
    await runFindAffiliates(matchingSearchLocation.id);
  };

  const confirmNewSearchLocation = async () => {
    if (
      !activeBrand
      || !searchCountryCode
      || !searchLanguageCode
      || keywords.length === 0
      || isCreatingSearchLocation
    ) {
      return;
    }

    setIsCreatingSearchLocation(true);
    setSearchLocationError(null);
    try {
      const { location } = await requestBrandLocationApi<{ location: ManagedLocation }>(
        `/api/brands/${activeBrand.id}/locations`,
        {
          method: 'POST',
          body: JSON.stringify({
            countryCode: searchCountryCode,
            languageCode: searchLanguageCode,
            topics: keywords,
            competitors,
          }),
        },
      );

      // Refresh first so the queued selection can be verified against the
      // authenticated portfolio as soon as React applies it.
      await refreshPortfolio();
      previousLocationScopeRef.current = `${activeBrand.id}:${location.id}`;
      selectLocation(location.id);
      setIsConfirmingNewLocation(false);
      await runFindAffiliates(location.id);
    } catch (error) {
      setSearchLocationError(formatSearchLocationError(error));
    } finally {
      setIsCreatingSearchLocation(false);
    }
  };

  const toggleSave = (item: ResultItem) => {
    if (isAffiliateSaved(item)) {
      removeAffiliate(item);
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
      
      // Apr 28, 2026: i18n-migrated phase strings; previously hardcoded English.
      // The "running" badge stays as raw `${elapsed}s` since the seconds suffix
      // reads identically in EN and DE.
      const progress = t.dashboard.find.loading.progress;
      switch (searchProgress.status) {
        case 'starting':
          return {
            title: progress.starting.title,
            subtitle: progress.starting.subtitle,
            badge: progress.starting.badge,
          };
        case 'running':
          return {
            title: `${progress.running.title} (${elapsed}s)`,
            subtitle: progress.running.subtitle,
            badge: `${elapsed}s`,
          };
        case 'processing':
          return {
            title: progress.processing.title,
            subtitle: progress.processing.subtitle,
            badge: progress.processing.badge,
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
    // April 28, 2026: Now uses the shared affiliateMatchesSearchQuery helper.
    // Adds personName, summary, channel.name, IG/TT username + display name to
    // the searched fields so users can find creators by handle/name, not just
    // by article title or domain. Discovered + Saved use the same helper, so
    // the three pages stay in sync. See utils/affiliate-search.ts for details.
    if (searchQuery.trim()) {
      filtered = filtered.filter(r => affiliateMatchesSearchQuery(r, searchQuery));
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
  // VISIBLE SELECTION - Location-aware so identical links cannot collide.
  // ============================================================================
  const visibleSelectedAffiliateKeys = useMemo(() => {
    const visibleKeys = new Set(filteredResults.map(affiliateIdentityKey));
    const visible = new Set<string>();
    selectedAffiliateKeys.forEach((key) => {
      if (visibleKeys.has(key)) {
        visible.add(key);
      }
    });
    return visible;
  }, [selectedAffiliateKeys, filteredResults]);

  // ============================================================================
  // BULK SELECTION HANDLERS (Added Dec 2025)
  // ============================================================================
  
  const toggleSelectItem = (item: ResultItem) => {
    const key = affiliateIdentityKey(item);
    setSelectedAffiliateKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    setSelectedAffiliateKeys(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach((item) => newSet.add(affiliateIdentityKey(item)));
      return newSet;
    });
  };

  const deselectAll = () => {
    setSelectedAffiliateKeys(new Set());
  };
  
  const deselectAllVisible = () => {
    setSelectedAffiliateKeys(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach((item) => newSet.delete(affiliateIdentityKey(item)));
      return newSet;
    });
  };

  const handleBulkSave = async () => {
    if (visibleSelectedAffiliateKeys.size === 0) return;
    
    setIsBulkSaving(true);
    setSavingLinks(new Set(visibleSelectedAffiliateKeys));
    
    try {
      const affiliatesToSave = results.filter((item) =>
        visibleSelectedAffiliateKeys.has(affiliateIdentityKey(item)),
      );
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
      
      setSelectedAffiliateKeys(prev => {
        const newSet = new Set(prev);
        visibleSelectedAffiliateKeys.forEach((key) => newSet.delete(key));
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
    if (visibleSelectedAffiliateKeys.size === 0) return;
    setIsDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (visibleSelectedAffiliateKeys.size === 0) return;
    
    const affiliatesToDelete = results.filter((item) =>
      visibleSelectedAffiliateKeys.has(affiliateIdentityKey(item)),
    );
    const deleteCount = affiliatesToDelete.length;
    setIsBulkDeleting(true);
    try {
      await removeDiscoveredAffiliatesBulk(affiliatesToDelete);
      
      setResults(prev => prev.filter((item) =>
        !visibleSelectedAffiliateKeys.has(affiliateIdentityKey(item)),
      ));
      
      setSelectedAffiliateKeys(prev => {
        const newSet = new Set(prev);
        visibleSelectedAffiliateKeys.forEach((key) => newSet.delete(key));
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
      setSelectedAffiliateKeys(new Set());
    }
  }, [loading]);

  const handleSingleDelete = async (item: ResultItem) => {
    const itemKey = affiliateIdentityKey(item);
    setResults(prev => prev.filter((candidate) => affiliateIdentityKey(candidate) !== itemKey));
    setSelectedAffiliateKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemKey);
      return newSet;
    });
    await removeDiscoveredAffiliate(item);
    
    setDeleteResult({ count: 1, show: true });
    setTimeout(() => {
      setDeleteResult(prev => prev ? { ...prev, show: false } : null);
    }, 3000);
  };

  const normalizeDomainForCompare = (d: string) => (d || '').toLowerCase().replace(/^www\./, '');
  const [isBulkBlocking, setIsBulkBlocking] = useState(false);
  const handleBulkBlockDomains = async () => {
    if (visibleSelectedAffiliateKeys.size === 0) return;
    const selectedItems = filteredResults.filter((item) =>
      selectedAffiliateKeys.has(affiliateIdentityKey(item)),
    );
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
      setSelectedAffiliateKeys(prev => {
        const next = new Set(prev);
        selectedItems
          .filter(r => blockedSet.has(normalizeDomainForCompare(r.domain)))
          .forEach(r => next.delete(affiliateIdentityKey(r)));
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
  // DESIGN UPDATE: Originally neo-brutalist from DashboardDemo.tsx (border-4,
  // industrial typography, offset shadows). Migrated to "smoover" across
  // multiple PRs in April 2026 — see in-line docblocks above each migrated
  // surface (table chrome, toasts, loading skeleton, plus AffiliateRow.tsx
  // for the row + modals). What remains brutalist now is documented at the
  // call-site of any individual block; the header itself + table outer +
  // toasts + loading skeleton are smoover as of April 25, 2026.
  //
  // NOTE: The outer div with flex and Sidebar is NOT here.
  // It's in the parent layout.tsx file (src/app/(dashboard)/layout.tsx).
  // This component only renders the main content area.
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
        <h1 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">{t.dashboard.find.pageTitle}</h1>

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

          {/* Find button — rounded-full yellow CTA with soft glow, matches landing hero */}
          <button 
            onClick={() => setIsFindModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-[#0f172a] font-semibold text-sm rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus size={14} strokeWidth={2.5} /> {t.dashboard.header.findAffiliates}
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
        
        {/* =============================================================================
            PREVIOUS-RESULTS WARNING BANNER
            Smoover refresh (April 23rd, 2026) — Phase 2e
            ---------------------------------------------------------------------------
            Shown briefly after a new search to let the user know the list has been
            cleared. Previously neo-brutalist (Jan 9, 2026): border-2 yellow, square
            corners, font-bold black text, square icon tile.
            Now: hairline yellow/30 border, rounded-xl, shadow-soft-sm; icon tile is
            a rounded-full yellow badge with shadow-yellow-glow-sm matching the
            landing hero CTA; heading font-semibold, body muted.
            ============================================================================= */}
        {showWarning && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#ffbf23]/10 border border-[#ffbf23]/30 rounded-xl shadow-soft-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-center w-8 h-8 bg-[#ffbf23] rounded-full shadow-yellow-glow-sm shrink-0">
              <Search size={16} className="text-[#0f172a]" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0f172a]">{t.dashboard.find.newSearchWarning.title}</p>
              <p className="text-xs text-[#8898aa] mt-0.5">
                {t.dashboard.find.newSearchWarning.subtitle}
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-[#8898aa] hover:text-[#0f172a] transition-colors p-1 rounded-full hover:bg-[#ffbf23]/20"
              aria-label="Dismiss"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* =============================================================================
            FILTERS ROW
            
            LAYOUT FIX - January 23, 2026
            Restored justify-between layout. FilterPanel now uses a dropdown approach
            so filter pills don't take up horizontal space.

            SMOOVER REFRESH - April 23, 2026
            Scope of this pass: ONLY the search input and the platform pills group
            (left side). Visual tokens aligned with the landing + dashboard header:
              - Hairline borders (#e6ebf1) replace border-2 border-black
              - Fully rounded pill shapes (rounded-full) replace rounded corners
              - Softer text colors (#8898aa muted, #0f172a ink, #425466 body)
              - Soft drop shadows (shadow-soft-sm) and yellow glow on focus/active
                (shadow-yellow-glow-sm) instead of hard neo-brutalist shadows
              - Interactive behaviour, state, filter counts, i18n strings,
                dark-mode support, icons, and the FilterPanel trigger on the
                right are all UNCHANGED in this pass.
            The FilterPanel trigger button (right side) is defined inside
            components/FilterPanel.tsx and is shared across 4 pages; it will
            be restyled in its own PR so the four pages flip together.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Search Input — Translated (January 9th, 2026).
                Smoover refresh (April 23, 2026): hairline border, rounded-full
                pill, soft bg, muted placeholder, yellow glow on focus. */}
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
                Smoover refresh (April 23, 2026): container pill wrapper with
                off-white bg (#f6f9fc) + hairline border + soft shadow. Each
                pill is rounded-full. Active pill gets the yellow glow to echo
                the landing hero CTA. Count badge inside active pill uses a
                translucent dark overlay; inside inactive pills, a white pill
                with hairline border (so it reads against the off-white tray). */}
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
                  {hasSearched && tab.count > 0 && (
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
              affiliates={results}
              activeFilters={advancedFilters}
              onFilterChange={setAdvancedFilters}
              isOpen={isFilterPanelOpen}
              onClose={() => setIsFilterPanelOpen(false)}
              onOpen={() => setIsFilterPanelOpen(true)}
              userCompetitors={activeLocation?.competitors ?? user?.competitors ?? undefined}
              userTopics={activeLocation?.topics ?? user?.topics ?? undefined}
            />
          </div>
        </div>

        {/* 
          OLD_DESIGN - Filters Section (pre-January 6th, 2026)
          Previously used: D4E815 lime accents, rounded-lg pills, max-w-160px search
          To restore: See git history for this file
        */}

        {/* =============================================================================
            BULK ACTIONS BAR
            Smoover refresh (April 23rd, 2026) — Phase 2e
            ---------------------------------------------------------------------------
            Previously neo-brutalist (Jan 16, 2026): square corners, hard-black
            border, `font-black uppercase`, offset shadow-[2px_2px_0px_0px_#000].
            Now aligned with the landing-page smoover voice:
              - Container: hairline border + `rounded-2xl` + `shadow-soft-sm`
              - Yellow check icon: rounded-full + `shadow-yellow-glow-sm`
              - Selected count: normal case, `font-semibold`
              - Action buttons: rounded-full with `shadow-soft-sm` (destructive /
                warning) or `shadow-yellow-glow-sm` (primary yellow), subtle
                `hover:-translate-y-0.5` lift.
            Logic / handlers / i18n strings unchanged.
            ============================================================================= */}
        {visibleSelectedAffiliateKeys.size > 0 && (() => {
          const selectedItems = filteredResults.filter((item) =>
            visibleSelectedAffiliateKeys.has(affiliateIdentityKey(item)),
          );
          const alreadySavedCount = selectedItems.filter(isAffiliateSaved).length;
          const newToSaveCount = selectedItems.length - alreadySavedCount;
          const allVisibleSelected = visibleSelectedAffiliateKeys.size === filteredResults.length;
          
          return (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-sm">
            {/* Left: Selection info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Checkbox icon — rounded yellow badge with soft glow */}
                <div className="w-6 h-6 bg-[#ffbf23] rounded-full flex items-center justify-center shadow-yellow-glow-sm">
                  <Check size={14} className="text-[#0f172a]" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-[#0f172a] dark:text-white">
                  {visibleSelectedAffiliateKeys.size} {t.dashboard.find.bulkActions.selected}
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

            {/* Right: Action buttons */}
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
                {isBulkDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} strokeWidth={2} />
                )}
                {t.dashboard.find.bulkActions.deleteSelected}
              </button>

              {/* Save — primary yellow CTA (matches landing hero button) */}
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
                {isBulkSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} strokeWidth={2} />
                )}
                {newToSaveCount === 0 ? t.dashboard.find.bulkActions.allAlreadySaved : `${newToSaveCount} ${t.dashboard.find.bulkActions.saveToPipeline}`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE OUTER + HEADER ROW — smoover refresh (April 25, 2026)
            -----------------------------------------------------------------------------
            Brutalist -> smoover migration of the search-results table chrome.
            Mirrors the smoover treatment used by Settings -> Plan invoice table
            (PR #33) so all dashboard tables share one visual voice.

            Outer container:
              Was:  border-4 border-gray-200 + rounded-lg (heavy gray frame,
                    DashboardDemo.tsx-derived styling).
              Now:  hairline border-[#e6ebf1] + rounded-xl + shadow-soft-sm
                    (soft elevation, no heavy frame).
              Preserved: max-w-full + overflow-hidden. These exist for the
                    OVERFLOW FIX (January 23, 2026) — long content like URLs
                    or titles was causing horizontal expansion that pushed
                    the filter button off-screen. DO NOT remove them.

            Header row:
              Was:  border-b-2 border-gray-100 + font-black + text-gray-400 +
                    uppercase + tracking-widest (brutalist column header).
              Now:  bg-[#f6f9fc] subtle tint + hairline border-b + font-
                    semibold + text-[#8898aa] + uppercase + tracking-wider
                    (smoover eyebrow pattern). text-[10px] sizing preserved
                    — kept compact for the dense dashboard density.

            Behaviour preserved 1:1:
              - 12-column grid, identical column spans
                (1 checkbox + 3 affiliate + 3 content + 2 discovery + 1 date
                + 2 action). MUST stay in sync with AffiliateRow.tsx render.
              - Select-all checkbox logic + accent-[#ffbf23] color.
              - All i18n keys (t.dashboard.table.*).

            Same change applied to /discovered + /saved page tables. If you
            tweak the visual here, mirror it in those two files for a
            consistent dashboard chrome. ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl shadow-soft-sm min-h-[500px] flex flex-col max-w-full overflow-hidden">
          {/* Table Header — smoover (Apr 25, 2026); see docblock above. */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#f6f9fc] dark:bg-gray-800/50 border-b border-[#e6ebf1] dark:border-gray-800 text-[10px] font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 flex justify-center">
              <input
                type="checkbox"
                checked={filteredResults.length > 0 && visibleSelectedAffiliateKeys.size === filteredResults.length}
                onChange={() => visibleSelectedAffiliateKeys.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
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
                      LOADING PROGRESS INDICATOR
                      Smoover refresh (April 23rd, 2026) — Phase 2e
                      ---------------------------------------------------------------------------
                      Banner shown inline above streaming rows while a search is in flight.
                      Before: neo-brutalist (Jan 16, 2026) — border-b-2 + font-black uppercase
                      title + yellow badge wrapped in border-2 black square.
                      After: hairline border-b, font-semibold normal case, rounded-full yellow
                      badge with shadow-yellow-glow-sm. Spinner ring weight dropped 4 → 2 to
                      match the lighter smoover voice.
                      ============================================================================= */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#ffbf23]/10 border-b border-[#ffbf23]/30">
                    <div className="w-5 h-5 border-[2px] border-[#ffbf23] border-t-transparent rounded-full animate-spin"></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0f172a] dark:text-white">
                        {loadingMessage.title}
                      </p>
                      <p className="text-xs text-[#8898aa] dark:text-gray-400">
                        {loadingMessage.subtitle}
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-[#0f172a] bg-[#ffbf23] px-2.5 py-1 rounded-full shadow-yellow-glow-sm">
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
                        isSaved={isAffiliateSaved(group.main)}
                        onSave={() => toggleSave(group.main)}
                        thumbnail={group.main.thumbnail}
                        views={group.main.views}
                        date={group.main.date}
                        snippet={group.main.snippet}
                        highlightedWords={group.main.highlightedWords}
                        discoveryMethod={group.main.discoveryMethod}
                        email={group.main.email}
                        // 2026-05-26 (paras): see discovered/page.tsx for context.
                        // usePollingSearch / /api/search/status don't populate isNew,
                        // so this is always false here = no NEW badges on /find for now.
                        // TODO(paras): plumb isNew through the polling search backend
                        // so live results can flag genuinely-new rows.
                        isNew={group.main.isNew ?? false}
                        subItems={group.subItems}
                        channel={group.main.channel}
                        duration={group.main.duration}
                        personName={group.main.personName}
                        isSelected={selectedAffiliateKeys.has(affiliateIdentityKey(group.main))}
                        onSelect={() => toggleSelectItem(group.main)}
                        isSaving={savingLinks.has(affiliateIdentityKey(group.main))}
                        onDelete={() => handleSingleDelete(group.main)}
                        affiliateData={group.main}
                        currentUser={user}
                        searchQuery={searchQuery}
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
                      isSaved={isAffiliateSaved(group.main)}
                      onSave={() => toggleSave(group.main)}
                      thumbnail={group.main.thumbnail}
                      views={group.main.views}
                      date={group.main.date}
                      snippet={group.main.snippet}
                      highlightedWords={group.main.highlightedWords}
                      discoveryMethod={group.main.discoveryMethod}
                      email={group.main.email}
                      // 2026-05-26 (paras): see streaming-mode AffiliateRow above for
                      // full context + TODO on plumbing isNew through polling search.
                      isNew={group.main.isNew ?? false}
                      subItems={group.subItems}
                      channel={group.main.channel}
                      duration={group.main.duration}
                      personName={group.main.personName}
                      isSelected={selectedAffiliateKeys.has(affiliateIdentityKey(group.main))}
                      onSelect={() => toggleSelectItem(group.main)}
                      isSaving={savingLinks.has(affiliateIdentityKey(group.main))}
                      onDelete={() => handleSingleDelete(group.main)}
                      affiliateData={group.main}
                      currentUser={user}
                      searchQuery={searchQuery}
                    />
                  </div>
                ))
              )}
            </div>
          ) : hasSearched && !loading && creditError ? (
            // =================================================================
            // CREDIT ERROR BANNER — January 4th, 2026
            // Translated (January 9th, 2026)
            // Smoover polish (April 23rd, 2026) — added shadow-soft-sm, bumped
            // heading from font-bold → font-semibold. Already used rounded-xl
            // and hairline amber border so structural styling stayed intact.
            // =================================================================
            <div className="py-12 text-center">
              <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-xl shadow-soft-sm p-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-amber-800 mb-2">
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
            /* No-results text — soft mute colour, minimal (Apr 23, 2026) */
            <div className="py-20 text-center text-[#8898aa] text-sm">
              {t.dashboard.find.noResults}
            </div>
          ) : (
            /* =============================================================================
               EMPTY STATE
               Smoover refresh (April 23rd, 2026) — Phase 2e
               Icon badge: soft #f6f9fc fill + hairline border + shadow-soft-sm.
               Typography: font-semibold (was font-black) + muted body.
               ============================================================================= */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-[#f6f9fc] dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-[#e6ebf1] dark:border-gray-800 shadow-soft-sm">
                <Search size={24} className="text-[#8898aa]" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold text-[#0f172a] dark:text-white mb-1">
                {t.dashboard.find.emptyState.title}
              </h3>
              <p className="text-[#8898aa] text-sm max-w-xs">
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

      {/* Search state and handlers stay unchanged; this block only controls presentation. */}
      <Modal 
        isOpen={isFindModalOpen} 
        onClose={() => setIsFindModalOpen(false)}
        title=""
        width="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-[#e6ebf1] pb-4 dark:border-gray-800">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffbf23] shadow-yellow-glow-sm">
              <Search size={20} className="text-[#0f172a]" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2">
              <h2 className="shrink-0 font-display text-lg font-semibold tracking-tight text-[#0f172a] dark:text-white">
                {t.dashboard.find.modal.title}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-[#8898aa] sm:mt-0">
                {t.dashboard.find.modal.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFindModalOpen(false)}
              aria-label="Close modal"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:bg-[#f6f9fc] hover:text-[#0f172a] active:scale-95 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <section className="rounded-2xl border border-[#e6ebf1] bg-[#f8fafc] p-2.5 shadow-soft-sm dark:border-gray-800 dark:bg-white/[0.025]">
            <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 px-1 pb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#425466] dark:text-gray-300">
                <MapPin size={14} className="text-[#ffbf23]" strokeWidth={2.25} />
                {t.dashboard.find.modal.targetMarket}
              </span>
              <span className="hidden h-3.5 w-px bg-[#d8e0e8] sm:block dark:bg-gray-700" aria-hidden="true" />
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#8898aa] dark:text-gray-500">
                <Globe size={12} className="shrink-0" strokeWidth={2} />
                <span className="sr-only">{t.dashboard.find.modal.websiteLabel}:</span>
              {canEditBrandInline ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                {isEditingBrand ? (
                  <>
                    {editBrand && (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${editBrand}&sz=16`}
                        alt=""
                        className="w-4 h-4 shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <input
                      type="text"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      placeholder={user?.brand || 'example.com'}
                      className="min-w-28 flex-1 rounded-lg border border-[#e6ebf1] bg-white px-2 py-1 text-xs text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8898aa] focus:border-[#ffbf23]/60 focus:ring-2 focus:ring-[#ffbf23]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && hasBrandChange && !isSavingBrand && userId) {
                          e.preventDefault();
                          try {
                            setIsSavingBrand(true);
                            await fetch('/api/users', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                brand: editBrand.trim(),
                              }),
                            });
                            await refetch?.();
                            setIsEditingBrand(false);
                          } catch (err) {
                            console.error('[FindNewPage] Failed to save brand from input:', err);
                          } finally {
                            setIsSavingBrand(false);
                          }
                        }
                      }}
                    />
                    {hasBrandChange && (
                      <button
                        type="button"
                        disabled={isSavingBrand || !userId}
                        onClick={async () => {
                          if (!hasBrandChange || !userId) return;
                          try {
                            setIsSavingBrand(true);
                            await fetch('/api/users', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                brand: editBrand.trim(),
                              }),
                            });
                            await refetch?.();
                            setIsEditingBrand(false);
                          } catch (err) {
                            console.error('[FindNewPage] Failed to save brand from checkmark:', err);
                          } finally {
                            setIsSavingBrand(false);
                          }
                        }}
                        aria-label={isSavingBrand ? 'Saving brand' : 'Save brand'}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-emerald-600 transition-[background-color,color,transform] duration-150 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 disabled:opacity-50 dark:hover:bg-emerald-900/20"
                      >
                        {isSavingBrand ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} strokeWidth={2.5} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingBrand(false)}
                      aria-label="Cancel editing brand"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:bg-white hover:text-[#0f172a] active:scale-95 dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <>
                    {user?.brand && (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${user.brand}&sz=16`}
                        alt=""
                        className="w-4 h-4 shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span className="truncate font-medium text-[#425466] dark:text-gray-300">
                      {user?.brand || editBrand || t.dashboard.find.modal.notSetDuringOnboarding}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBrand(user?.brand || editBrand || '');
                        setIsEditingBrand(true);
                      }}
                      aria-label="Edit brand"
                      className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-[#e6ebf1] bg-white text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:text-[#0f172a] active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  </>
                )}
                </span>
              ) : displayedBrandDomain ? (
                <>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${displayedBrandDomain}&sz=16`}
                    alt=""
                    className="w-4 h-4 shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="truncate font-medium text-[#425466] dark:text-gray-300">{displayedBrandDomain}</span>
                </>
              ) : (
                <span className="italic text-[#8898aa]">{t.dashboard.find.modal.notSetDuringOnboarding}</span>
              )}
              </span>
              {brandLocationsEnabled && searchCountryCode && searchLanguageCode && (
                <span className={cn(
                  'ml-auto inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  matchingSearchLocation
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
                )}>
                  {matchingSearchLocation
                    ? <Check size={11} strokeWidth={2.75} />
                    : <Plus size={11} strokeWidth={2.5} />}
                  {matchingSearchLocation
                    ? t.dashboard.find.modal.savedLocation
                    : t.dashboard.find.modal.newLocation}
                </span>
              )}
            </div>

            {brandLocationsEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <label className="relative block min-w-0">
                  <span className="sr-only">{t.dashboard.brandLocations.country}</span>
                  <select
                    aria-label={t.dashboard.brandLocations.country}
                    value={searchCountryCode}
                    onChange={(event) => {
                      selectSearchMarket(event.target.value, searchLanguageCode);
                    }}
                    disabled={loading || isCreatingSearchLocation}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  >
                    {MARKET_COUNTRIES.map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>
                        {language === 'de' ? country.nameDE : country.name}
                      </option>
                    ))}
                  </select>
                  <span className="flex h-14 items-center gap-2.5 rounded-xl border border-[#d8e0e8] bg-white px-3 text-left shadow-soft-sm transition-[border-color,background-color,box-shadow,transform] duration-150 peer-hover:border-[#b9c4d0] peer-focus-visible:border-[#ffbf23] peer-focus-visible:ring-2 peer-focus-visible:ring-[#ffbf23]/20 peer-active:scale-[0.99] peer-disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:peer-hover:border-gray-600">
                    {selectedSearchCountryFlagUrl ? (
                      // These are tiny, size-specific country flags; optimizing them adds overhead.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedSearchCountryFlagUrl}
                        alt=""
                        width={24}
                        height={18}
                        className="h-[18px] w-6 shrink-0 rounded-[3px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                      />
                    ) : (
                      <Globe size={18} className="shrink-0 text-[#8898aa]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
                        {t.dashboard.brandLocations.country}
                      </span>
                      <span className="block truncate text-sm font-semibold text-[#0f172a] dark:text-white" title={selectedSearchCountryLabel}>
                        {selectedSearchCountryLabel ?? '—'}
                      </span>
                    </span>
                    <ChevronDown size={15} className="shrink-0 text-[#8898aa]" strokeWidth={2} />
                  </span>
                </label>
                <label className="relative block min-w-0">
                  <span className="sr-only">{t.dashboard.brandLocations.language}</span>
                  <select
                    aria-label={t.dashboard.brandLocations.language}
                    value={searchLanguageCode}
                    onChange={(event) => {
                      selectSearchMarket(searchCountryCode, event.target.value);
                    }}
                    disabled={loading || isCreatingSearchLocation}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  >
                    {MARKET_LANGUAGES.map((marketLanguage) => (
                      <option key={marketLanguage.isoCode} value={marketLanguage.isoCode}>
                        {language === 'de' ? marketLanguage.nameDE : marketLanguage.name}
                      </option>
                    ))}
                  </select>
                  <span className="flex h-14 items-center gap-2.5 rounded-xl border border-[#d8e0e8] bg-white px-3 text-left shadow-soft-sm transition-[border-color,background-color,box-shadow,transform] duration-150 peer-hover:border-[#b9c4d0] peer-focus-visible:border-[#ffbf23] peer-focus-visible:ring-2 peer-focus-visible:ring-[#ffbf23]/20 peer-active:scale-[0.99] peer-disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:peer-hover:border-gray-600">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#fff4d1] text-[#9a6b00] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]">
                      <Languages size={16} strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
                        {t.dashboard.brandLocations.language}
                      </span>
                      <span className="block truncate text-sm font-semibold text-[#0f172a] dark:text-white" title={selectedSearchLanguageLabel}>
                        {selectedSearchLanguageLabel ?? '—'}
                      </span>
                    </span>
                    <ChevronDown size={15} className="shrink-0 text-[#8898aa]" strokeWidth={2} />
                  </span>
                </label>
              </div>
            )}
          </section>
          {brandLocationsEnabled && searchLocationError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {searchLocationError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left Column — Keywords */}
            <div className="flex flex-col">
              <label htmlFor="affiliate-keyword" className="flex h-7 items-center gap-2 text-sm font-semibold text-[#0f172a] dark:text-gray-200">
                <Search size={14} className="text-[#425466] dark:text-gray-400" strokeWidth={2} />
                {t.dashboard.find.modal.keywordsLabel}
                <span className="ml-auto text-xs font-semibold text-[#8898aa] tabular-nums">
                  {keywords.length}/{MAX_KEYWORDS}
                </span>
              </label>
              
              <div className="relative mt-2">
                <input
                  id="affiliate-keyword"
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
                  className="h-10 w-full rounded-lg border border-[#e6ebf1] bg-white px-3 pr-[72px] text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8898aa] focus:border-[#ffbf23]/60 focus:ring-2 focus:ring-[#ffbf23]/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  disabled={!keywordInput.trim() || keywords.length >= MAX_KEYWORDS}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-[#ffbf23] px-3 py-1.5 text-xs font-semibold text-[#0f172a] transition-[background-color,transform] duration-150 hover:bg-[#e5ac20] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#f6f9fc] disabled:text-[#8898aa] disabled:shadow-none dark:disabled:bg-gray-800"
                >
                  {t.dashboard.find.modal.addButton}
                </button>
              </div>

              <div className="mt-2 min-h-[128px] max-h-[128px] flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] p-2 no-scrollbar dark:border-gray-800 dark:bg-gray-900">
                {keywords.length > 0 ? (
                  keywords.map((kw, idx) => (
                    <div
                      key={kw}
                      className="group flex items-center gap-2 rounded-lg border border-[#e6ebf1] bg-white px-2.5 py-1.5 text-sm transition-[border-color,background-color] duration-150 hover:border-[#cdd5df] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[#0f172a] dark:text-gray-200 truncate flex-1 font-medium">{kw}</span>
                      <button
                        onClick={() => removeKeyword(kw)}
                        aria-label={`Remove keyword ${kw}`}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:bg-red-50 hover:text-red-500 active:scale-95 dark:hover:bg-red-900/20"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-[#8898aa] text-xs italic">
                    {t.dashboard.find.modal.noKeywordsYet}
                  </div>
                )}
              </div>

              <div className="h-5 mt-1.5">
                {keywords.length > 0 && (
                  <button
                    onClick={() => setKeywords([])}
                    className="text-xs font-semibold text-[#8898aa] transition-colors duration-150 hover:text-red-500"
                  >
                    {t.dashboard.find.modal.clearAllKeywords}
                  </button>
                )}
              </div>
            </div>

            {/* Right Column — Competitors (mirrors Keywords exactly) */}
            <div className="flex flex-col">
              <label htmlFor="affiliate-competitor" className="flex h-7 items-center gap-2 text-sm font-semibold text-[#0f172a] dark:text-gray-200">
                {/* Inline arrow SVG kept (not a lucide icon); only colour + stroke tuned */}
                <svg className="w-3.5 h-3.5 text-[#425466] dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {t.dashboard.find.modal.competitorsInputLabel}
                <span className="ml-auto text-xs font-semibold text-[#8898aa] tabular-nums">
                  {competitors.length}/{MAX_COMPETITORS}
                </span>
              </label>
              <div className="relative mt-2">
                <input
                  id="affiliate-competitor"
                  type="text"
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCompetitor();
                    }
                  }}
                  placeholder={t.dashboard.find.modal.competitorsPlaceholder}
                  disabled={competitors.length >= MAX_COMPETITORS}
                  className="h-10 w-full rounded-lg border border-[#e6ebf1] bg-white px-3 pr-[72px] text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8898aa] focus:border-[#ffbf23]/60 focus:ring-2 focus:ring-[#ffbf23]/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addCompetitor}
                  disabled={!competitorInput.trim() || competitors.length >= MAX_COMPETITORS}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-[#ffbf23] px-3 py-1.5 text-xs font-semibold text-[#0f172a] transition-[background-color,transform] duration-150 hover:bg-[#e5ac20] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#f6f9fc] disabled:text-[#8898aa] disabled:shadow-none dark:disabled:bg-gray-800"
                >
                  {t.dashboard.find.modal.addCompetitorButton}
                </button>
              </div>
              <div className="mt-2 min-h-[128px] max-h-[128px] flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] p-2 no-scrollbar dark:border-gray-800 dark:bg-gray-900">
                {competitors.length > 0 ? (
                  competitors.map((comp) => (
                    <div
                      key={comp}
                      className="group flex items-center gap-2 rounded-lg border border-[#e6ebf1] bg-white px-2.5 py-1.5 text-sm transition-[border-color,background-color] duration-150 hover:border-[#cdd5df] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${comp}&sz=16`}
                        alt=""
                        className="w-3.5 h-3.5 shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <span className="text-[#0f172a] dark:text-gray-200 truncate flex-1 font-medium text-xs">{comp}</span>
                      <button
                        onClick={() => removeCompetitor(comp)}
                        aria-label={`Remove competitor ${comp}`}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:bg-red-50 hover:text-red-500 active:scale-95 dark:hover:bg-red-900/20"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-[#8898aa] text-xs italic">
                    {t.dashboard.find.modal.noCompetitorsYet}
                  </div>
                )}
              </div>
              <div className="h-5 mt-1.5">
                {competitors.length > 0 && (
                  <button
                    onClick={() => setCompetitors([])}
                    className="text-xs font-semibold text-[#8898aa] transition-colors duration-150 hover:text-red-500"
                  >
                    {t.dashboard.find.modal.clearAllCompetitors}
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] leading-4 text-[#8898aa] dark:text-gray-500">
            {t.dashboard.find.modal.keywordsHelper}
          </p>

          <button
            type="button"
            onClick={handleFindAffiliates}
            disabled={
              keywords.length === 0
              || loading
              || (brandLocationsEnabled && (!searchCountryCode || !searchLanguageCode))
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ffbf23] font-semibold text-[#0f172a] shadow-yellow-glow transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#e5ac20] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#f6f9fc] disabled:text-[#8898aa] disabled:shadow-none disabled:active:scale-100 dark:disabled:bg-gray-800"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-[2.5px] border-[#0f172a] border-t-transparent rounded-full animate-spin"></div>
                {t.dashboard.find.modal.searching}
              </>
            ) : (
              <>
                <Search size={18} strokeWidth={2} />
                {t.dashboard.find.modal.ctaButton}
              </>
            )}
          </button>

        </div>
      </Modal>

      <Modal
        isOpen={isConfirmingNewLocation}
        onClose={isCreatingSearchLocation ? () => undefined : () => setIsConfirmingNewLocation(false)}
        title={t.dashboard.find.modal.confirmLocationTitle}
        width="max-w-lg"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-[#425466] dark:text-gray-300">
            {t.dashboard.find.modal.confirmLocationMessage
              .replace('{market}', selectedSearchMarketLabel)
              .replace('{brand}', activeBrand?.name ?? '')}
          </p>
          {searchLocationError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {searchLocationError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-[#e6ebf1] pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsConfirmingNewLocation(false)}
              disabled={isCreatingSearchLocation}
              className="min-h-10 rounded-full border border-[#d8e0e8] bg-white px-5 py-2 text-sm font-medium text-[#425466] transition-[background-color,scale] duration-150 hover:bg-[#f6f9fc] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={confirmNewSearchLocation}
              disabled={isCreatingSearchLocation}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingSearchLocation && <Loader2 size={15} className="animate-spin" />}
              {isCreatingSearchLocation
                ? t.dashboard.find.modal.addingLocation
                : t.dashboard.find.modal.addLocationAndSearch}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        itemCount={visibleSelectedAffiliateKeys.size}
        isDeleting={isBulkDeleting}
        itemType="affiliate"
      />

      {/* =============================================================================
          DASHBOARD FEEDBACK TOASTS — smoover refresh (April 25, 2026)
          -----------------------------------------------------------------------------
          Two toast components live in this file (bulk-save success + delete).
          Identical templates also live in /discovered (2 toasts) and /saved
          (2 toasts: delete + a 4-variant email-results toast). All six share
          this template; if you tweak the visual here, mirror the change
          across those files for a consistent dashboard chrome.

          Brutalist -> smoover mapping (same for every toast):
            - Outer card: border-2 border-black + shadow-[4px_4px_0px_0px_#000]
                          -> border border-[#e6ebf1] + rounded-2xl +
                          shadow-soft-xl (matches the shared Modal.tsx shell).
            - Icon tile:  w-10 h-10 bg-*-500 + border-2 border-black (square)
                          -> w-10 h-10 bg-*-500 + rounded-full + shadow-soft-sm
                          (round colored badge, no black frame).
            - Title h4:   text-sm font-black uppercase
                          -> text-sm font-semibold text-[#0f172a] (drops
                          uppercase + drops font-black).
            - Body p:     text-xs text-gray-600
                          -> text-xs text-[#425466] (smoover muted body).
            - Inline sub-line (amber duplicates etc.): font-bold -> font-semibold.
            - Close button: text-gray-400 hover:text-black (plain X)
                            -> w-7 h-7 rounded-full + text-[#8898aa] +
                            hover:text-[#0f172a] + hover:bg-[#f6f9fc]
                            (smoover ghost close, matches Modal.tsx + the
                            Email Results modal close in AffiliateRow.tsx).

          Behaviour preserved 1:1: positioning (fixed bottom-6 right-6 z-50),
          slide-in / fade-in animation, dismiss handler, every i18n key.
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

