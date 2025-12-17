'use client';

/**
 * =============================================================================
 * OUTREACH PAGE - AI Email Generation
 * =============================================================================
 * 
 * This page allows users to generate AI-powered outreach emails for their
 * saved affiliates. The AI generation is handled via n8n webhook integration.
 * 
 * KEY FEATURES:
 * - Single & bulk email generation
 * - Visual status indicators (generating, success, failed)
 * - Progress tracking for bulk operations
 * - Error handling with inline notifications (not alerts)
 * - Credit consumption per generation
 * 
 * VISUAL STATES (December 17, 2025):
 * 1. Default: Yellow "Generate" button
 * 2. Generating: Grey button with spinner
 * 3. Success: Yellow-tinted "View Message" button
 * 4. Failed: Red-tinted "Failed - Retry" button
 * 
 * @see src/app/api/ai/outreach/route.ts - Backend API
 * @see src/lib/n8n-ai-outreach.ts - n8n webhook integration
 * =============================================================================
 */

import { useState, useMemo, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ScanCountdown } from '../components/ScanCountdown';
import { AuthGuard } from '../components/AuthGuard';
import { CreditsDisplay } from '../components/CreditsDisplay';
import { useSavedAffiliates } from '../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Mail,
  Plus,
  Sparkles,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Youtube,
  Instagram,
  Music,
  MessageSquare,
  ExternalLink,
  User,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

export default function OutreachPage() {
  return (
    <AuthGuard>
      <OutreachContent />
    </AuthGuard>
  );
}

// =============================================================================
// ERROR NOTIFICATION TYPES
// =============================================================================

interface ErrorNotification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

function OutreachContent() {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<number>>(new Set());
  
  // Message generation state
  const [generatedMessages, setGeneratedMessages] = useState<Map<number, string>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());
  
  // =========================================================================
  // FAILED IDS TRACKING (December 17, 2025)
  // Tracks which affiliate IDs had generation failures so we can show
  // "Failed - Retry" button instead of the default "Generate" button
  // =========================================================================
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  
  // =========================================================================
  // BULK GENERATION PROGRESS (December 17, 2025)
  // Tracks progress during bulk generation: { current: 2, total: 5 }
  // Shows "Generating 2/5..." in the header button
  // =========================================================================
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  
  // =========================================================================
  // ERROR NOTIFICATIONS (December 17, 2025)
  // Instead of using ugly alert() popups, we show inline toast notifications
  // that auto-dismiss after 5 seconds
  // =========================================================================
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [viewingMessageId, setViewingMessageId] = useState<number | null>(null);

  const { savedAffiliates, isLoading: loading } = useSavedAffiliates();
  
  // =========================================================================
  // LOAD SAVED AI-GENERATED MESSAGES ON MOUNT (December 17, 2025)
  // 
  // When affiliates are loaded from the database, populate the generatedMessages
  // state with any previously saved AI-generated messages. This ensures that
  // messages persist across page refreshes without re-generation.
  // =========================================================================
  useEffect(() => {
    if (savedAffiliates.length > 0) {
      const savedMessages = new Map<number, string>();
      
      savedAffiliates.forEach((affiliate) => {
        if (affiliate.id && affiliate.aiGeneratedMessage) {
          savedMessages.set(affiliate.id, affiliate.aiGeneratedMessage);
        }
      });
      
      // Only update if we found saved messages
      if (savedMessages.size > 0) {
        setGeneratedMessages(prev => {
          // Merge saved messages with any new ones (new ones take precedence)
          const merged = new Map(savedMessages);
          prev.forEach((value, key) => {
            merged.set(key, value);
          });
          return merged;
        });
        console.log(`[Outreach] Loaded ${savedMessages.size} saved AI messages from database`);
      }
    }
  }, [savedAffiliates]);
  
  // =========================================================================
  // NOTIFICATION HELPERS
  // =========================================================================
  
  /**
   * Add an error notification that auto-dismisses after 5 seconds
   */
  const addNotification = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };
  
  /**
   * Remove a notification by ID
   */
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
          (item.email && item.email.toLowerCase().includes(q)) ||
          (item.personName && item.personName.toLowerCase().includes(q))
        );
      }
      
      return true;
    });
  }, [savedAffiliates, activeFilter, searchQuery]);

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

  const handleSelectAffiliate = (id: number) => {
    const newSelected = new Set(selectedAffiliates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAffiliates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAffiliates.size === filteredResults.length) {
      setSelectedAffiliates(new Set());
    } else {
      setSelectedAffiliates(new Set(filteredResults.map(a => a.id!)));
    }
  };

  // =========================================================================
  // SINGLE AFFILIATE EMAIL GENERATION (Updated December 17, 2025)
  // 
  // Generates an AI email for a single affiliate. On success, stores the
  // message in generatedMessages map. On failure, adds the ID to failedIds
  // set so the UI shows "Failed - Retry" button.
  // =========================================================================
  const handleGenerateForSingle = async (id: number) => {
    // Add to generating set (shows spinner)
    setGeneratingIds(prev => new Set(prev).add(id));
    
    // Clear any previous failure state for this ID
    setFailedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    
    const affiliate = filteredResults.find(a => a.id === id);
    if (!affiliate) {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    try {
      // Call the AI outreach API
      const response = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: id,
          affiliate: affiliate,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // =====================================================================
        // SUCCESS: Store the generated message
        // The UI will automatically show "View Message" button
        // =====================================================================
        const newMessages = new Map(generatedMessages);
        newMessages.set(id, data.message);
        setGeneratedMessages(newMessages);
      } else {
        // =====================================================================
        // FAILURE: Mark as failed and show notification
        // The UI will show "Failed - Retry" button
        // =====================================================================
        console.error('AI generation failed:', data.error);
        setFailedIds(prev => new Set(prev).add(id));
        
        // Show user-friendly error message based on error type
        if (response.status === 402) {
          // Credit error - show upgrade prompt
          addNotification('Insufficient AI credits. Please upgrade your plan.', 'warning');
        } else if (data.error?.includes('webhook not configured')) {
          // Admin configuration error
          addNotification('AI service not configured. Please contact support.', 'error');
        } else {
          // Generic error
          addNotification(data.error || 'Failed to generate message', 'error');
        }
      }
    } catch (error) {
      // =====================================================================
      // NETWORK ERROR: Mark as failed
      // =====================================================================
      console.error('Error generating message:', error);
      setFailedIds(prev => new Set(prev).add(id));
      addNotification('Failed to connect to AI service. Please try again.', 'error');
    } finally {
      // Remove from generating set (hides spinner)
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // =========================================================================
  // BULK EMAIL GENERATION (Updated December 17, 2025)
  // 
  // Generates AI emails for all selected affiliates sequentially.
  // Shows progress indicator "Generating 2/5..." in the header button.
  // Tracks failures individually so user can retry specific ones.
  // =========================================================================
  const handleGenerateMessages = async () => {
    if (selectedAffiliates.size === 0) return;
    
    const idsToProcess = Array.from(selectedAffiliates);
    const total = idsToProcess.length;
    
    // Initialize bulk progress tracking
    setBulkProgress({ current: 0, total });
    
    // Add all selected IDs to generating set
    setGeneratingIds(prev => new Set([...prev, ...selectedAffiliates]));
    
    // Clear previous failure states for these IDs
    setFailedIds(prev => {
      const next = new Set(prev);
      idsToProcess.forEach(id => next.delete(id));
      return next;
    });
    
    const newMessages = new Map(generatedMessages);
    let successCount = 0;
    let failCount = 0;
    
    // Process each affiliate sequentially to respect rate limits
    for (let i = 0; i < idsToProcess.length; i++) {
      const id = idsToProcess[i];
      const affiliate = filteredResults.find(a => a.id === id);
      
      // Update progress indicator
      setBulkProgress({ current: i + 1, total });
      
      if (!affiliate) {
        // Remove from generating set if affiliate not found
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        continue;
      }

      try {
        const response = await fetch('/api/ai/outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateId: id,
            affiliate: affiliate,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // SUCCESS: Store message and update UI progressively
          newMessages.set(id, data.message);
          setGeneratedMessages(new Map(newMessages));
          successCount++;
        } else {
          // FAILURE: Mark as failed
          console.error(`Failed to generate for ${affiliate.domain}:`, data.error);
          setFailedIds(prev => new Set(prev).add(id));
          failCount++;
        }
        
        // Remove this ID from generating set as it completes
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        // Small delay between requests to be respectful to n8n/AI service
        if (i < idsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        // NETWORK ERROR: Mark as failed
        console.error(`Error generating for ${affiliate.domain}:`, error);
        setFailedIds(prev => new Set(prev).add(id));
        failCount++;
        
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    
    // Clear progress indicator
    setBulkProgress(null);
    
    // Show summary notification if there were any failures
    if (failCount > 0) {
      addNotification(
        `Generated ${successCount} of ${total} messages. ${failCount} failed - click "Retry" to try again.`,
        failCount === total ? 'error' : 'warning'
      );
    }
  };

  const handleCopyMessage = (id: number) => {
    const message = generatedMessages.get(id);
    if (message) {
      navigator.clipboard.writeText(message);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'YouTube': return <Youtube size={16} className="text-red-600" />;
      case 'Instagram': return <Instagram size={16} className="text-pink-600" />;
      case 'TikTok': return <Music size={16} className="text-cyan-500" />;
      default: return <Globe size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-52">
        {/* Header */}
        <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Outreach</h1>
          </div>

          {/* Countdown Timer */}
          <ScanCountdown />
          
          <div className="flex items-center gap-3 text-xs">
            {/* Credits Display - December 2025 */}
            <CreditsDisplay />
            
            {/* Action Button */}
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

              {/* Right: Actions */}
              <div className="flex items-center gap-3">
                {selectedAffiliates.size > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-900">
                      <Check size={12} className="text-emerald-600" />
                      {selectedAffiliates.size} selected
                    </div>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      Deselect All
                    </button>
                  </>
                )}
                {selectedAffiliates.size === 0 && filteredResults.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 hover:bg-slate-50 rounded-lg"
                  >
                    Select All
                  </button>
                )}
                {/* ================================================================
                    BULK GENERATE BUTTON (Updated December 17, 2025)
                    
                    Shows different states:
                    - Default: "Generate Messages (X)"
                    - In Progress: "Generating 2/5..." with spinner
                    - Disabled: Grey when nothing selected or already generating
                    ================================================================ */}
                <button
                  onClick={handleGenerateMessages}
                  disabled={selectedAffiliates.size === 0 || generatingIds.size > 0}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-xs transition-all",
                    selectedAffiliates.size > 0 && generatingIds.size === 0
                      ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {bulkProgress ? (
                    // Bulk generation in progress - show progress
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating {bulkProgress.current}/{bulkProgress.total}...
                    </>
                  ) : generatingIds.size > 0 ? (
                    // Single generation in progress
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    // Default state
                    <>
                      <Wand2 size={14} />
                      Generate Messages ({selectedAffiliates.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[40px_220px_1fr_140px_100px_100px_130px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            <div className="pl-1">
              <input
                type="checkbox"
                checked={selectedAffiliates.size === filteredResults.length && filteredResults.length > 0}
                onChange={handleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 focus:ring-offset-0 cursor-pointer"
              />
            </div>
            <div>Affiliate</div>
            <div>Relevant Content</div>
            <div>Discovery Method</div>
            <div>Date</div>
            <div>Email</div>
            <div className="text-right pr-2">Message</div>
          </div>

          {/* Results Area */}
          <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
            
            {/* ================================================================
                LOADING STATE (December 17, 2025)
                Shows skeleton loader while fetching affiliates
                ================================================================ */}
            {loading && (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-[#D4E815] animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-600">Loading your affiliates...</p>
              </div>
            )}
            
            {/* Empty State */}
            {!loading && savedAffiliates.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#D4E815]/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-[#1A1D21]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Start Building Connections</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Save affiliates to generate AI-powered outreach messages.
                </p>
              </div>
            )}
            
            {/* No Results State (when filtering) */}
            {!loading && savedAffiliates.length > 0 && filteredResults.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Search size={28} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Results Found</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Try adjusting your search or filter to find affiliates.
                </p>
              </div>
            )}

            {/* Affiliate Rows */}
            {/* ================================================================
                AFFILIATE ROWS (Updated December 17, 2025)
                
                Each row shows the affiliate with action button states:
                - Default: Yellow "Generate" button
                - Generating: Grey with spinner
                - Success: Yellow-tinted "View Message" button  
                - Failed: Red-tinted "Failed - Retry" button
                ================================================================ */}
            {!loading && filteredResults.length > 0 && filteredResults.map((item) => {
              const isSelected = selectedAffiliates.has(item.id!);
              const hasMessage = generatedMessages.has(item.id!);
              const isCopied = copiedId === item.id;
              const isGenerating = generatingIds.has(item.id!);
              const hasFailed = failedIds.has(item.id!); // Check if THIS specific ID failed

              return (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[40px_220px_1fr_140px_100px_100px_130px] items-start gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors",
                    isSelected && "bg-[#D4E815]/10 hover:bg-[#D4E815]/20"
                  )}
                >
                  {/* Checkbox */}
                  <div className="pt-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectAffiliate(item.id!)}
                      className="w-4 h-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>

                  {/* Affiliate Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getSourceIcon(item.source)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mb-0.5">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Globe size={10} />
                        {item.domain}
                      </p>
                      {item.personName && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User size={10} />
                          {item.personName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.snippet}
                  </div>

                  {/* Discovery Method */}
                  <div className="text-xs">
                    {item.keyword && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
                        {item.keyword}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs text-slate-500">
                    {item.date || '-'}
                  </div>

                  {/* Email Status */}
                  <div className="text-xs">
                    {item.email ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-semibold border border-emerald-100">
                        <Mail size={10} />
                        Found
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-md font-medium">
                        <Mail size={10} />
                        None
                      </span>
                    )}
                  </div>

                  {/* ============================================================
                      MESSAGE ACTION BUTTON (Updated December 17, 2025)
                      
                      Shows different states based on generation status:
                      1. hasMessage → "View Message" (success state)
                      2. isGenerating → Spinner + "Generating..."
                      3. hasFailed → Red "Failed - Retry" button
                      4. default → Yellow "Generate" button
                      ============================================================ */}
                  <div className="text-right">
                    {hasMessage ? (
                      // SUCCESS STATE: Show "View Message" button
                      <button
                        onClick={() => setViewingMessageId(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#D4E815]/20 text-[#1A1D21] border border-[#D4E815]/40 hover:bg-[#D4E815]/30"
                      >
                        <MessageSquare size={12} />
                        View Message
                      </button>
                    ) : isGenerating ? (
                      // GENERATING STATE: Show spinner
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </button>
                    ) : hasFailed ? (
                      // FAILED STATE: Show red "Failed - Retry" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300"
                      >
                        <AlertTriangle size={12} />
                        Retry
                      </button>
                    ) : (
                      // DEFAULT STATE: Show yellow "Generate" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                      >
                        <Wand2 size={12} />
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message Viewing Modal */}
        {viewingMessageId !== null && (() => {
          const affiliate = filteredResults.find(a => a.id === viewingMessageId);
          const message = generatedMessages.get(viewingMessageId);
          const isCopied = copiedId === viewingMessageId;

          return (
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setViewingMessageId(null)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header - Updated December 17, 2025 to use brand colors */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#D4E815]/10 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      {getSourceIcon(affiliate?.source || 'Web')}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{affiliate?.title}</h3>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <Globe size={10} />
                        {affiliate?.domain}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingMessageId(null)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <span className="text-slate-600 text-lg">×</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-[#1A1D21]" />
                    <span className="text-sm font-semibold text-slate-700">AI Generated Message</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-200">
                    {message}
                  </div>

                  {/* Affiliate Details */}
                  {affiliate && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Affiliate Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {affiliate.personName && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Contact Name</p>
                            <p className="text-sm font-semibold text-slate-900">{affiliate.personName}</p>
                          </div>
                        )}
                        {affiliate.email && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Email</p>
                            <p className="text-sm font-semibold text-slate-900">{affiliate.email}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Platform</p>
                          <div className="flex items-center gap-1.5">
                            {getSourceIcon(affiliate.source)}
                            <p className="text-sm font-semibold text-slate-900">{affiliate.source}</p>
                          </div>
                        </div>
                        {affiliate.keyword && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Keyword</p>
                            <p className="text-sm font-semibold text-slate-900">{affiliate.keyword}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <button
                    onClick={() => setViewingMessageId(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    Close
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateForSingle(viewingMessageId)}
                      disabled={generatingIds.has(viewingMessageId)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        generatingIds.has(viewingMessageId)
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      )}
                    >
                      <Loader2 size={14} className={generatingIds.has(viewingMessageId) ? "animate-spin" : ""} />
                      {generatingIds.has(viewingMessageId) ? 'Regenerating...' : 'Regenerate'}
                    </button>
                    <button
                      onClick={() => {
                        handleCopyMessage(viewingMessageId);
                        setTimeout(() => setViewingMessageId(null), 1500);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        isCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                      )}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy Message
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================================================================
            ERROR NOTIFICATIONS TOAST (December 17, 2025)
            
            Shows inline toast notifications instead of ugly alert() popups.
            Notifications auto-dismiss after 5 seconds.
            Positioned at bottom-right of screen.
            ================================================================ */}
        {notifications.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-5 duration-300",
                  notification.type === 'error' && "bg-red-50 border-red-200 text-red-800",
                  notification.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800",
                  notification.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800"
                )}
              >
                {notification.type === 'error' && <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                {notification.type === 'warning' && <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />}
                {notification.type === 'info' && <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />}
                <p className="flex-1 text-sm font-medium">{notification.message}</p>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
