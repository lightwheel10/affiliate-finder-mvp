'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AffiliateRow } from '../components/AffiliateRow';
import { SearchInput } from '../components/Input';
import { getSavedAffiliates, removeAffiliate, SavedAffiliate } from '../services/storage';
import { cn } from '@/lib/utils';
import { 
  Filter, 
  Search, 
  Globe, 
  Youtube, 
  Instagram,
  ArrowUpDown,
  MessageCircle,
  Download,
  Users
} from 'lucide-react';

export default function PipelinePage() {
  const [savedAffiliates, setSavedAffiliates] = useState<SavedAffiliate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved affiliates
    const loadData = () => {
      const data = getSavedAffiliates();
      // Sort by savedAt desc
      data.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setSavedAffiliates(data);
      setLoading(false);
    };

    loadData();
    
    // Listen for storage events (in case changes happen in another tab)
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleRemove = (link: string) => {
    removeAffiliate(link);
    setSavedAffiliates(prev => prev.filter(item => item.link !== link));
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

  // Calculate counts
  const counts = useMemo(() => {
    return {
      All: savedAffiliates.length,
      Web: savedAffiliates.filter(r => r.source === 'Web').length,
      YouTube: savedAffiliates.filter(r => r.source === 'YouTube').length,
      Instagram: savedAffiliates.filter(r => r.source === 'Instagram').length,
      Reddit: savedAffiliates.filter(r => r.source === 'Reddit').length,
    };
  }, [savedAffiliates]);

  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} />, count: counts.Instagram },
    { id: 'Reddit', icon: <MessageCircle size={14} />, count: counts.Reddit },
  ];

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-60">
        {/* Header */}
        <header className="h-14 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Saved Affiliates</h1>
            </div>
          
          <div className="flex items-center gap-3">
            <button 
              className="bg-white text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Download size={14} /> Export CSV
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
                <div className="w-full max-w-xs">
                   <SearchInput 
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSearch={() => {}} // Instant search
                      isLoading={false}
                      placeholder="Search saved affiliates..."
                      className="text-sm h-10 shadow-sm"
                      buttonLabel="Search"
                    />
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

              {/* Right: View Actions */}
              <div className="flex items-center gap-2">
                 <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm flex items-center gap-1.5 transition-all">
                    <ArrowUpDown size={12} /> Sort by: Date Added
                  </button>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[48px_280px_1fr_160px_120px_100px_160px_100px] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            <div className="pl-1"></div>
            <div>Affiliate</div>
            <div>Relevant Content</div>
            <div>Discovery Method</div>
            <div>Discovery Date</div>
            <div>Status</div>
            <div>Emails</div>
            <div className="text-right pr-2">Action</div>
          </div>

          {/* Results Area */}
          <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
             {!loading && filteredResults.length > 0 ? (
               filteredResults.map((item, idx) => (
                  <AffiliateRow 
                    key={item.link}
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
                    isPipelineView={true}
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
    </div>
  );
}

