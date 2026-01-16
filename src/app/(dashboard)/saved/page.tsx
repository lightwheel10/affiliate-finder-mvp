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
  XCircle,
  Clock  // Added January 6th, 2026 for neo-brutalist header
} from 'lucide-react';
import { FilterState, DEFAULT_FILTER_STATE, parseSubscriberCount } from '../../types';
import { FilterPanel } from '../../components/FilterPanel';
import { useNeonUser } from '../../hooks/useNeonUser';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

export default function SavedPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  // User data for filter options (January 13th, 2026)
  const { user } = useNeonUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  
  // ==========================================================================
  // EMAIL FOUND FILTER - January 16, 2026
  // When enabled, only shows affiliates with emails found
  // ==========================================================================
  const [showOnlyWithEmail, setShowOnlyWithEmail] = useState(false);

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
      // i18n: January 10th, 2026
      toast.success(`${t.dashboard.saved.deletedCount.replace('{count}', String(deleteCount))} ${t.toasts.success.affiliatesDeletedFromPipeline}`);
      setTimeout(() => {
        setDeleteResult(prev => prev ? { ...prev, show: false } : null);
      }, 3000);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      // January 5th, 2026: Added error toast for bulk delete failure
      // i18n: January 10th, 2026
      toast.error(t.toasts.error.deleteFailed);
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
      // i18n: January 10th, 2026
      toast.info(t.toasts.info.allAlreadyHaveEmails);
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
      // i18n: January 10th, 2026
      // =========================================================================
      if (results.creditError) {
        // Credit error - ran out of credits during lookup
        toast.warning(results.creditErrorMessage || t.toasts.warning.insufficientEmailCredits);
      } else if (results.foundCount > 0 && results.notFoundCount === 0 && results.errorCount === 0) {
        // All found successfully
        toast.success(`${results.foundCount} ${t.toasts.success.emailsFound}`);
      } else if (results.foundCount > 0) {
        // Mixed results
        toast.info(`${t.dashboard.saved.emailResults.found} ${results.foundCount}, ${t.toasts.info.mixedEmailResults} ${results.notFoundCount}, ${t.dashboard.saved.emailResults.errors} ${results.errorCount}`);
      } else if (results.notFoundCount > 0) {
        // None found
        toast.warning(`${t.toasts.warning.noEmailsFound} ${results.notFoundCount} ${results.notFoundCount !== 1 ? t.affiliateRow.badges.saved.toLowerCase() + 's' : t.affiliateRow.badges.saved.toLowerCase()}`);
      } else if (results.errorCount > 0) {
        // All errors
        toast.error(`${t.toasts.error.emailLookupFailedCount} ${results.errorCount} ${results.errorCount !== 1 ? t.affiliateRow.badges.saved.toLowerCase() + 's' : t.affiliateRow.badges.saved.toLowerCase()}`);
      }
      
      setTimeout(() => {
        setBulkEmailProgress({ current: 0, total: 0, status: 'idle' });
      }, 5000);
      
    } catch (err) {
      console.error('Bulk email finding failed:', err);
      // January 5th, 2026: Show error toast for unexpected failures
      // i18n: January 10th, 2026
      toast.error(t.toasts.error.emailLookupFailed);
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

      // ==========================================================================
      // EMAIL FOUND FILTER - January 16, 2026
      // When showOnlyWithEmail is true, only show affiliates with emails
      // ==========================================================================
      if (showOnlyWithEmail) {
        if (!item.email && item.emailStatus !== 'found') return false;
      }

      return true;
    });
  }, [savedAffiliates, activeFilter, searchQuery, advancedFilters, showOnlyWithEmail]);

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

  // ==========================================================================
  // EMAIL FOUND COUNT - January 16, 2026
  // Shows how many affiliates have emails found in the table header
  // ==========================================================================
  const emailsFoundCount = useMemo(() => {
    return savedAffiliates.filter(a => a.email || a.emailStatus === 'found').length;
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
      {/* =============================================================================
          TOP BAR - NEW DESIGN (January 6th, 2026)
          Neo-brutalist header - MATCHES DashboardDemo.tsx EXACTLY
          ============================================================================= */}
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 border-b-4 border-black dark:border-white flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a]">
        {/* Page Title - font-black uppercase tracking-tight */}
        <h1 className="font-black text-xl uppercase tracking-tight">{t.dashboard.saved.pageTitle}</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill - DashboardDemo exact styling */}
          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-black">
            <Clock size={12} />
            <span>{t.dashboard.header.nextScan}</span>
            <ScanCountdown />
            <span className="text-white font-bold">{t.dashboard.header.pro}</span>
          </div>

          {/* Stats Pills - DashboardDemo exact styling */}
          <div className="hidden lg:flex items-center gap-3">
            <CreditsDisplay variant="neo" />
          </div>

          {/* Find Button - DashboardDemo exact styling */}
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
          </button>
        </div>
      </header>

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto">

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            ============================================================================= */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
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
            
            {/* Platform Filter Pills - DashboardDemo exact styling with counts */}
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
                  {tab.count > 0 && (
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
          <div className="flex items-center gap-3">
            <FilterPanel
              affiliates={savedAffiliates}
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

        {/* Bulk Actions Bar - Translated (January 9th, 2026) */}
        {visibleSelectedLinks.size > 0 && (() => {
          const allVisibleSelected = visibleSelectedLinks.size === filteredResults.length;
          
          return (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#ffbf23] border-2 border-black flex items-center justify-center">
                  <Check size={14} className="text-black" />
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {visibleSelectedLinks.size} {t.common.selected}
                </span>
              </div>
              <div className="h-4 w-0.5 bg-black dark:bg-gray-600"></div>
              <button
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                className="text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                {allVisibleSelected ? t.common.deselectAll : t.common.selectAll}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={deselectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white transition-all"
              >
                {t.common.cancel}
              </button>
              
              {/* Find Emails Button & Progress - NEO-BRUTALIST */}
              {bulkEmailProgress.status === 'complete' && bulkEmailProgress.results ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600 text-xs font-bold">
                  {bulkEmailProgress.results.foundCount > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={12} />
                      {bulkEmailProgress.results.foundCount}
                    </span>
                  )}
                  {bulkEmailProgress.results.notFoundCount > 0 && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <XCircle size={12} />
                      {bulkEmailProgress.results.notFoundCount}
                    </span>
                  )}
                  {bulkEmailProgress.results.errorCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle size={12} />
                      {bulkEmailProgress.results.errorCount}
                    </span>
                  )}
                </div>
              ) : bulkEmailProgress.status === 'searching' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23] border-2 border-black text-xs font-black text-black uppercase">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{bulkEmailProgress.current}/{bulkEmailProgress.total}</span>
                </div>
              ) : (
                <button
                  onClick={handleBulkFindEmails}
                  disabled={isBulkFindingEmails || selectedNeedingEmailLookup === 0}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition-all border-2",
                    selectedNeedingEmailLookup === 0
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                      : "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={selectedNeedingEmailLookup === 0 
                    ? t.dashboard.saved.bulkActions.emailProgress 
                    : `${t.dashboard.saved.bulkActions.findEmails} (${selectedNeedingEmailLookup})`
                  }
                >
                  <Mail size={14} />
                  {t.dashboard.saved.bulkActions.findEmails}
                  {selectedNeedingEmailLookup > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-black text-white text-[10px]">
                      {selectedNeedingEmailLookup}
                    </span>
                  )}
                </button>
              )}
              
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t.common.delete}
              </button>
            </div>
          </div>
          );
        })()}

        {/* =============================================================================
            TABLE AREA - DashboardDemo.tsx EXACT STYLING (Pipeline View)
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col">
          {/* Table Header - Translated (January 9th, 2026) */}
          {/* Column spans match AffiliateRow: 1+3+2+2+1+1+2 = 12 */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input 
                type="checkbox" 
                checked={filteredResults.length > 0 && visibleSelectedLinks.size === filteredResults.length}
                onChange={() => visibleSelectedLinks.size === filteredResults.length ? deselectAllVisible() : selectAllVisible()}
                className="accent-[#ffbf23] w-4 h-4" 
              />
            </div>
            <div className="col-span-3">{t.dashboard.table.affiliate}</div>
            <div className="col-span-2">{t.dashboard.table.relevantContent}</div>
            <div className="col-span-2">{t.dashboard.table.discoveryMethod}</div>
            <div className="col-span-1">{t.dashboard.table.status}</div>
            {/* Email column with clickable filter - January 16, 2026 */}
            <div className="col-span-1">
              <button
                onClick={() => setShowOnlyWithEmail(!showOnlyWithEmail)}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer",
                  showOnlyWithEmail 
                    ? "bg-emerald-500 text-white" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                title={showOnlyWithEmail ? "Show all affiliates" : `Show only affiliates with email (${emailsFoundCount})`}
              >
                <Mail size={10} className={showOnlyWithEmail ? "text-white" : "text-emerald-500"} />
                <span>{t.dashboard.table.email}</span>
                {/* Only show count when filter is active */}
                {showOnlyWithEmail && emailsFoundCount > 0 && (
                  <span className="px-1 py-0.5 text-[9px] font-black rounded bg-white/20 text-white">
                    {emailsFoundCount}
                  </span>
                )}
              </button>
            </div>
            <div className="col-span-2 text-right">{t.dashboard.table.action}</div>
          </div>

          {/* Results Content */}
          <div className="flex-1">
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
                showStatusInsteadOfDate={true}
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
            /* Empty State - Translated (January 9th, 2026) */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Users size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                {t.dashboard.saved.emptyState.title}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                {t.dashboard.saved.emptyState.subtitle}
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

