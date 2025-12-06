'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ScanCountdown } from '../components/ScanCountdown';
import { AuthGuard } from '../components/AuthGuard';
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
} from 'lucide-react';

export default function OutreachPage() {
  return (
    <AuthGuard>
      <OutreachContent />
    </AuthGuard>
  );
}

function OutreachContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<number>>(new Set());
  const [generatedMessages, setGeneratedMessages] = useState<Map<number, string>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set()); // Track which IDs are generating
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [viewingMessageId, setViewingMessageId] = useState<number | null>(null);

  const { savedAffiliates, isLoading: loading } = useSavedAffiliates();

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

  const handleGenerateForSingle = async (id: number) => {
    setGeneratingIds(prev => new Set(prev).add(id)); // Add this ID to generating set
    
    // Simulate AI generation (replace with actual API call later)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newMessages = new Map(generatedMessages);
    const affiliate = filteredResults.find(a => a.id === id);
    if (affiliate) {
      newMessages.set(id, `Hi ${affiliate.personName || 'there'},\n\nI came across your ${affiliate.source === 'Web' ? 'website' : 'content'} on ${affiliate.domain} and was impressed by your work.\n\nI'd love to discuss a potential partnership opportunity that could be mutually beneficial.\n\nWould you be open to a quick chat?\n\nBest regards`);
    }
    
    setGeneratedMessages(newMessages);
    setGeneratingIds(prev => {
      const next = new Set(prev);
      next.delete(id); // Remove this ID from generating set
      return next;
    });
  };

  const handleGenerateMessages = async () => {
    if (selectedAffiliates.size === 0) return;
    
    // Add all selected IDs to generating set
    setGeneratingIds(prev => new Set([...prev, ...selectedAffiliates]));
    
    // Simulate AI generation (replace with actual API call later)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newMessages = new Map(generatedMessages);
    selectedAffiliates.forEach(id => {
      const affiliate = filteredResults.find(a => a.id === id);
      if (affiliate) {
        // Placeholder message - will be replaced with actual AI generation
        newMessages.set(id, `Hi ${affiliate.personName || 'there'},\n\nI came across your ${affiliate.source === 'Web' ? 'website' : 'content'} on ${affiliate.domain} and was impressed by your work.\n\nI'd love to discuss a potential partnership opportunity that could be mutually beneficial.\n\nWould you be open to a quick chat?\n\nBest regards`);
      }
    });
    
    setGeneratedMessages(newMessages);
    
    // Remove all selected IDs from generating set
    setGeneratingIds(prev => {
      const next = new Set(prev);
      selectedAffiliates.forEach(id => next.delete(id));
      return next;
    });
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
            {/* Stats Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
              <Search size={12} className="text-emerald-600" />
              <span className="font-semibold text-emerald-900">14/15 Topic Searches</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-lg">
              <Mail size={12} className="text-[#1A1D21]" />
              <span className="font-semibold text-[#1A1D21]">150/150 Email Credits</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
              <Sparkles size={12} className="text-purple-600" />
              <span className="font-semibold text-purple-900">100 AI Credits</span>
            </div>
            
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-semibold text-blue-900">
                      <Check size={12} className="text-blue-600" />
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
                <button
                  onClick={handleGenerateMessages}
                  disabled={selectedAffiliates.size === 0 || generatingIds.size > 0}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-xs transition-all",
                    selectedAffiliates.size > 0 && generatingIds.size === 0
                      ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600 shadow-sm hover:shadow-md"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {generatingIds.size > 0 ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
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
                className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
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
            {/* Empty State */}
            {!loading && savedAffiliates.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No saved affiliates yet</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Save some affiliates first, then come back here to generate personalized outreach messages.
                </p>
              </div>
            )}

            {/* Affiliate Rows */}
            {!loading && filteredResults.length > 0 && filteredResults.map((item) => {
              const isSelected = selectedAffiliates.has(item.id!);
              const hasMessage = generatedMessages.has(item.id!);
              const isCopied = copiedId === item.id;
              const isGenerating = generatingIds.has(item.id!); // Check if THIS specific ID is generating

              return (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[40px_220px_1fr_140px_100px_100px_130px] items-start gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors",
                    isSelected && "bg-purple-50/30 hover:bg-purple-50/40"
                  )}
                >
                  {/* Checkbox */}
                  <div className="pt-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectAffiliate(item.id!)}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
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

                  {/* Message Actions */}
                  <div className="text-right">
                    {hasMessage ? (
                      <button
                        onClick={() => setViewingMessageId(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      >
                        <MessageSquare size={12} />
                        View Message
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        disabled={isGenerating}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          isGenerating
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600 shadow-sm"
                        )}
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 size={12} />
                            Generate
                          </>
                        )}
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
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
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
                    <Sparkles size={14} className="text-purple-600" />
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
                      <RefreshCw size={14} className={generatingIds.has(viewingMessageId) ? "animate-spin" : ""} />
                      Regenerate
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
                          : "bg-purple-600 text-white hover:bg-purple-700"
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
      </main>
    </div>
  );
}
