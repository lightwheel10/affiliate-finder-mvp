'use client';

/**
 * Saved Affiliates Page (Pipeline)
 * Updated: December 2025
 * 
 * Shows all affiliates saved to the user's pipeline.
 * 
 * BULK SELECTION FEATURE (Added Dec 2025):
 * - Users can select multiple affiliates using checkboxes
 * - Bulk delete selected from pipeline
 */

import { useState, useMemo, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AffiliateRow } from '../components/AffiliateRow';
import { ScanCountdown } from '../components/ScanCountdown';
import { AuthGuard } from '../components/AuthGuard';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useSavedAffiliates } from '../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { 
  Globe, 
  Youtube, 
  Instagram,
  Music,
  Users,
  Search,
  Mail,
  Plus,
  Sparkles,
  // Added Dec 2025 for bulk actions UI
  Check,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';

export default function SavedPage() {
  return (
    <AuthGuard>
      <SavedContent />
    </AuthGuard>
  );
}

function SavedContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Hook for saved affiliates
  const { 
    savedAffiliates, 
    removeAffiliate,
    removeAffiliatesBulk,  // Added Dec 2025 for bulk delete
    findEmail,
    findEmailsBulk,        // Added Dec 2025 for bulk email finding
    isLoading: loading 
  } = useSavedAffiliates();

  // ============================================================================
  // BULK SELECTION STATE (Added Dec 2025)  
  // ============================================================================
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // ============================================================================
  // BULK EMAIL FINDING STATE (Added Dec 2025)
  // ============================================================================
  const [isBulkFindingEmails, setIsBulkFindingEmails] = useState(false);
  const [bulkEmailProgress, setBulkEmailProgress] = useState<{
    current: number;
    total: number;
    status: 'idle' | 'searching' | 'complete';
    results?: {
      foundCount: number;
      notFoundCount: number;
      errorCount: number;
      skippedCount: number;
    };
  }>({ current: 0, total: 0, status: 'idle' });

  // ============================================================================
  // DELETE FEEDBACK STATE (Added Dec 2025)
  // Shows toast notification after single or bulk delete
  // ============================================================================
  const [deleteResult, setDeleteResult] = useState<{
    count: number;
    show: boolean;
  } | null>(null);

  /**
   * Handle single item delete with feedback toast (Added Dec 2025)
   */
  const handleRemove = async (link: string) => {
    await removeAffiliate(link);
    // Show delete feedback toast
    setDeleteResult({ count: 1, show: true });
    // Auto-hide after 3 seconds
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
    // Add all visible items to selection (preserves existing selections from other filters)
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
    // Remove only visible items from selection (preserves selections from other filters)
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach(r => newSet.delete(r.link));
      return newSet;
    });
  };

  /**
   * Open delete confirmation modal (Added Dec 2025)
   */
  const handleBulkDelete = () => {
    if (visibleSelectedLinks.size === 0) return;
    setIsDeleteModalOpen(true);
  };

  /**
   * Confirm and execute bulk delete (Added Dec 2025)
   * Only deletes items visible in current filter
   */
  const confirmBulkDelete = async () => {
    if (visibleSelectedLinks.size === 0) return;
    const deleteCount = visibleSelectedLinks.size;
    setIsBulkDeleting(true);
    try {
      await removeAffiliatesBulk(Array.from(visibleSelectedLinks));
      // Remove deleted items from selection
      setSelectedLinks(prev => {
        const newSet = new Set(prev);
        visibleSelectedLinks.forEach(link => newSet.delete(link));
        return newSet;
      });
      setIsDeleteModalOpen(false);
      
      // Show delete feedback toast
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

  /**
   * Handle bulk email finding (Added Dec 2025)
   * Finds emails for all selected affiliates that don't already have emails
   */
  const handleBulkFindEmails = async () => {
    if (visibleSelectedLinks.size === 0) return;
    
    // Get the selected affiliates that are visible
    const selectedAffiliates = savedAffiliates.filter(a => visibleSelectedLinks.has(a.link));
    
    // Count how many actually need email lookup
    const needsLookup = selectedAffiliates.filter(a => 
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching' &&
      !a.email
    );
    
    if (needsLookup.length === 0) {
      // All selected already have emails or are searching
      setBulkEmailProgress({
        current: 0,
        total: 0,
        status: 'complete',
        results: {
          foundCount: 0,
          notFoundCount: 0,
          errorCount: 0,
          skippedCount: selectedAffiliates.length,
        },
      });
      // Auto-clear after 3 seconds
      setTimeout(() => setBulkEmailProgress({ current: 0, total: 0, status: 'idle' }), 3000);
      return;
    }
    
    setIsBulkFindingEmails(true);
    setBulkEmailProgress({
      current: 0,
      total: needsLookup.length,
      status: 'searching',
    });
    
    try {
      const results = await findEmailsBulk(selectedAffiliates, (progress) => {
        setBulkEmailProgress({
          current: progress.current,
          total: progress.total,
          status: 'searching',
        });
      });
      
      // Show results
      setBulkEmailProgress({
        current: needsLookup.length,
        total: needsLookup.length,
        status: 'complete',
        results,
      });
      
      // Auto-clear results after 5 seconds
      setTimeout(() => {
        setBulkEmailProgress({ current: 0, total: 0, status: 'idle' });
      }, 5000);
      
    } catch (err) {
      console.error('Bulk email finding failed:', err);
    } finally {
      setIsBulkFindingEmails(false);
    }
  };

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return savedAffiliates.filter(item => {
      // Filter by Source
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;
      
      // Filter by Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.domain.toLowerCase().includes(q) ||
          (item.keyword && item.keyword.toLowerCase().includes(q))
        );
      }
      
      return true;
    });
  }, [savedAffiliates, activeFilter, searchQuery]);

  // ============================================================================
  // VISIBLE SELECTION - Computed from selectedLinks and filteredResults
  // 
  // FIX (Dec 2025): Instead of modifying selectedLinks when filter changes,
  // we keep ALL selected links in state and compute which ones are currently
  // visible. This prevents the cascading selection loss bug where:
  // - Select all on "All" filter
  // - Switch to "Web" → effect removed non-Web items
  // - Switch to "YouTube" → selection was already empty/Web-only, so nothing left
  // 
  // Now selectedLinks contains ALL selected items across all filters.
  // visibleSelectedLinks is what we show in the UI for the current filter.
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

  // Calculate how many selected affiliates need email lookup (Added Dec 2025)
  const selectedNeedingEmailLookup = useMemo(() => {
    return savedAffiliates.filter(a => 
      visibleSelectedLinks.has(a.link) &&
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching' &&
      !a.email
    ).length;
  }, [savedAffiliates, visibleSelectedLinks]);

  // Calculate counts
  const counts = useMemo(() => {
    return {
      All: savedAffiliates.length,
      Web: savedAffiliates.filter(r => r.source === 'Web').length,
      YouTube: savedAffiliates.filter(r => r.source === 'YouTube').length,
      Instagram: savedAffiliates.filter(r => r.source === 'Instagram').length,
      TikTok: savedAffiliates.filter(r => r.source === 'TikTok').length,
    };
  }, [savedAffiliates]);

  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} className="text-blue-500" />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} className="text-red-600" />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} className="text-pink-600" />, count: counts.Instagram },
    { id: 'TikTok', icon: <Music size={14} className="text-cyan-500" />, count: counts.TikTok },
  ];

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-52">
        {/* Header */}
        <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Saved Affiliates</h1>
            </div>

          {/* Countdown Timer */}
          <ScanCountdown />
          
          <div className="flex items-center gap-3 text-xs">
            {/* Stats Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-lg">
              <Search size={12} className="text-[#1A1D21]" />
              <span className="font-semibold text-[#1A1D21]">14/15 Topic Searches</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Mail size={12} className="text-slate-600" />
              <span className="font-semibold text-slate-800">150/150 Email Credits</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Sparkles size={12} className="text-slate-600" />
              <span className="font-semibold text-slate-800">100 AI Credits</span>
            </div>
            
            {/* Action Buttons */}
            <button 
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Left: Search & Filters */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-full max-w-[160px]">
                   <div className="relative w-full group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1A1D21] transition-colors">
                        <Search size={14} />
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
                      {/* Only show text for "All" filter */}
                      {tab.id === 'All' && <span>All</span>}
                      {tab.count > 0 && (
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
            </div>
          </div>

          {/* ============================================================================
              BULK ACTIONS BAR (Added Dec 2025)
              Uses light background to match page aesthetic
              
              FIX (Dec 2025): Use visibleSelectedLinks for UI display/counts
              This shows only items selected in the CURRENT filter view
              
              ADDED (Dec 2025): Find Emails button for bulk email discovery
              ============================================================================ */}
          {visibleSelectedLinks.size > 0 && (() => {
            const allVisibleSelected = visibleSelectedLinks.size === filteredResults.length;
            
            return (
            <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#D4E815] flex items-center justify-center">
                    <Check size={14} className="text-[#1A1D21]" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {visibleSelectedLinks.size} affiliate{visibleSelectedLinks.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-200"></div>
                <button
                  onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  {allVisibleSelected ? 'Deselect All' : 'Select All Visible'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* 1. Cancel button - first position */}
                <button
                  onClick={deselectAllVisible}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                
                {/* 2. Find Emails Button & Progress - second position
                    Shows different states: idle, searching, complete with results
                    Uses brand colors: bg-[#D4E815] text-[#1A1D21] to match design system */}
                {bulkEmailProgress.status === 'complete' && bulkEmailProgress.results ? (
                  /* Results Summary - Shows after bulk operation completes */
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    {bulkEmailProgress.results.foundCount > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 size={12} />
                        {bulkEmailProgress.results.foundCount} found
                      </span>
                    )}
                    {bulkEmailProgress.results.notFoundCount > 0 && (
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <XCircle size={12} />
                        {bulkEmailProgress.results.notFoundCount} not found
                      </span>
                    )}
                    {bulkEmailProgress.results.errorCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <AlertCircle size={12} />
                        {bulkEmailProgress.results.errorCount} errors
                      </span>
                    )}
                    {bulkEmailProgress.results.skippedCount > 0 && (
                      <span className="flex items-center gap-1 text-slate-400 font-medium">
                        ({bulkEmailProgress.results.skippedCount} skipped)
                      </span>
                    )}
                  </div>
                ) : bulkEmailProgress.status === 'searching' ? (
                  /* Progress Indicator - Shows during bulk operation */
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D4E815]/20 border border-[#D4E815]/40 text-xs font-semibold text-[#1A1D21]">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Finding emails... {bulkEmailProgress.current}/{bulkEmailProgress.total}</span>
                  </div>
                ) : (
                  /* Find Emails Button - Uses brand colors to match design system */
                  <button
                    onClick={handleBulkFindEmails}
                    disabled={isBulkFindingEmails || selectedNeedingEmailLookup === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      selectedNeedingEmailLookup === 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] hover:shadow-md hover:shadow-[#D4E815]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    title={selectedNeedingEmailLookup === 0 
                      ? "All selected affiliates already have emails" 
                      : `Find emails for ${selectedNeedingEmailLookup} affiliate${selectedNeedingEmailLookup !== 1 ? 's' : ''}`
                    }
                  >
                    <Mail size={14} />
                    Find Emails
                    {selectedNeedingEmailLookup > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded bg-[#1A1D21]/20 text-[10px]">
                        {selectedNeedingEmailLookup}
                      </span>
                    )}
                  </button>
                )}
                
                {/* 3. Delete button - last position (destructive action) */}
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete Selected
                </button>
              </div>
            </div>
            );
          })()}

          {/* Table Header */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[40px_220px_1fr_140px_100px_90px_130px_100px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
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
            <div>Status</div>
            <div>Emails</div>
            <div className="text-right pr-2">Action</div>
          </div>

          {/* Results Area */}
          <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
             {!loading && filteredResults.length > 0 ? (
               filteredResults.map((item) => (
                  <AffiliateRow 
                    key={item.link}
                    id={item.id}
                    title={item.title}
                    domain={item.domain}
                    link={item.link}
                    source={item.source}
                    rank={item.rank}
                    keyword={item.keyword}
                    isSaved={true}
                    onSave={() => handleRemove(item.link)}
                    thumbnail={item.thumbnail}
                    views={item.views}
                    date={item.date}
                    snippet={item.snippet}
                    highlightedWords={item.highlightedWords}
                    discoveryMethod={item.discoveryMethod}
                    email={item.email}
                    emailStatus={item.emailStatus}
                    emailResults={item.emailResults}
                    onFindEmail={() => item.id && findEmail(item)}
                    isPipelineView={true}
                    channel={item.channel}
                    duration={item.duration}
                    personName={item.personName}
                    // Bulk selection props (Added Dec 2025)
                    isSelected={selectedLinks.has(item.link)}
                    onSelect={toggleSelectItem}
                    // Single item delete (Added Dec 2025)
                    onDelete={() => handleRemove(item.link)}
                    // View modal data (Added Dec 2025)
                    affiliateData={item}
                  />
               ))
             ) : (
               <div className="py-32 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Users className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">No saved affiliates</h3>
                  <p className="text-slate-400 text-sm">Affiliates you save will appear here</p>
               </div>
             )}
          </div>

        </div>
      </main>

      {/* ============================================================================
          DELETE CONFIRMATION MODAL (Added Dec 2025)
          ============================================================================ */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        itemCount={visibleSelectedLinks.size}
        isDeleting={isBulkDeleting}
        itemType="affiliate"
      />

      {/* ============================================================================
          DELETE FEEDBACK TOAST (Added Dec 2025)
          Shows confirmation after single or bulk delete
          ============================================================================ */}
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
                    ? 'Affiliate removed'
                    : `${deleteResult.count} affiliates removed`
                  }
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Successfully removed from your pipeline.
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
    </div>
  );
}

