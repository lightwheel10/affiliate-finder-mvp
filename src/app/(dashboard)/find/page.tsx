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

import { useState, useMemo, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultItem, FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../../hooks/useAffiliates';
import { FilterPanel } from '../../components/FilterPanel';

const MAX_KEYWORDS = 5;

export default function FindNewPage() {
  // Get user ID for API tracking
  const { userId } = useNeonUser();
  
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

  // Load previously discovered affiliates from Convex (on mount)
  useEffect(() => {
    if (!discoveredLoading && discoveredAffiliates.length > 0 && !hasSearched) {
      const lastKeyword = discoveredAffiliates[0]?.searchKeyword;
      if (lastKeyword) {
        const lastSearchResults = discoveredAffiliates.filter(
          (d) => d.searchKeyword === lastKeyword
        );
        setResults(lastSearchResults);
        const restoredKeywords = lastKeyword.split(' | ').filter(Boolean);
        setKeywords(restoredKeywords);
        setHasSearched(true);
      }
    }
  }, [discoveredAffiliates, discoveredLoading, hasSearched]);

  const handleFindAffiliates = async () => {
    if (keywords.length === 0) return;
    
    const hadPreviousResults = results.length > 0;
    
    setLoading(true);
    setResults([]);
    setHasSearched(true);
    setIsFindModalOpen(false);
    setCurrentPage(1);
    setAnimationKey(prev => prev + 1);
    
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
        // Search cancelled by user
      } else {
        console.error('Search error:', e);
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
      setTimeout(() => {
        setDeleteResult(prev => prev ? { ...prev, show: false } : null);
      }, 3000);
    } catch (err) {
      console.error('Bulk delete failed:', err);
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
  // RENDER - January 3rd, 2026
  // 
  // NOTE: The outer div with flex and Sidebar is NOT here.
  // It's in the parent layout.tsx file (src/app/(dashboard)/layout.tsx).
  // This component only renders the main content area.
  // ==========================================================================
  return (
    <>
      {/* Dashboard Header */}
      <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        {/* Page Title */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">Find New Affiliates</h1>
        </div>

        {/* Countdown Timer */}
        <ScanCountdown />
        
        <div className="flex items-center gap-3 text-xs">
          {/* Credits Display - December 2025 */}
          <CreditsDisplay />
          
          {/* Action Buttons */}
          <button 
            onClick={() => setIsFindModalOpen(true)}
            className="bg-[#D4E815] text-[#1A1D21] px-3.5 py-1.5 rounded-lg hover:bg-[#c5d913] hover:shadow-md hover:shadow-[#D4E815]/20 transition-all font-semibold flex items-center gap-1.5"
          >
            <Plus size={14} /> Find Affiliates
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
        
        {/* Header Section */}
        <div className="mb-6 space-y-6">

          {/* Previous Results Warning - Above Search Bar */}
          {showWarning && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-center w-8 h-8 bg-[#D4E815]/20 rounded-full shrink-0">
                <Search size={16} className="text-[#1A1D21]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1A1D21]">New search started</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Previous results have been moved to <span className="font-semibold">"All Discovered"</span> page. Showing new results below...
                </p>
              </div>
              <button
                onClick={() => setShowWarning(false)}
                className="text-[#1A1D21] hover:text-slate-600 transition-colors p-1"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Left: Search & Filters */}
            <div className="flex items-center gap-4 flex-1">
              <div className="w-full max-w-[160px]">
                <div className="relative w-full group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1A1D21] transition-colors">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <input
                    className="w-full pl-9 pr-3 py-1.5 bg-white border ring-1 ring-slate-200 rounded-lg text-xs font-semibold text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#D4E815]/20 focus:border-[#D4E815]"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block"></div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                {filterTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                      activeFilter === tab.id
                        ? "bg-[#D4E815] text-[#1A1D21] border-[#D4E815] shadow-sm shadow-[#D4E815]/20"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    {tab.icon}
                    {tab.id === 'All' && <span>All</span>}
                    {hasSearched && tab.count > 0 && (
                      <span className={cn(
                        "ml-0.5 px-1.5 py-0.5 rounded text-[9px]",
                        activeFilter === tab.id ? "bg-[#1A1D21]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Advanced Filter Button */}
            <div className="flex items-center">
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
        </div>

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

        {/* Table Header */}
        <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[40px_220px_1fr_140px_100px_120px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
          <div className="pl-1 flex items-center">
            <input
              type="checkbox"
              checked={filteredResults.length > 0 && visibleSelectedLinks.size === filteredResults.length}
              onChange={() => visibleSelectedLinks.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 cursor-pointer"
              title={visibleSelectedLinks.size === filteredResults.length ? 'Deselect all' : 'Select all'}
            />
          </div>
          <div>Affiliate</div>
          <div>Relevant Content</div>
          <div>Discovery Method</div>
          <div>Date</div>
          <div className="text-right pr-2">Action</div>
        </div>

        {/* Results Area */}
        <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
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
          ) : hasSearched && !loading && groupedResults.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              No results found for this filter.
            </div>
          ) : (
            <div className="py-32 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">No affiliates found yet</h3>
              <p className="text-slate-400 text-sm">Start a search to see results here</p>
            </div>
          )}
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

      {/* Find Affiliates Modal */}
      <Modal 
        isOpen={isFindModalOpen} 
        onClose={() => setIsFindModalOpen(false)}
        title=""
        width="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center pb-2">
            <div className="w-12 h-12 bg-[#1A1D21] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#1A1D21]/25">
              <Search size={24} className="text-[#D4E815]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Find Affiliates</h2>
            <p className="text-sm text-slate-500 mt-1">
              Add up to {MAX_KEYWORDS} keywords to discover relevant creators
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column - Keywords */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 h-7">
                <Search size={14} className="text-[#1A1D21]" />
                Keywords
                <span className="ml-auto text-xs font-normal text-slate-400">
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
                  className="w-full px-3 py-2.5 pr-16 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-2 focus:ring-[#D4E815]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={addKeyword}
                  disabled={!keywordInput.trim() || keywords.length >= MAX_KEYWORDS}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#D4E815] text-[#1A1D21] text-xs font-semibold rounded hover:bg-[#c5d913] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
                >
                  Add
                </button>
              </div>

              <div className="flex-1 min-h-[140px] max-h-[140px] overflow-y-auto no-scrollbar space-y-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                {keywords.length > 0 ? (
                  keywords.map((kw, idx) => (
                    <div
                      key={kw}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm group hover:border-red-200 transition-all"
                    >
                      <span className="w-4 h-4 flex items-center justify-center bg-[#D4E815]/20 text-[#1A1D21] text-[10px] font-bold rounded shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-slate-700 truncate flex-1">{kw}</span>
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                    No keywords added yet
                  </div>
                )}
              </div>

              <div className="h-5 mt-1.5">
                {keywords.length > 0 && (
                  <button
                    onClick={() => setKeywords([])}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Clear all keywords
                  </button>
                )}
              </div>
            </div>

            {/* Right Column - Coming Soon Features */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 h-7">
                <Globe size={14} className="text-slate-400" />
                Your Website
                <span className="ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                  COMING SOON
                </span>
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 cursor-not-allowed mt-2">
                https://yourwebsite.com
              </div>

              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 h-7 mt-4">
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Competitors
                <span className="ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                  COMING SOON
                </span>
              </label>
              <div className="flex-1 min-h-[88px] flex items-center justify-center p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg mt-2">
                <div className="text-center text-slate-400">
                  <p className="text-xs font-medium">Find affiliates promoting competitors</p>
                  <p className="text-[10px] mt-0.5">Add competitor URLs to discover their affiliates</p>
                </div>
              </div>

              <div className="h-5 mt-1.5"></div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleFindAffiliates}
            disabled={keywords.length === 0 || loading}
            className="w-full py-3 bg-[#D4E815] text-[#1A1D21] font-semibold rounded-xl hover:bg-[#c5d913] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-lg shadow-[#D4E815]/25 hover:shadow-xl hover:shadow-[#D4E815]/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-[#1A1D21] border-t-transparent rounded-full animate-spin"></div>
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Find Affiliates
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400">
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

