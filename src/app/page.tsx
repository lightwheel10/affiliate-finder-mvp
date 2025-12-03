'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { SearchInput } from './components/Input';
import { AffiliateRow } from './components/AffiliateRow';
import { AffiliateRowSkeleton } from './components/AffiliateRowSkeleton';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/Modal';
import { LandingPage } from './components/landing/LandingPage';
import { 
  Plus, 
  Filter, 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  ArrowUpDown,
  List,
  MessageCircle,
  Mail,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultItem } from './types';
import { useSavedAffiliates, useDiscoveredAffiliates } from './hooks/useAffiliates';

const MAX_KEYWORDS = 5;

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isSignedIn) {
    return (
      <LandingPage 
        onLoginClick={() => router.push('/sign-in')}
        onSignupClick={() => router.push('/sign-up')}
      />
    );
  }

  // Authenticated users see the dashboard
  return <Dashboard />
}

function Dashboard() {
  // Convex hooks for data management
  const { 
    savedAffiliates, 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved,
    isLoading: savedLoading 
  } = useSavedAffiliates();
  
  const { 
    discoveredAffiliates, 
    saveDiscoveredAffiliate, 
    saveDiscoveredAffiliates,
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
  const [expectedResultsCount, setExpectedResultsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 results per page
  const [showWarning, setShowWarning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // Force animation retrigger
  const [groupByDomain, setGroupByDomain] = useState(false); // Toggle for grouping results

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
      // Only show most recent search results (filter by last keyword used)
      const lastKeyword = discoveredAffiliates[0]?.searchKeyword;
      if (lastKeyword) {
        const lastSearchResults = discoveredAffiliates.filter(
          (d: { searchKeyword: string }) => d.searchKeyword === lastKeyword
        );
        setResults(lastSearchResults as ResultItem[]);
        // Restore keywords (could be comma-separated for multi-keyword searches)
        const restoredKeywords = lastKeyword.split(' | ').filter(Boolean);
        setKeywords(restoredKeywords);
        setHasSearched(true);
      }
    }
  }, [discoveredAffiliates, discoveredLoading, hasSearched]);

  const handleFindAffiliates = async () => {
    if (keywords.length === 0) return;
    
    // If there are existing results, show transition message
    const hadPreviousResults = results.length > 0;
    
    setLoading(true);
    setResults([]); // Clear old results
    setHasSearched(true);
    setIsFindModalOpen(false); // Close modal after starting search
    setCurrentPage(1); // Reset to page 1
    setAnimationKey(prev => prev + 1); // Force new animation cycle
    
    // Show warning banner only if there were previous results
    if (hadPreviousResults) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    }
    
    // Estimate: 4 platforms × 10 results × number of keywords
    setExpectedResultsCount(40 * keywords.length);

    // Combined keyword string for storage
    const combinedKeyword = keywords.join(' | ');
    const streamedResults: ResultItem[] = [];
    const resultsToSave: ResultItem[] = []; // Batch for Convex

    try {
      // Search all keywords in parallel for speed!
      const searchPromises = keywords.map(async (kw) => {
        const res = await fetch('/api/scout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw, sources: ['Web', 'YouTube', 'Reddit', 'Instagram'] }),
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
                  resultsToSave.push(enhancedResult);
                  setResults([...streamedResults]);
                  
                  // Save to Convex in real-time (one at a time during streaming)
                  saveDiscoveredAffiliate(enhancedResult, combinedKeyword);
                  
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
      
      // Batch save final results to Convex (for non-streaming mode)
      if (resultsToSave.length > 0 && !streamedResults.length) {
        saveDiscoveredAffiliates(resultsToSave, combinedKeyword);
      }
      
    } catch (e: unknown) {
      const error = e as Error;
      if (error.name === 'AbortError') {
        console.log('🛑 Search cancelled by user');
      } else {
        console.error('❌ Search error:', e);
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
    if (!hasSearched) return { All: 0, Web: 0, YouTube: 0, Instagram: 0, Reddit: 0 };
    
    // Count all results per source (no grouping - show actual counts)
    return {
      All: results.length,
      Web: results.filter(r => r.source === 'Web').length,
      YouTube: results.filter(r => r.source === 'YouTube').length,
      Instagram: results.filter(r => r.source === 'Instagram').length,
      Reddit: results.filter(r => r.source === 'Reddit').length,
    };
  }, [results, hasSearched]);

  // Filter tabs data with real counts
  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} />, count: counts.Instagram },
    { id: 'Reddit', icon: <MessageCircle size={14} />, count: counts.Reddit },
  ];

  // Filter results based on active filter AND search query
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
    
    return filtered;
  }, [results, activeFilter, searchQuery]);

  // Group filtered results by domain OR show all individually
  const groupedResults = useMemo(() => {
    if (groupByDomain) {
      return groupResultsByDomain(filteredResults);
    }
    // Show all results individually (no grouping)
    return filteredResults.map(item => ({
      main: item,
      subItems: []
    }));
  }, [filteredResults, groupByDomain]);

  // Pagination calculations (based on groups now)
  const totalPages = Math.ceil(groupedResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = groupedResults.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-60">
        {/* Dashboard Header */}
        <header className="h-14 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           {/* Page Title */}
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Find New Affiliates</h1>
            </div>
          
          <div className="flex items-center gap-3 text-xs">
            {/* Stats Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
              <Search size={12} className="text-emerald-600" />
              <span className="font-semibold text-emerald-900">14/15 Topic Searches</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-lg">
              <Mail size={12} className="text-[#1A1D21]" />
              <span className="font-semibold text-[#1A1D21]">150/150 Email Credits</span>
            </div>
            
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
                <div className="w-full max-w-xs">
                   <div className="relative w-full group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1A1D21] transition-colors">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgb(0,0,0,0.05)] transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#D4E815]/20 focus:shadow-[0_4px_12px_rgb(212,232,21,0.1)]"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search results by name, domain, or keyword..."
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
                      {tab.id !== 'All' && <span>{tab.id}</span>}
                      {tab.id === 'All' && <span>All</span>}
                      {/* Only show badge if there is data */}
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

              {/* Right: View Actions */}
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setGroupByDomain(!groupByDomain)}
                   className={cn(
                     "px-3 py-2 border rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all",
                     groupByDomain 
                       ? "bg-[#D4E815] border-[#D4E815] text-[#1A1D21]"
                       : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                   )}
                 >
                    <List size={12} /> {groupByDomain ? 'Grouped' : 'All Results'}
                  </button>
                  <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm flex items-center gap-1.5 transition-all">
                    <ArrowUpDown size={12} /> Sort by: Most Content
                  </button>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[48px_280px_1fr_160px_128px_144px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            <div className="pl-1"></div>
            <div>Affiliate</div>
            <div>Relevant Content</div>
            <div>Discovery Method</div>
            <div>Discovery Date</div>
            <div className="text-right pr-2">Action</div>
          </div>

          {/* Results Area */}
          <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
             {hasSearched && (loading || groupedResults.length > 0) ? (
               <div>
                 {loading ? (
                   // STREAMING MODE: Show results as they arrive + skeletons for pending
                   <>
                    {/* Loading progress indicator at top */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#D4E815]/10 border-b border-[#D4E815]/30">
                      <div className="w-5 h-5 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1A1D21]">
                          Discovering affiliates...
                        </p>
                        <p className="text-xs text-slate-600">
                          {results.length > 0 
                            ? `${groupedResults.length} unique affiliates from ${results.length} results • Analyzing more...`
                            : 'Searching across platforms...'}
                        </p>
                      </div>
                      <div className="text-xs font-mono text-[#1A1D21] bg-[#D4E815]/20 px-2 py-1 rounded flex items-center gap-2">
                        <span>{results.length}/{expectedResultsCount} analyzed</span>
                        {groupedResults.length > 0 && (
                          <>
                            <span className="text-[#1A1D21]/30">•</span>
                            <span className="text-[#1A1D21] font-semibold">{groupedResults.length} affiliates</span>
                          </>
                        )}
                      </div>
                    </div>
                     
                     {/* Streamed results */}
                     {groupedResults.map((group, idx) => (
                       <div
                         key={`stream-${animationKey}-${group.main.link}`}
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
                        />
                      </div>
                    ))}
                    
                    {/* Skeletons for upcoming results (show 3 max) */}
                     {Array.from({ length: Math.min(3, Math.max(0, expectedResultsCount - results.length)) }).map((_, idx) => (
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
              {/* Left: Results info */}
              <div className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
                <span className="font-semibold text-slate-900">{Math.min(endIndex, groupedResults.length)}</span> of{' '}
                <span className="font-semibold text-slate-900">{groupedResults.length}</span> affiliates
              </div>

              {/* Center: Page controls */}
              <div className="flex items-center gap-2">
                {/* Previous Button */}
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

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Show first, last, current, and adjacent pages
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

                {/* Next Button */}
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

              {/* Right: Items per page (optional - can be removed if not needed) */}
              <div className="text-xs text-slate-500">
                {itemsPerPage} per page
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Find Affiliates Modal - Clean Redesign */}
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
              
              {/* Keyword Input */}
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

              {/* Keywords List */}
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

              {/* Clear button - fixed height for alignment */}
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
              {/* Website - Coming Soon */}
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

              {/* Competitors - Coming Soon */}
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

              {/* Spacer to match left column */}
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

          {/* Quick Tips */}
          <p className="text-center text-[11px] text-slate-400">
            💡 Tip: Use specific keywords like "best CRM software" instead of just "CRM"
          </p>
        </div>
      </Modal>
    </div>
  );
}