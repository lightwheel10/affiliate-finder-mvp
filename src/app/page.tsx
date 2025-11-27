'use client';

import { useState, useMemo } from 'react';
import { SearchInput } from './components/Input';
import { AffiliateRow } from './components/AffiliateRow';
import { AffiliateRowSkeleton } from './components/AffiliateRowSkeleton';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/Modal';
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
import { saveAffiliate, removeAffiliate, getSavedAffiliates, isAffiliateSaved, saveDiscoveredAffiliates, getDiscoveredAffiliates, saveDiscoveredAffiliate } from './services/storage';
import { useEffect } from 'react';

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedLinks, setSavedLinks] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);
  const [expectedResultsCount, setExpectedResultsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 results per page
  const [showWarning, setShowWarning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // Force animation retrigger

  // Load saved state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load saved affiliates for the save button state
      const saved = getSavedAffiliates();
      setSavedLinks(new Set(saved.map(s => s.link)));
      
      // Load previously discovered affiliates (from last session)
      const discovered = getDiscoveredAffiliates();
      if (discovered.length > 0) {
        // Only show most recent search results (filter by last keyword used)
        const lastKeyword = discovered[0]?.searchKeyword;
        if (lastKeyword) {
          const lastSearchResults = discovered.filter(d => d.searchKeyword === lastKeyword);
          setResults(lastSearchResults);
          setKeyword(lastKeyword);
          setHasSearched(true);
        }
      }
    }
  }, []);

  const handleFindAffiliates = async () => {
    if (!keyword.trim()) return;
    
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
      
      // Auto-dismiss warning after 4 seconds
      setTimeout(() => {
        setShowWarning(false);
      }, 4000);
    }
    
    // Estimate: 4 platforms × 5 results each = ~20 skeletons
    setExpectedResultsCount(20);

    // Track abort controller to cancel previous searches
    const abortController = new AbortController();

    try {
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, sources: ['Web', 'YouTube', 'Reddit', 'Instagram'] }),
        signal: abortController.signal // Allow cancellation
      });

      // Check if response is streaming (Server-Sent Events)
      const contentType = res.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // STREAMING MODE - Results come in one by one
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const streamedResults: ResultItem[] = [];

        while (reader) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('✅ Stream completed successfully');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              
              if (data === '[DONE]') {
                // Stream complete
                console.log('✅ Received [DONE] signal');
                setLoading(false);
                // Save all results to localStorage
                saveDiscoveredAffiliates(streamedResults, keyword);
                return;
              }

              try {
                const result = JSON.parse(data);
                
                // Enhance result with discovery method
                const isCompetitor = keyword.toLowerCase().includes('alternative') || 
                                   keyword.toLowerCase().includes('vs') || 
                                   keyword.toLowerCase().includes('competitor');
                
                let value = keyword;
                if (isCompetitor) {
                  value = keyword.replace(/alternative|vs|competitor/gi, '').trim();
                }

                const enhancedResult = {
                  ...result,
                  rank: result.rank || streamedResults.length + 1,
                  keyword: result.keyword || keyword,
                  discoveryMethod: {
                    type: isCompetitor ? 'competitor' : 'keyword',
                    value: value || keyword
                  },
                  date: result.date || undefined
                };

                streamedResults.push(enhancedResult);
                
                // Update UI immediately with new result 🚀
                setResults([...streamedResults]);
                
                // Save to localStorage as we go
                saveDiscoveredAffiliate(enhancedResult, keyword);
                
              } catch (parseError) {
                console.error('Failed to parse streamed result:', parseError);
              }
            }
          }
        }
        
        // If we get here without [DONE], stream ended early but we have results
        if (streamedResults.length > 0) {
          console.log(`⚠️ Stream ended early, but got ${streamedResults.length} results`);
          saveDiscoveredAffiliates(streamedResults, keyword);
        }
        
      } else {
        // FALLBACK: Non-streaming mode (old behavior)
        const data = await res.json();
        if (data.results) {
          const enhancedResults = data.results.map((r: ResultItem, i: number) => {
              const isCompetitor = keyword.toLowerCase().includes('alternative') || 
                                 keyword.toLowerCase().includes('vs') || 
                                 keyword.toLowerCase().includes('competitor');
              
              let value = keyword;
              if (isCompetitor) {
                 value = keyword.replace(/alternative|vs|competitor/gi, '').trim();
              }

              return {
                ...r,
                rank: r.rank || i + 1,
                keyword: r.keyword || keyword,
                discoveryMethod: {
                    type: isCompetitor ? 'competitor' : 'keyword',
                    value: value || keyword
                },
                date: r.date || undefined
              };
          });
          setResults(enhancedResults);
          saveDiscoveredAffiliates(enhancedResults, keyword);
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('🛑 Search cancelled by user');
      } else {
        console.error('❌ Search error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (item: ResultItem) => {
    const newSaved = new Set(savedLinks);
    if (newSaved.has(item.link)) {
      removeAffiliate(item.link);
      newSaved.delete(item.link);
    } else {
      saveAffiliate(item);
      newSaved.add(item.link);
    }
    setSavedLinks(newSaved);
  };

  // Calculate real counts from results
  const counts = useMemo(() => {
    if (!hasSearched) return { All: 0, Web: 0, YouTube: 0, Instagram: 0, Reddit: 0 };
    
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

  // Group results by domain
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: ResultItem[] } = {};
    filteredResults.forEach(item => {
      if (!groups[item.domain]) {
        groups[item.domain] = [];
      }
      groups[item.domain].push(item);
    });
    return Object.values(groups).map(items => ({
      main: items[0],
      subItems: items.slice(1)
    }));
  }, [filteredResults]);

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
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      
      <main 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out will-change-[margin] relative",
          isSidebarCollapsed ? "ml-[52px]" : "ml-60"
        )}
      >
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
              <Mail size={12} className="text-blue-600" />
              <span className="font-semibold text-blue-900">150/150 Email Credits</span>
            </div>
            
            {/* Action Buttons */}
            <button 
              onClick={() => setIsFindModalOpen(true)}
              className="bg-slate-900 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-600 hover:shadow-md hover:shadow-blue-600/20 transition-all font-semibold flex items-center gap-1.5"
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
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full shrink-0">
                  <Search size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">New search started</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Previous results have been moved to <span className="font-semibold">"All Discovered"</span> page. Showing new results below...
                  </p>
                </div>
                <button
                  onClick={() => setShowWarning(false)}
                  className="text-blue-600 hover:text-blue-800 transition-colors p-1"
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
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgb(0,0,0,0.05)] transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:shadow-[0_4px_12px_rgb(37,99,235,0.05)]"
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
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
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
                          activeFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
                 <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm flex items-center gap-1.5 transition-all">
                    <Filter size={12} /> Filters
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
                 {/* Unified rendering: show results (with animation) or skeletons */}
                 {loading ? (
                   // During loading: Show results as they stream in, with skeletons for pending
                   Array.from({ length: itemsPerPage }).map((_, idx) => {
                     // Note: We can't easily show streaming groups perfectly without complex logic, 
                     // so we'll just show skeletons while loading or basic results if needed.
                     // For now, just show skeletons if loading is true for simplicity/cleanliness
                     return <AffiliateRowSkeleton key={`skeleton-${animationKey}-${idx}`} />;
                   })
                 ) : (
                   // After loading: Show paginated results with animation
                   paginatedGroups.map((group, idx) => (
                     <div
                       key={`anim-${animationKey}-result-${group.main.link}-${idx}`}
                       className="row-appear"
                       style={{ 
                         animationDelay: `${idx * 80}ms`
                       }}
                     >
                       <AffiliateRow 
                         title={group.main.title}
                         domain={group.main.domain}
                         link={group.main.link}
                         source={group.main.source}
                         rank={group.main.rank}
                         keyword={group.main.keyword}
                         isSaved={savedLinks.has(group.main.link)}
                         onSave={() => toggleSave(group.main)}
                         thumbnail={group.main.thumbnail}
                         views={group.main.views}
                         date={group.main.date}
                         snippet={group.main.snippet}
                         highlightedWords={group.main.highlightedWords}
                         discoveryMethod={group.main.discoveryMethod}
                         email={group.main.email}
                         subItems={group.subItems}
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

      {/* Find Affiliates Modal */}
      <Modal 
        isOpen={isFindModalOpen} 
        onClose={() => setIsFindModalOpen(false)}
        title="Fine-tune your search"
        width="max-w-3xl"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500 text-center -mt-2">
            Add the keywords and competitors that matter most - your list will refresh with matching creators in minutes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Website & Keywords */}
            <div className="space-y-6">
              {/* Your Website */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">
                    🌐
                  </div>
                  Your website
                </label>
                <input
                  type="text"
                  value="https://spectrumlabs.com"
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Search size={16} className="text-slate-600" />
                  Keywords
                  <span className="ml-auto text-xs text-blue-600 font-medium">
                    🎯 1/10 used
                  </span>
                </label>
                
                <div className="space-y-2">
                  {keyword && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                      <span className="text-sm text-orange-900 flex-1">{keyword}</span>
                      <button 
                        onClick={() => setKeyword('')}
                        className="text-orange-600 hover:text-orange-800 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && keyword.trim() && handleFindAffiliates()}
                    placeholder="e.g., reduce moderation costs with AI"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                  
                  <button 
                    onClick={() => {}}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Keyword
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Competitors */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Competitors
                <span className="ml-auto text-xs text-blue-600 font-medium">
                  🎯 5/5 used
                </span>
              </label>

              <div className="space-y-2 min-h-[200px] max-h-[300px] overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200">
                {/* Empty state for now */}
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Competitor tracking coming soon</p>
                  <p className="text-xs mt-1">Feature not available in MVP</p>
                </div>
              </div>

              <button 
                disabled
                className="text-sm text-slate-400 font-medium flex items-center gap-1 cursor-not-allowed"
              >
                <Plus size={14} /> Add Competitor
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setIsFindModalOpen(false)}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleFindAffiliates}
              disabled={!keyword.trim() || loading}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  ⚡ Update Settings
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
