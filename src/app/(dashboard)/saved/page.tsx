'use client';

/**
 * =============================================================================
 * SAVED AFFILIATES PAGE (PIPELINE)
 * =============================================================================
 * 
 * Updated: January 3rd, 2026
 * 
 * Shows all affiliates saved to the user's pipeline.
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
 * 
 * FEATURES:
 * ---------
 * - Bulk selection for delete operations (Dec 2025)
 * - Bulk email finding (Dec 2025)
 * - Advanced filtering by competitors, topics, subscribers (Dec 2025)
 * 
 * =============================================================================
 */

import { useState, useMemo } from 'react';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { AffiliateRow } from '../../components/AffiliateRow';
import { ScanCountdown } from '../../components/ScanCountdown';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import { CreditsDisplay } from '../../components/CreditsDisplay';
import { useSavedAffiliates } from '../../hooks/useAffiliates';
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
  Check,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { FilterPanel } from '../../components/FilterPanel';

export default function SavedPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Hook for saved affiliates
  const { 
    savedAffiliates, 
    removeAffiliate,
    removeAffiliatesBulk,
    findEmail,
    findEmailsBulk,
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

  const handleRemove = async (link: string) => {
    await removeAffiliate(link);
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

  const handleBulkDelete = () => {
    if (visibleSelectedLinks.size === 0) return;
    setIsDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (visibleSelectedLinks.size === 0) return;
    const deleteCount = visibleSelectedLinks.size;
    setIsBulkDeleting(true);
    try {
      await removeAffiliatesBulk(Array.from(visibleSelectedLinks));
      setSelectedLinks(prev => {
        const newSet = new Set(prev);
        visibleSelectedLinks.forEach(link => newSet.delete(link));
        return newSet;
      });
      setIsDeleteModalOpen(false);
      
      setDeleteResult({ count: deleteCount, show: true });
      // January 5th, 2026: Added success toast for bulk delete
      toast.success(`Deleted ${deleteCount} affiliate${deleteCount !== 1 ? 's' : ''} from pipeline`);
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

  const handleBulkFindEmails = async () => {
    if (visibleSelectedLinks.size === 0) return;
    
    const selectedAffiliates = savedAffiliates.filter(a => visibleSelectedLinks.has(a.link));
    const needsLookup = selectedAffiliates.filter(a => 
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching' &&
      !a.email
    );
    
    if (needsLookup.length === 0) {
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
      // January 5th, 2026: Added info toast when all already have emails
      toast.info('All selected affiliates already have emails');
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
      
      setBulkEmailProgress({
        current: needsLookup.length,
        total: needsLookup.length,
        status: 'complete',
        results,
      });
      
      // =========================================================================
      // NOTIFICATION BASED ON RESULTS (January 5th, 2026)
      // Show appropriate toast based on email lookup results
      // =========================================================================
      if (results.creditError) {
        // Credit error - ran out of credits during lookup
        toast.warning(results.creditErrorMessage || 'Ran out of email credits');
      } else if (results.foundCount > 0 && results.notFoundCount === 0 && results.errorCount === 0) {
        // All found successfully
        toast.success(`Found ${results.foundCount} email${results.foundCount !== 1 ? 's' : ''}!`);
      } else if (results.foundCount > 0) {
        // Mixed results
        toast.info(`Found ${results.foundCount}, not found ${results.notFoundCount}, errors ${results.errorCount}`);
      } else if (results.notFoundCount > 0) {
        // None found
        toast.warning(`No emails found for ${results.notFoundCount} affiliate${results.notFoundCount !== 1 ? 's' : ''}`);
      } else if (results.errorCount > 0) {
        // All errors
        toast.error(`Email lookup failed for ${results.errorCount} affiliate${results.errorCount !== 1 ? 's' : ''}`);
      }
      
      setTimeout(() => {
        setBulkEmailProgress({ current: 0, total: 0, status: 'idle' });
      }, 5000);
      
    } catch (err) {
      console.error('Bulk email finding failed:', err);
      // January 5th, 2026: Show error toast for unexpected failures
      toast.error('Failed to find emails. Please try again.');
    } finally {
      setIsBulkFindingEmails(false);
    }
  };

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return savedAffiliates.filter(item => {
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (
          item.title.toLowerCase().includes(q) ||
          item.domain.toLowerCase().includes(q) ||
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

      if (advancedFilters.topics.length > 0) {
        const matchesTopic =
          (item.discoveryMethod?.type === 'topic' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.discoveryMethod?.type === 'keyword' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.keyword && advancedFilters.topics.includes(item.keyword));
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
  }, [savedAffiliates, activeFilter, searchQuery, advancedFilters]);

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

  const selectedNeedingEmailLookup = useMemo(() => {
    return savedAffiliates.filter(a => 
      visibleSelectedLinks.has(a.link) &&
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching' &&
      !a.email
    ).length;
  }, [savedAffiliates, visibleSelectedLinks]);

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

  // ==========================================================================
  // RENDER - January 3rd, 2026
  // 
  // Note: The outer container with Sidebar is now handled by the layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* Header */}
      <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">Saved Affiliates</h1>
        </div>

        <ScanCountdown />
        
        <div className="flex items-center gap-3 text-xs">
          <CreditsDisplay />
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

            {/* Right: Advanced Filter Button */}
            <div className="flex items-center">
              <FilterPanel
                affiliates={savedAffiliates}
                activeFilters={advancedFilters}
                onFilterChange={setAdvancedFilters}
                isOpen={isFilterPanelOpen}
                onClose={() => setIsFilterPanelOpen(false)}
                onOpen={() => setIsFilterPanelOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
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
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              
              {/* Find Emails Button & Progress */}
              {bulkEmailProgress.status === 'complete' && bulkEmailProgress.results ? (
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
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D4E815]/20 border border-[#D4E815]/40 text-xs font-semibold text-[#1A1D21]">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Finding emails... {bulkEmailProgress.current}/{bulkEmailProgress.total}</span>
                </div>
              ) : (
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
                isSelected={selectedLinks.has(item.link)}
                onSelect={toggleSelectItem}
                onDelete={() => handleRemove(item.link)}
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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        itemCount={visibleSelectedLinks.size}
        isDeleting={isBulkDeleting}
        itemType="affiliate"
      />

      {/* Delete Feedback Toast */}
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
    </>
  );
}

