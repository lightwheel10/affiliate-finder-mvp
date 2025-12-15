'use client';

/**
 * Discovered Affiliates Page
 * Updated: December 2025
 * 
 * Shows ALL discovered affiliates from all searches.
 * 
 * BULK SELECTION FEATURE (Added Dec 2025):
 * - Users can select multiple affiliates using checkboxes
 * - Bulk save selected to pipeline
 * - Bulk delete selected from discovered list
 */

import { useState, useMemo, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AffiliateRow } from '../components/AffiliateRow';
import { ScanCountdown } from '../components/ScanCountdown';
import { AuthGuard } from '../components/AuthGuard';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { CreditsDisplay } from '../components/CreditsDisplay';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  Music,
  Mail,
  Plus,
  Sparkles,
  // Added Dec 2025 for bulk actions UI
  Check,
  Trash2,
  Save,
  Loader2,
  X
} from 'lucide-react';
import { ResultItem } from '../types';

// This page shows ALL discovered affiliates from all searches
export default function DiscoveredPage() {
  return (
    <AuthGuard>
      <DiscoveredContent />
    </AuthGuard>
  );
}

function DiscoveredContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Data hooks
  const { 
    discoveredAffiliates, 
    removeDiscoveredAffiliate,       // Single item delete
    removeDiscoveredAffiliatesBulk,  // Added Dec 2025 for bulk delete
    isLoading: loading 
  } = useDiscoveredAffiliates();
  
  const { 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved,
    saveAffiliatesBulk  // Added Dec 2025 for bulk save
  } = useSavedAffiliates();

  // ============================================================================
  // BULK SELECTION STATE (Added Dec 2025)
  // Tracks which affiliates are selected for bulk operations (save/delete)
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
  // Shows toast notification after single or bulk delete
  // ============================================================================
  const [deleteResult, setDeleteResult] = useState<{
    count: number;
    show: boolean;
  } | null>(null);

  const toggleSave = (item: ResultItem) => {
    if (isAffiliateSaved(item.link)) {
      removeAffiliate(item.link);
    } else {
      saveAffiliate(item);
    }
  };

  /**
   * Handle single item delete with feedback toast (Added Dec 2025)
   */
  const handleSingleDelete = async (link: string) => {
    await removeDiscoveredAffiliate(link);
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
  
  const deselectAllVisible = () => {
    // Remove only visible items from selection (preserves selections from other filters)
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      filteredResults.forEach(r => newSet.delete(r.link));
      return newSet;
    });
  };

  const deselectAll = () => {
    setSelectedLinks(new Set());
  };

  /**
   * Bulk save selected affiliates to pipeline (Updated Dec 2025)
   * - Only saves items visible in current filter
   * - Shows loading spinner on each item being saved
   * - Displays feedback toast with saved/duplicate counts
   */
  const handleBulkSave = async () => {
    if (visibleSelectedLinks.size === 0) return;
    setIsBulkSaving(true);
    setSavingLinks(new Set(visibleSelectedLinks));
    
    try {
      const affiliatesToSave = discoveredAffiliates.filter(r => visibleSelectedLinks.has(r.link));
      const result = await saveAffiliatesBulk(affiliatesToSave);
      
      // Show feedback toast
      setBulkSaveResult({
        savedCount: result.savedCount,
        duplicateCount: result.duplicateCount,
        show: true
      });
      setTimeout(() => {
        setBulkSaveResult(prev => prev ? { ...prev, show: false } : null);
      }, 4000);
      
      // Remove saved items from selection
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
      await removeDiscoveredAffiliatesBulk(Array.from(visibleSelectedLinks));
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

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return discoveredAffiliates.filter(item => {
      // Filter by Source
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;
      
      // Filter by Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.title?.toLowerCase().includes(q) ||
          item.domain?.toLowerCase().includes(q) ||
          (item.keyword && item.keyword.toLowerCase().includes(q))
        );
      }
      
      return true;
    });
  }, [discoveredAffiliates, activeFilter, searchQuery]);

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

  // Calculate counts
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

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-52">
        {/* Header */}
        <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">All Discovered Affiliates</h1>
            </div>

          {/* Countdown Timer */}
          <ScanCountdown />
          
          <div className="flex items-center gap-3 text-xs">
            {/* Credits Display - December 2025 */}
            <CreditsDisplay />
            
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
              Shows already-saved count and dynamic save button text
              Uses light background to match page aesthetic
              
              FIX (Dec 2025): Use visibleSelectedLinks for UI display/counts
              This shows only items selected in the CURRENT filter view
              ============================================================================ */}
          {visibleSelectedLinks.size > 0 && (() => {
            const alreadySavedCount = Array.from(visibleSelectedLinks).filter(link => isAffiliateSaved(link)).length;
            const newToSaveCount = visibleSelectedLinks.size - alreadySavedCount;
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
                  {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete Selected
                </button>
                <button
                  onClick={handleBulkSave}
                  disabled={isBulkSaving || newToSaveCount === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#D4E815] hover:bg-[#c5d913] text-[#1A1D21] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title={newToSaveCount === 0 ? 'All selected affiliates are already in pipeline' : `Save ${newToSaveCount} new affiliate${newToSaveCount !== 1 ? 's' : ''} to pipeline`}
                >
                  {isBulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
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
             {loading ? (
               <div className="py-24 text-center">
                 <div className="relative w-10 h-10 mx-auto">
                    <div className="absolute inset-0 border-[3px] border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-[3px] border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-slate-400 text-xs mt-4">Loading discovered affiliates...</p>
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
                    // Bulk selection props (Added Dec 2025)
                    isSelected={selectedLinks.has(item.link)}
                    onSelect={toggleSelectItem}
                    // Bulk save visual feedback (Added Dec 2025)
                    isSaving={savingLinks.has(item.link)}
                    // Single item delete (Added Dec 2025)
                    onDelete={() => handleSingleDelete(item.link)}
                    // View modal data (Added Dec 2025)
                    affiliateData={item}
                  />
               ))
             ) : (
               <div className="py-32 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">No affiliates discovered yet</h3>
                  <p className="text-slate-400 text-sm">Go to "Find New" to start discovering potential affiliates</p>
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
          BULK SAVE FEEDBACK TOAST (Added Dec 2025)
          ============================================================================ */}
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
    </div>
  );
}

