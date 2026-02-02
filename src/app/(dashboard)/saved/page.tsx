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
// =============================================================================
// January 17th, 2026: Added Link for "Find Affiliates" button navigation
// When clicked, routes to /find?openModal=true to auto-open the search modal
// =============================================================================
import Link from 'next/link';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { AffiliateRow } from '../../components/AffiliateRow';
import { ScanCountdown } from '../../components/ScanCountdown';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import { Modal } from '../../components/Modal';
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
  Clock,  // Added January 6th, 2026 for neo-brutalist header
  Download,  // Added January 29th, 2026 for export functionality
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
  // EMAIL RESULTS TOAST STATE - January 16, 2026
  // Neo-brutalist toast for email lookup results
  // ============================================================================
  const [emailToast, setEmailToast] = useState<{
    type: 'success' | 'info' | 'warning' | 'error';
    title: string;
    subtitle?: string;
    show: boolean;
  } | null>(null);

  // ============================================================================
  // ADVANCED FILTER STATE (Added Dec 2025)
  // ============================================================================
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // ============================================================================
  // EXPORT MODAL STATE (Added January 29th, 2026)
  // ============================================================================
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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

  const handleBulkFindEmails = async () => {
    if (visibleSelectedLinks.size === 0) return;
    
    const selectedAffiliates = savedAffiliates.filter(a => visibleSelectedLinks.has(a.link));
    // Updated January 24, 2026: Only check emailStatus, not email field existence
    // Bio emails are no longer stored in email field - they're extracted on-demand
    const needsLookup = selectedAffiliates.filter(a => 
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching'
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
      // =======================================================================
      // INFO TOAST - January 16, 2026
      // Neo-brutalist styled toast
      // =======================================================================
      setEmailToast({
        type: 'info',
        title: t.toasts.info.allAlreadyHaveEmails,
        show: true
      });
      setTimeout(() => setEmailToast(null), 4000);
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
      // NOTIFICATION BASED ON RESULTS - January 16, 2026
      // Neo-brutalist styled toasts
      // =========================================================================
      // January 17, 2026: Updated with i18n translations
      if (results.creditError) {
        setEmailToast({
          type: 'warning',
          title: t.dashboard.saved.toasts.insufficientCredits,
          subtitle: results.creditErrorMessage || t.toasts.warning.insufficientEmailCredits,
          show: true
        });
      } else if (results.foundCount > 0 && results.notFoundCount === 0 && results.errorCount === 0) {
        setEmailToast({
          type: 'success',
          title: `${results.foundCount} ${t.dashboard.saved.toasts.emailsFound}`,
          subtitle: t.dashboard.saved.toasts.readyForOutreach,
          show: true
        });
      } else if (results.foundCount > 0) {
        setEmailToast({
          type: 'info',
          title: `${results.foundCount} ${t.dashboard.saved.toasts.found}, ${results.notFoundCount} ${t.dashboard.saved.toasts.notFound}`,
          subtitle: results.errorCount > 0 ? `${results.errorCount} ${t.dashboard.saved.toasts.errors}` : undefined,
          show: true
        });
      } else if (results.notFoundCount > 0) {
        setEmailToast({
          type: 'warning',
          title: t.toasts.warning.noEmailsFound,
          subtitle: `${results.notFoundCount} affiliate${results.notFoundCount !== 1 ? 's' : ''} checked`,
          show: true
        });
      } else if (results.errorCount > 0) {
        // January 17, 2026: Updated with i18n translations
        setEmailToast({
          type: 'error',
          title: t.dashboard.saved.toasts.emailLookupFailed,
          subtitle: `${results.errorCount} ${t.dashboard.saved.toasts.errors}`,
          show: true
        });
      }
      setTimeout(() => setEmailToast(null), 5000);
      
      setTimeout(() => {
        setBulkEmailProgress({ current: 0, total: 0, status: 'idle' });
      }, 5000);
      
    } catch (err) {
      console.error('Bulk email finding failed:', err);
      // =======================================================================
      // ERROR TOAST - January 16, 2026
      // Neo-brutalist styled toast
      // January 17, 2026: Updated with i18n translations
      // =======================================================================
      setEmailToast({
        type: 'error',
        title: t.dashboard.saved.toasts.emailLookupFailed,
        subtitle: t.toasts.error.emailLookupFailed,
        show: true
      });
      setTimeout(() => setEmailToast(null), 4000);
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

      // ========================================================================
      // TOPICS FILTER - BUG FIX January 25, 2026
      // 
      // Previously, this filter matched on item.keyword for ALL affiliates,
      // including those discovered via competitor search. This caused affiliates
      // discovered via "apollo.io" with keyword "bedrop" to incorrectly appear
      // when filtering by topic "bedrop".
      // 
      // FIX: Only match on item.keyword if the affiliate was NOT discovered
      // via competitor or brand search. Topic filter should only show affiliates
      // actually discovered through topic/keyword searches.
      // ========================================================================
      if (advancedFilters.topics.length > 0) {
        const matchesTopic =
          (item.discoveryMethod?.type === 'topic' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.discoveryMethod?.type === 'keyword' && advancedFilters.topics.includes(item.discoveryMethod.value)) ||
          (item.keyword && advancedFilters.topics.includes(item.keyword) && 
           item.discoveryMethod?.type !== 'competitor' && item.discoveryMethod?.type !== 'brand');
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
      // EMAIL FOUND FILTER - Updated January 24, 2026
      // When showOnlyWithEmail is true, only show affiliates with paid emails
      // 
      // CRITICAL FIX: Now only checks emailStatus === 'found', not email existence.
      // This ensures bio emails (stored but not paid for) don't show as "found".
      // ==========================================================================
      if (showOnlyWithEmail) {
        if (item.emailStatus !== 'found') return false;
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

  // Updated January 24, 2026: Only check emailStatus, not email field existence
  // Bio emails are no longer stored in email field - they're extracted on-demand
  const selectedNeedingEmailLookup = useMemo(() => {
    return savedAffiliates.filter(a => 
      visibleSelectedLinks.has(a.link) &&
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching'
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
  // EMAIL FOUND COUNT - Updated January 24, 2026
  // Shows how many affiliates have emails found in the current filtered view
  // 
  // CRITICAL FIX: Now only checks emailStatus === 'found', not email existence.
  // This ensures bio emails (stored but not paid for) don't show as "found".
  // Only affiliates where user clicked "Find Email" and paid credits count.
  // ==========================================================================
  const emailsFoundCount = useMemo(() => {
    return filteredResults.filter(a => a.emailStatus === 'found').length;
  }, [filteredResults]);

  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} className="text-blue-500" />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} className="text-red-600" />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} className="text-pink-600" />, count: counts.Instagram },
    { id: 'TikTok', icon: <Music size={14} className="text-cyan-500" />, count: counts.TikTok },
  ];

  // ==========================================================================
  // CSV EXPORT FUNCTIONALITY - January 29th, 2026
  // 
  // Exports affiliate data to CSV format. Handles both "Export All" (current
  // filtered view) and "Export Selected" (only selected affiliates).
  // 
  // CSV Columns:
  // - Name: Title or person name
  // - Email: Only included if email was found (emailStatus === 'found')
  // - Platform: Source (Web, YouTube, Instagram, TikTok)
  // - Domain: Website domain
  // - Link: Full URL
  // - Followers: Platform-specific follower/subscriber count
  // - Discovery Method: How the affiliate was found (competitor, topic, etc.)
  // - Saved Date: When the affiliate was saved to pipeline
  // 
  // NOTE: This is a client-side export. No API call is made.
  // ==========================================================================
  
  /**
   * Escapes a value for CSV format
   * - Wraps in quotes if contains comma, quote, or newline
   * - Escapes quotes by doubling them
   */
  const escapeCSVValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  /**
   * Gets follower/subscriber count based on platform
   */
  const getFollowerCount = (item: typeof filteredResults[0]): string => {
    if (item.source === 'YouTube' && item.channel?.subscribers) {
      return item.channel.subscribers;
    }
    if (item.source === 'Instagram' && item.instagramFollowers) {
      return item.instagramFollowers.toLocaleString();
    }
    if (item.source === 'TikTok' && item.tiktokFollowers) {
      return item.tiktokFollowers.toLocaleString();
    }
    if (item.source === 'Web' && item.similarWeb?.monthlyVisitsFormatted) {
      return `${item.similarWeb.monthlyVisitsFormatted} visits`;
    }
    return '';
  };

  /**
   * Converts affiliate data to CSV string
   */
  const generateCSV = (affiliates: typeof filteredResults): string => {
    // CSV Header
    const headers = [
      'Name',
      'Email',
      'Platform',
      'Domain',
      'Link',
      'Followers',
      'Discovery Method',
      'Saved Date'
    ];
    
    // CSV Rows
    const rows = affiliates.map(item => [
      escapeCSVValue(item.personName || item.title),
      // Only include email if it was found through paid lookup
      escapeCSVValue(item.emailStatus === 'found' ? item.email : ''),
      escapeCSVValue(item.source),
      escapeCSVValue(item.domain),
      escapeCSVValue(item.link),
      escapeCSVValue(getFollowerCount(item)),
      escapeCSVValue(item.discoveryMethod ? `${item.discoveryMethod.type}: ${item.discoveryMethod.value}` : ''),
      escapeCSVValue(item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '')
    ]);
    
    // Combine header and rows
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  /**
   * Triggers CSV download in browser
   */
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Handles "Export All" - exports all affiliates in current filtered view
   */
  const handleExportAll = () => {
    if (filteredResults.length === 0) {
      toast.error('No affiliates to export');
      setIsExportModalOpen(false);
      return;
    }
    
    const csv = generateCSV(filteredResults);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `saved-affiliates-${date}.csv`);
    
    toast.success(`Exported ${filteredResults.length} affiliates`);
    setIsExportModalOpen(false);
  };

  /**
   * Handles "Export Selected" - exports only selected affiliates
   */
  const handleExportSelected = () => {
    if (visibleSelectedLinks.size === 0) {
      toast.error('No affiliates selected');
      setIsExportModalOpen(false);
      return;
    }
    
    // Filter to only selected affiliates
    const selectedAffiliates = filteredResults.filter(item => 
      visibleSelectedLinks.has(item.link)
    );
    
    const csv = generateCSV(selectedAffiliates);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `saved-affiliates-selected-${date}.csv`);
    
    toast.success(`Exported ${selectedAffiliates.length} affiliates`);
    setIsExportModalOpen(false);
  };

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

          {/* =================================================================
              Find Button - January 17th, 2026: Now functional!
              
              PREVIOUS: Button was non-functional (just styled, no onClick)
              NEW: Wrapped with Link to /find?openModal=true
              
              When clicked:
              1. Navigates to /find page
              2. Query param openModal=true triggers auto-open of search modal
              3. User can immediately start searching without clicking again
              ================================================================= */}
          <Link href="/find?openModal=true">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
            </button>
          </Link>
        </div>
      </header>

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          
          OVERFLOW FIX - January 23, 2026
          Added overflow-x-hidden to prevent horizontal scrolling when results table
          renders with long content. This ensures the filter bar stays visible.
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            
            LAYOUT FIX - January 23, 2026
            FilterPanel now uses a dropdown approach so filter pills don't take 
            up horizontal space.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
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

          {/* Right: Export + Advanced Filter */}
          {/* January 13th, 2026: Pass onboarding data for filter options */}
          {/* January 23, 2026: Filter pills now render in dropdown, not inline */}
          {/* January 29th, 2026: Added export button (subscription-gated) */}
          <div className="flex items-center gap-3">
            {/* Export Button - January 29th, 2026 */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center justify-center gap-1.5 h-10 px-3 bg-white dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-400 border-2 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all text-xs font-black uppercase"
              title="Export to CSV"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>Export</span>
            </button>
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
                {/* Show breakdown: how many need email lookup vs already have emails */}
                {visibleSelectedLinks.size !== selectedNeedingEmailLookup && selectedNeedingEmailLookup > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({visibleSelectedLinks.size - selectedNeedingEmailLookup} {t.dashboard.saved.bulkActions.alreadyHaveEmails || 'already have emails'})
                  </span>
                )}
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
          {/* Updated January 25, 2026: Removed Status column, gave Email col-span-2 for more space */}
          {/* February 2, 2026: Rebalanced - reduced Action to col-span-1, gave space back to Relevant Content */}
          {/* Column spans match AffiliateRow: 1+3+3+2+2+1 = 12 */}
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
            {/* February 2, 2026: Back to col-span-3, reduced Action column instead */}
            <div className="col-span-3">{t.dashboard.table.relevantContent}</div>
            {/* February 2, 2026: col-span-2 for better spacing from Email */}
            <div className="col-span-2">{t.dashboard.table.discoveryMethod}</div>
            {/* Email column with clickable filter - January 16, 2026 */}
            {/* Updated January 25, 2026: Changed from col-span-1 to col-span-2 (Status column removed) */}
            <div className="col-span-2">
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
            {/* February 2, 2026: Reduced from col-span-2 to col-span-1 (buttons are small) */}
            <div className="col-span-1 text-right">{t.dashboard.table.action}</div>
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
                // Match reasons in View Modal (Saved page) - January 22, 2026
                currentUser={user}
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

      {/* =============================================================================
          EXPORT MODAL - January 29th, 2026
          Asks user whether to export all affiliates or just selected ones
          ============================================================================= */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Affiliates"
        width="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose what to export to CSV:
          </p>
          
          {/* Export All Option */}
          <button
            onClick={handleExportAll}
            className="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group"
          >
            <div className="w-10 h-10 bg-[#ffbf23] border-2 border-black flex items-center justify-center shrink-0">
              <Users size={20} className="text-black" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Export All</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {filteredResults.length} affiliates in current view
              </p>
            </div>
          </button>

          {/* Export Selected Option */}
          <button
            onClick={handleExportSelected}
            disabled={visibleSelectedLinks.size === 0}
            className={cn(
              "w-full flex items-center gap-3 p-4 border-2 transition-all group",
              visibleSelectedLinks.size > 0
                ? "bg-white dark:bg-gray-900 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 cursor-not-allowed opacity-60"
            )}
          >
            <div className={cn(
              "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
              visibleSelectedLinks.size > 0 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )}>
              <Check size={20} className={visibleSelectedLinks.size > 0 ? "text-black" : "text-gray-400"} />
            </div>
            <div className="flex-1 text-left">
              <h4 className={cn(
                "text-sm font-black uppercase",
                visibleSelectedLinks.size > 0 ? "text-gray-900 dark:text-white" : "text-gray-400"
              )}>
                Export Selected
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {visibleSelectedLinks.size > 0 
                  ? `${visibleSelectedLinks.size} affiliates selected`
                  : "No affiliates selected"
                }
              </p>
            </div>
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="w-full py-2 text-xs font-black uppercase text-gray-500 hover:text-black dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>

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
                    ? t.dashboard.saved.toasts.affiliateRemoved
                    : `${deleteResult.count} ${t.dashboard.saved.toasts.affiliatesRemoved}`
                  }
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {t.dashboard.saved.toasts.removedFromPipeline}
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

      {/* =============================================================================
          EMAIL RESULTS TOAST - NEO-BRUTALIST DESIGN
          Updated: January 16, 2026
          ============================================================================= */}
      {emailToast?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_#000] p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                emailToast.type === 'success' && "bg-emerald-500",
                emailToast.type === 'error' && "bg-red-500",
                emailToast.type === 'warning' && "bg-amber-500",
                emailToast.type === 'info' && "bg-blue-500"
              )}>
                <Mail size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {emailToast.title}
                </h4>
                {emailToast.subtitle && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {emailToast.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEmailToast(null)}
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

