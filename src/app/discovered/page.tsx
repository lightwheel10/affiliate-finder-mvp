'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AffiliateRow } from '../components/AffiliateRow';
import { SearchInput } from '../components/Input';
import { ScanCountdown } from '../components/ScanCountdown';
import { AuthGuard } from '../components/AuthGuard';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  ArrowUpDown,
  Music,
  Download,
  Mail,
  Plus,
  Sparkles,
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

  // Convex hooks
  const { 
    discoveredAffiliates, 
    isLoading: loading 
  } = useDiscoveredAffiliates();
  
  const { 
    saveAffiliate, 
    removeAffiliate, 
    isAffiliateSaved 
  } = useSavedAffiliates();

  const toggleSave = (item: ResultItem) => {
    if (isAffiliateSaved(item.link)) {
      removeAffiliate(item.link);
    } else {
      saveAffiliate(item);
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

          {/* Table Header */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[40px_220px_1fr_140px_100px_120px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            <div className="pl-1"></div>
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
    </div>
  );
}

