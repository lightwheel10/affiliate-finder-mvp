'use client';

/**
 * =============================================================================
 * FIND NEW AFFILIATES PAGE - January 3rd, 2026
 * =============================================================================
 * 
 * This page provides the main "Find New Affiliates" functionality:
 *   - Multi-keyword search across YouTube, Instagram, TikTok, and Web
 *   - Real-time streaming results with progressive rendering
 *   - Bulk selection and save to pipeline
 *   - Advanced filtering by platform, subscribers, date, etc.
 * 
 * ARCHITECTURE NOTES:
 * -------------------
 * This page is part of the (dashboard) route group, which means:
 *   - URL is /find (not /(dashboard)/find)
 *   - Sidebar is rendered in the parent layout.tsx (not here)
 *   - AuthGuard is also in the parent layout.tsx
 *   - Navigation to other dashboard pages won't remount the Sidebar
 * 
 * MOVED FROM:
 * -----------
 * This was originally the Dashboard component inside src/app/page.tsx.
 * It was moved here on January 3rd, 2026 to:
 *   1. Enable the shared dashboard layout pattern
 *   2. Prevent Sidebar remount when navigating to/from this page
 *   3. Allow src/app/page.tsx to be a pure landing page
 * 
 * =============================================================================
 */

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { FilterPanel } from '../../components/FilterPanel';

const MAX_KEYWORDS = 5;

export default function FindNewPage() {
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

  const handleFindAffiliates = async () => {
    if (keywords.length === 0) return;
    
    const hadPreviousResults = results.length > 0;
    
    setLoading(true);
    setResults([]);
    setHasSearched(true);
    setIsFindModalOpen(false);
    setCurrentPage(1);
    setAnimationKey(prev => prev + 1);
    // ==========================================================================
    // CREDIT ERROR RESET - January 4th, 2026
    // Clear any previous credit error when starting a new search
    // ==========================================================================
    setCreditError(null);
    
    if (hadPreviousResults) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    }

    const combinedKeyword = keywords.join(' | ');
    const streamedResults: ResultItem[] = [];
    const resultsToSave: ResultItem[] = [];

    try {
      const searchPromises = keywords.map(async (kw) => {
        const res = await fetch('/api/scout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw, sources: ['Web', 'YouTube', 'Instagram', 'TikTok'], userId }),
        });

        // ======================================================================
        // CREDIT ERROR HANDLING - January 4th, 2026
        // 
        // When user has 0 topic_search credits, API returns 402 (Payment Required)
        // with creditError: true. Previously this was silently ignored and user
        // just saw "No results found" which was confusing.
        // 
        // Now we detect the 402 and show a clear error message explaining they
        // need to upgrade their plan or wait for credits to refresh.
        // ======================================================================
        if (res.status === 402) {
          const errorData = await res.json();
          if (errorData.creditError) {
            setCreditError({
              message: errorData.error || 'Insufficient topic search credits',
              remaining: errorData.remaining ?? 0,
            });
            // January 5th, 2026: Added warning toast for insufficient credits
            toast.warning('Insufficient search credits. Please upgrade your plan.');
            return; // Stop processing this keyword
          }
        }

        const contentType = res.headers.get('content-type');
        
        if (contentType?.includes('text/event-stream')) {
          // STREAMING MODE
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const result = JSON.parse(data);
                  
                  // ================================================================
                  // ENRICHMENT UPDATE HANDLER (December 16, 2025)
                  // ================================================================
                  if (result.type === 'enrichment_update') {
                    const domain = result.domain;
                    const similarWebData = result.similarWeb;
                    
                    setResults(prev => prev.map(r => {
                      if (r.domain === domain && r.source === 'Web') {
                        return {
                          ...r,
                          similarWeb: similarWebData,
                          isEnriching: false,
                        };
                      }
                      return r;
                    }));
                    
                    streamedResults.forEach((r, idx) => {
                      if (r.domain === domain && r.source === 'Web') {
                        streamedResults[idx] = {
                          ...r,
                          similarWeb: similarWebData,
                          isEnriching: false,
                        };
                      }
                    });
                    
                    continue;
                  }
                  
                  // Regular affiliate result processing
                  const isCompetitor = kw.toLowerCase().includes('alternative') || 
                                     kw.toLowerCase().includes('vs') || 
                                     kw.toLowerCase().includes('competitor');
                  
                  let methodValue = kw;
                  if (isCompetitor) {
                    methodValue = kw.replace(/alternative|vs|competitor/gi, '').trim();
                  }

                  const enhancedResult: ResultItem = {
                    ...result,
                    rank: result.rank || streamedResults.length + 1,
                    keyword: result.keyword || kw,
                    discoveryMethod: {
                      type: isCompetitor ? 'competitor' as const : 'keyword' as const,
                      value: methodValue || kw
                    },
                    date: result.date || undefined
                  };

                  streamedResults.push(enhancedResult);
                  setResults([...streamedResults]);
                  
                  saveDiscoveredAffiliate(enhancedResult, combinedKeyword).catch(err => {
                    console.error('Failed to save discovered affiliate:', err);
                  });
                  
                } catch (parseError) {
                  console.error('Failed to parse streamed result:', parseError);
                }
              }
            }
          }
        } else {
          // FALLBACK: Non-streaming mode
          const data = await res.json();
          if (data.results) {
            data.results.forEach((r: ResultItem, i: number) => {
              const isCompetitor = kw.toLowerCase().includes('alternative') || 
                                 kw.toLowerCase().includes('vs') || 
                                 kw.toLowerCase().includes('competitor');
              
              let methodValue = kw;
              if (isCompetitor) {
                methodValue = kw.replace(/alternative|vs|competitor/gi, '').trim();
              }

              const enhancedResult: ResultItem = {
                ...r,
                rank: r.rank || i + 1,
                keyword: r.keyword || kw,
                discoveryMethod: {
                  type: isCompetitor ? 'competitor' as const : 'keyword' as const,
                  value: methodValue || kw
                },
                date: r.date || undefined
              };
              
              streamedResults.push(enhancedResult);
              resultsToSave.push(enhancedResult);
            });
            setResults([...streamedResults]);
          }
        }
      });

      await Promise.all(searchPromises);
      
      if (resultsToSave.length > 0) {
        try {
          await saveDiscoveredAffiliates(resultsToSave, combinedKeyword);
        } catch (err) {
          console.error('Failed to batch save discovered affiliates:', err);
        }
      }

      // ==========================================================================
      // CREDITS REFRESH - January 4th, 2026
      // 
      // After search completes, the backend has consumed topic_search credits.
      // Dispatch event to trigger useCredits hook to refetch from database.
      // This ensures the credit display shows the real balance without page refresh.
      // 
      // SAFE: Does NOT modify credits - only triggers a refetch of existing DB value.
      // ==========================================================================
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }
      
    } catch (e: unknown) {
      const error = e as Error;
      if (error.name === 'AbortError') {
        // Search cancelled by user - no notification needed
      } else {
        console.error('Search error:', e);
        // January 5th, 2026: Added error toast for search failures
        toast.error('Search failed. Please try again.');
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

  // Generate dynamic loading message based on which platforms have returned results
  const loadingMessage = useMemo(() => {
    if (results.length === 0) {
      return {
        title: "Scanning the web for affiliates...",
        subtitle: "Searching YouTube, Instagram, TikTok & websites",
        badge: "Starting scan"
      };
    }
    
    const platformResults: string[] = [];
    if (counts.YouTube > 0) platformResults.push(`${counts.YouTube} from YouTube`);
    if (counts.Instagram > 0) platformResults.push(`${counts.Instagram} from Instagram`);
    if (counts.TikTok > 0) platformResults.push(`${counts.TikTok} from TikTok`);
    if (counts.Web > 0) platformResults.push(`${counts.Web} from websites`);
    
    const titles = [
      "Great finds coming in!",
      "Discovering potential partners...",
      "Building your affiliate list...",
      "Uncovering hidden gems...",
    ];
    const titleIndex = Math.min(Math.floor(results.length / 10), titles.length - 1);
    
    return {
      title: titles[titleIndex],
      subtitle: platformResults.length > 0 
        ? platformResults.join(" • ") 
        : "Analyzing results...",
      badge: `${results.length} found`
    };
  }, [results.length, counts]);

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

    // Filter by topics
    if (advancedFilters.topics.length > 0) {
      filtered = filtered.filter(r =>
        (r.discoveryMethod?.type === 'topic' && advancedFilters.topics.includes(r.discoveryMethod.value)) ||
        (r.discoveryMethod?.type === 'keyword' && advancedFilters.topics.includes(r.discoveryMethod.value)) ||
        (r.keyword && advancedFilters.topics.includes(r.keyword))
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
  }, [results, activeFilter, searchQuery, advancedFilters]);

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
      
      setBulkSaveResult({
        savedCount: result.savedCount,
        duplicateCount: result.duplicateCount,
        show: true
      });
      
      // =========================================================================
      // TOAST NOTIFICATIONS (January 5th, 2026)
      // Show success/info toast based on save results
      // =========================================================================
      if (result.savedCount > 0 && result.duplicateCount === 0) {
        toast.success(`Saved ${result.savedCount} affiliate${result.savedCount !== 1 ? 's' : ''} to pipeline!`);
      } else if (result.savedCount > 0 && result.duplicateCount > 0) {
        toast.success(`Saved ${result.savedCount} affiliate${result.savedCount !== 1 ? 's' : ''}! (${result.duplicateCount} already in pipeline)`);
      } else if (result.duplicateCount > 0) {
        toast.info(`All ${result.duplicateCount} affiliates are already in your pipeline`);
      }
      
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
      toast.error('Failed to save affiliates. Please try again.');
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
      
      setDeleteResult({ count: deleteCount, show: true });
      // January 5th, 2026: Added success toast for bulk delete
      toast.success(`Deleted ${deleteCount} affiliate${deleteCount !== 1 ? 's' : ''}`);
      setTimeout(() => {
        setDeleteResult(prev => prev ? { ...prev, show: false } : null);
      }, 3000);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      // January 5th, 2026: Added error toast for bulk delete failure
      toast.error('Failed to delete affiliates. Please try again.');
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
      <header className="h-16 border-b-4 border-black dark:border-white flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a]">
        {/* Page Title - font-black uppercase tracking-tight */}
        <h1 className="font-black text-xl uppercase tracking-tight">Find New</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill - DashboardDemo exact styling:
              bg-[#1a1a1a] text-brandYellow px-3 py-1.5 rounded-full text-xs font-mono border border-brandBlack */}
          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-black">
            <Clock size={12} />
            <span>NEXT SCAN</span>
            <ScanCountdown />
            <span className="text-white font-bold">PRO</span>
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
            <Plus size={14} strokeWidth={3} /> Find Affiliates
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
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* Previous Results Warning - Neo-brutalist style */}
        {showWarning && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#ffbf23]/20 border-2 border-[#ffbf23] rounded-lg mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-center w-8 h-8 bg-[#ffbf23] rounded shrink-0">
              <Search size={16} className="text-black" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-black">New search started</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Previous results have been moved to <span className="font-bold">"All Discovered"</span> page.
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
            ============================================================================= */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search Input - DashboardDemo exact:
                border-2 border-brandBlack dark:border-gray-700 rounded bg-white dark:bg-gray-900 
                focus:border-brandYellow */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search affiliates..."
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
                  {tab.id === 'All' && <span>All</span>}
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
          <div className="flex items-center gap-3">
            <FilterPanel
              affiliates={results}
              activeFilters={advancedFilters}
              onFilterChange={setAdvancedFilters}
              isOpen={isFilterPanelOpen}
              onClose={() => setIsFilterPanelOpen(false)}
              onOpen={() => setIsFilterPanelOpen(true)}
            />
          </div>
        </div>

        {/* 
          OLD_DESIGN - Filters Section (pre-January 6th, 2026)
          Previously used: D4E815 lime accents, rounded-lg pills, max-w-160px search
          To restore: See git history for this file
        */}

        {/* ============================================================================
            BULK ACTIONS BAR (Added Dec 2025)
            ============================================================================ */}
        {visibleSelectedLinks.size > 0 && (() => {
          const alreadySavedCount = Array.from(visibleSelectedLinks).filter(link => isAffiliateSaved(link)).length;
          const newToSaveCount = visibleSelectedLinks.size - alreadySavedCount;
          const allVisibleSelected = visibleSelectedLinks.size === filteredResults.length;
          
          return (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Left: Selection info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#D4E815] flex items-center justify-center">
                  <Check size={14} className="text-[#1A1D21]" />
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {visibleSelectedLinks.size} affiliate{visibleSelectedLinks.size !== 1 ? 's' : ''} selected
                </span>
                {alreadySavedCount > 0 && (
                  <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                    {alreadySavedCount} already in pipeline
                  </span>
                )}
              </div>
              
              <div className="h-4 w-px bg-slate-200"></div>
              <button
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                {allVisibleSelected ? 'Deselect All' : 'Select All Visible'}
              </button>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                <X size={14} />
                Cancel
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete Selected
              </button>

              <button
                onClick={handleBulkSave}
                disabled={isBulkSaving || newToSaveCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#D4E815] hover:bg-[#c5d913] text-[#1A1D21] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                title={newToSaveCount === 0 ? 'All selected affiliates are already in pipeline' : `Save ${newToSaveCount} new affiliate${newToSaveCount !== 1 ? 's' : ''} to pipeline`}
              >
                {isBulkSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {newToSaveCount === 0 ? 'All Already Saved' : `Save ${newToSaveCount} to Pipeline`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE AREA - DashboardDemo.tsx EXACT STYLING
            bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 
            rounded-lg min-h-[500px] flex flex-col
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col">
          {/* Table Header - DashboardDemo exact:
              grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 
              text-[10px] font-black text-gray-400 uppercase tracking-widest */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input 
                type="checkbox" 
                checked={filteredResults.length > 0 && visibleSelectedLinks.size === filteredResults.length}
                onChange={() => visibleSelectedLinks.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
                className="accent-[#ffbf23]" 
              />
            </div>
            <div className="col-span-3">Affiliate</div>
            <div className="col-span-3">Relevant Content</div>
            <div className="col-span-2">Discovery Method</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-2 text-right">Action</div>
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
                  {/* Loading progress indicator at top */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#D4E815]/10 border-b border-[#D4E815]/30">
                    <div className="w-5 h-5 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1A1D21]">
                        {loadingMessage.title}
                      </p>
                      <p className="text-xs text-slate-600">
                        {loadingMessage.subtitle}
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-[#1A1D21] bg-[#D4E815]/20 px-2.5 py-1 rounded-full">
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
                    />
                  </div>
                ))
              )}
            </div>
          ) : hasSearched && !loading && creditError ? (
            // =================================================================
            // CREDIT ERROR BANNER - January 4th, 2026
            // 
            // Shows when user has 0 topic_search credits and search fails.
            // Provides clear feedback instead of confusing "No results" message.
            // =================================================================
            <div className="py-12 text-center">
              <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-amber-800 mb-2">
                  Out of Topic Search Credits
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  {creditError.message}
                </p>
                <p className="text-amber-600 text-xs">
                  Upgrade your plan to get more searches, or wait for your credits to refresh.
                </p>
              </div>
            </div>
          ) : hasSearched && !loading && groupedResults.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No results found for this filter.
            </div>
          ) : (
            /* Empty State - Neo-brutalist style */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Search size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                No affiliates found yet
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Start a search to see results here
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Pagination Controls */}
        {hasSearched && groupedResults.length > 0 && !loading && (
          <div className="mt-4 flex items-center justify-center gap-6 py-4">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">{Math.min(endIndex, groupedResults.length)}</span> of{' '}
              <span className="font-semibold text-slate-900">{groupedResults.length}</span> affiliates
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
                Previous
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
                Next
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {itemsPerPage} per page
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
          {/* Header - NEO-BRUTALIST */}
          <div className="text-center pb-2">
            <div className="w-14 h-14 bg-black border-4 border-black flex items-center justify-center mx-auto mb-3 shadow-[4px_4px_0px_0px_#ffbf23]">
              <Search size={24} className="text-[#ffbf23]" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide">Find Affiliates</h2>
            <p className="text-sm text-gray-500 mt-1">
              Add up to {MAX_KEYWORDS} keywords to discover relevant creators
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column - Keywords - NEO-BRUTALIST */}
            <div className="flex flex-col">
              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 uppercase tracking-wide">
                <Search size={14} className="text-black dark:text-white" />
                Keywords
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
                  placeholder="Type keyword + Enter..."
                  disabled={keywords.length >= MAX_KEYWORDS}
                  className="w-full px-3 py-2.5 pr-16 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={addKeyword}
                  disabled={!keywordInput.trim() || keywords.length >= MAX_KEYWORDS}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black hover:bg-yellow-400 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  Add
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
                    No keywords added yet
                  </div>
                )}
              </div>

              <div className="h-5 mt-1.5">
                {keywords.length > 0 && (
                  <button
                    onClick={() => setKeywords([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors font-bold"
                  >
                    Clear all keywords
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Website & Competitors - NEO-BRUTALIST */}
            <div className="flex flex-col">
              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 uppercase tracking-wide">
                <Globe size={14} className="text-gray-500" />
                Website
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
                <span className="font-medium">{user?.brand || 'Not set during onboarding'}</span>
              </div>

              <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 h-7 mt-3 uppercase tracking-wide">
                <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Competitors
                {user?.competitors && user.competitors.length > 0 && (
                  <span className="ml-auto text-[10px] text-gray-500 font-bold">
                    {user.competitors.length} added
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
                  <p className="text-center text-gray-400 text-xs font-medium">No competitors added</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Button - NEO-BRUTALIST */}
          <button
            onClick={handleFindAffiliates}
            disabled={keywords.length === 0 || loading}
            className="w-full py-3.5 bg-[#ffbf23] text-black font-black uppercase tracking-wide border-4 border-black hover:bg-yellow-400 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-3 border-black border-t-transparent animate-spin"></div>
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Find Affiliates
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-gray-400 font-medium">
            💡 Tip: Use specific keywords like "best CRM software" instead of just "CRM"
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

      {/* BULK SAVE FEEDBACK TOAST */}
      {bulkSaveResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check size={20} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">
                  {bulkSaveResult.savedCount > 0 
                    ? `${bulkSaveResult.savedCount} affiliate${bulkSaveResult.savedCount !== 1 ? 's' : ''} saved!`
                    : 'No new affiliates saved'
                  }
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bulkSaveResult.savedCount > 0 && 'Successfully added to your pipeline.'}
                  {bulkSaveResult.duplicateCount > 0 && (
                    <span className="block text-amber-600 mt-1">
                      {bulkSaveResult.duplicateCount} already in pipeline (skipped)
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setBulkSaveResult(prev => prev ? { ...prev, show: false } : null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FEEDBACK TOAST */}
      {deleteResult?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">
                  {deleteResult.count === 1 
                    ? 'Affiliate deleted'
                    : `${deleteResult.count} affiliates deleted`
                  }
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Successfully removed from discovered list.
                </p>
              </div>
              <button
                onClick={() => setDeleteResult(prev => prev ? { ...prev, show: false } : null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
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

