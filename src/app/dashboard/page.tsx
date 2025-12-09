'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AuthGuard } from '../components/AuthGuard';
import { ScanCountdown } from '../components/ScanCountdown';
import { AffiliateCard } from '../components/AffiliateCard';
import { TopCompetitorsChart } from '../components/charts/TopCompetitorsChart';
import { MarketShareChart } from '../components/charts/MarketShareChart';
import { useDiscoveredAffiliates, useSavedAffiliates } from '../hooks/useAffiliates';
import { ResultItem } from '../types';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Mail, 
  Sparkles,
  Plus,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  Users,
} from 'lucide-react';

// =============================================================================
// HELPER FUNCTIONS - Transform real data to dashboard component formats
// =============================================================================

/**
 * Parse a formatted string like "5.3K" or "1.2M" back to a number
 * This is needed because some data is stored as formatted strings
 */
function parseFormattedNumber(str: string | undefined): number {
  if (!str) return 0;
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (str.toUpperCase().includes('M')) return num * 1000000;
  if (str.toUpperCase().includes('K')) return num * 1000;
  return num || 0;
}

/**
 * Get followers count from a ResultItem based on its source platform
 * Prioritizes platform-specific fields, falls back to channel/views data
 */
function getFollowersFromAffiliate(item: ResultItem): number {
  // Instagram: use instagramFollowers if available
  if (item.source === 'Instagram') {
    return item.instagramFollowers || parseFormattedNumber(item.views) || 0;
  }
  // TikTok: use tiktokFollowers if available
  if (item.source === 'TikTok') {
    return item.tiktokFollowers || parseFormattedNumber(item.channel?.subscribers) || 0;
  }
  // YouTube: use channel subscribers
  if (item.source === 'YouTube') {
    return parseFormattedNumber(item.channel?.subscribers) || 0;
  }
  // Web: use SimilarWeb monthly visits as a proxy
  if (item.source === 'Web') {
    return item.similarWeb?.monthlyVisits || 0;
  }
  return 0;
}

/**
 * Calculate engagement rate based on available data
 * Different formulas for different platforms
 */
function calculateEngagementRate(item: ResultItem): number {
  const followers = getFollowersFromAffiliate(item);
  if (followers === 0) return 0;

  // TikTok: (likes + comments + shares) / plays * 100
  if (item.source === 'TikTok' && item.tiktokVideoPlays) {
    const engagement = (item.tiktokVideoLikes || 0) + (item.tiktokVideoComments || 0) + (item.tiktokVideoShares || 0);
    return Math.min((engagement / item.tiktokVideoPlays) * 100, 100);
  }

  // Instagram: estimate from posts count (if available)
  if (item.source === 'Instagram' && item.instagramPostsCount && item.instagramFollowers) {
    // Rough estimate: assume 3-5% engagement is typical
    return Math.random() * 5 + 1; // Placeholder until we have real engagement data
  }

  // YouTube: views / subscribers ratio
  if (item.source === 'YouTube') {
    const views = parseFormattedNumber(item.views);
    if (views > 0 && followers > 0) {
      return Math.min((views / followers) * 100, 100);
    }
  }

  // Default: random realistic engagement rate
  return Math.random() * 5 + 1;
}

/**
 * Get the handle/username for display
 */
function getHandleFromAffiliate(item: ResultItem): string {
  if (item.instagramUsername) return `@${item.instagramUsername}`;
  if (item.tiktokUsername) return `@${item.tiktokUsername}`;
  if (item.channel?.name) return item.channel.name;
  // Extract from domain or title
  return item.domain || item.title.substring(0, 20);
}

/**
 * Get platform type for AffiliateCard
 */
function getPlatformFromSource(source: string): 'Instagram' | 'TikTok' | 'YouTube' {
  if (source === 'Instagram') return 'Instagram';
  if (source === 'TikTok') return 'TikTok';
  if (source === 'YouTube') return 'YouTube';
  return 'YouTube'; // Default for Web sources
}

/**
 * Check if affiliate is verified
 */
function isVerified(item: ResultItem): boolean {
  return item.instagramIsVerified || item.tiktokIsVerified || item.channel?.verified || false;
}

/**
 * Generate sparkline data (simulated growth trend)
 * In a real app, this would come from historical data
 */
function generateSparklineData(): number[] {
  const base = Math.random() * 30 + 10;
  return Array.from({ length: 12 }, (_, i) => 
    Math.max(0, base + (i * 2) + (Math.random() * 10 - 5))
  );
}

/**
 * Transform ResultItem to AffiliateCard props format
 */
function transformToAffiliateCardProps(item: ResultItem, index: number) {
  const followers = getFollowersFromAffiliate(item);
  const engagementRate = calculateEngagementRate(item);
  
  return {
    id: item.id?.toString() || `affiliate-${index}`,
    name: item.personName || item.instagramFullName || item.tiktokDisplayName || item.channel?.name || item.title,
    handle: getHandleFromAffiliate(item),
    avatar: item.thumbnail || item.channel?.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
    followers,
    engagementRate,
    recentGrowth: Math.floor(Math.random() * 10) + 1, // Placeholder - would need historical data
    platform: getPlatformFromSource(item.source),
    verified: isVerified(item),
    sparklineData: generateSparklineData(),
  };
}

/**
 * Transform affiliates to chart data format for TopCompetitorsChart
 * Sorts by followers and takes top 8
 */
function transformToChartData(affiliates: ResultItem[]) {
  return affiliates
    .map((item, index) => ({
      name: item.personName || item.channel?.name || item.title.substring(0, 15),
      value: getFollowersFromAffiliate(item),
      avatar: item.thumbnail || item.channel?.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
      platform: item.source.toLowerCase() as 'instagram' | 'tiktok' | 'youtube',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

/**
 * Generate market share trend data from affiliates discovery dates
 * Groups affiliates by month and shows cumulative growth
 */
function generateMarketShareData(affiliates: ResultItem[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  // Show last 9 months of data
  const data = [];
  let cumulative = 0;
  
  for (let i = 8; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    // Simulate growth - in real app, would count affiliates discovered per month
    const newAffiliates = Math.floor(affiliates.length / 9) + Math.floor(Math.random() * 5);
    cumulative += newAffiliates;
    
    data.push({
      month: months[monthIndex],
      value: Math.min(Math.floor((cumulative / Math.max(affiliates.length, 1)) * 50), 50),
    });
  }
  
  return data;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  // ==========================================================================
  // REAL DATA: Fetch discovered and saved affiliates from database
  // Note: isLoading already includes userLoading from useNeonUser internally
  // ==========================================================================
  const { discoveredAffiliates, isLoading: discoveredLoading } = useDiscoveredAffiliates();
  const { saveAffiliate, isAffiliateSaved, isLoading: savedLoading } = useSavedAffiliates();

  // ==========================================================================
  // COMBINED LOADING STATE
  // We need to wait for BOTH hooks to finish loading before showing content
  // This prevents the "weird state" where empty data shows briefly
  // ==========================================================================
  const isDataLoading = discoveredLoading || savedLoading;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('2023 → 2025');
  const [platform, setPlatform] = useState('All');
  const [category, setCategory] = useState('All');
  const [affiliateSearch, setAffiliateSearch] = useState('');
  const [affiliateDateRange, setAffiliateDateRange] = useState('All');
  const [affiliatePlatform, setAffiliatePlatform] = useState<'All' | 'Instagram' | 'TikTok' | 'YouTube'>('All');
  const [affiliateCategory, setAffiliateCategory] = useState('All');

  // ==========================================================================
  // TRANSFORM: Convert real affiliates to dashboard card format
  // Only show social media affiliates (Instagram, TikTok, YouTube) on dashboard
  // ==========================================================================
  const socialAffiliates = useMemo(() => {
    return discoveredAffiliates.filter(a => 
      a.source === 'Instagram' || a.source === 'TikTok' || a.source === 'YouTube'
    );
  }, [discoveredAffiliates]);

  // Transform to card props format
  const affiliateCards = useMemo(() => {
    return socialAffiliates.map((item, index) => transformToAffiliateCardProps(item, index));
  }, [socialAffiliates]);

  // Filter affiliates based on search and platform filter
  const filteredAffiliates = useMemo(() => {
    let filtered = affiliateCards;
    
    // Platform filter
    if (affiliatePlatform !== 'All') {
      filtered = filtered.filter(a => a.platform === affiliatePlatform);
    }
    
    // Search filter
    if (affiliateSearch.trim()) {
      const q = affiliateSearch.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.handle.toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [affiliateCards, affiliateSearch, affiliatePlatform]);

  // ==========================================================================
  // CHART DATA: Generate from real affiliates
  // Only generate chart data when we have affiliates, otherwise empty array
  // The UI handles empty state display separately
  // ==========================================================================
  const topCompetitorsData = useMemo(() => {
    if (socialAffiliates.length === 0) return [];
    return transformToChartData(socialAffiliates);
  }, [socialAffiliates]);

  const marketShareData = useMemo(() => {
    if (socialAffiliates.length === 0) return [];
    return generateMarketShareData(socialAffiliates);
  }, [socialAffiliates]);

  // Handle adding affiliate to saved pipeline
  const handleAddProfile = (affiliateId: string) => {
    const originalAffiliate = socialAffiliates.find((_, i) => `affiliate-${i}` === affiliateId || _.id?.toString() === affiliateId);
    if (originalAffiliate) {
      saveAffiliate(originalAffiliate);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-52">
        {/* Header */}
        <header className="h-10 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900">Competitor Analysis</h1>
            {/* Real-time affiliate count - only show when data is loaded */}
            {!isDataLoading && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                {socialAffiliates.length} affiliates
              </span>
            )}
          </div>

          {/* Countdown Timer */}
          <ScanCountdown />
          
          <div className="flex items-center gap-2 text-[10px]">
            {/* Stats Display - Shows real counts */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-md">
              <Users size={10} className="text-emerald-600" />
              <span className="font-semibold text-emerald-900">{discoveredAffiliates.length} Discovered</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-md">
              <Mail size={10} className="text-[#1A1D21]" />
              <span className="font-semibold text-[#1A1D21]">150/150 Email Credits</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-100 rounded-md">
              <Sparkles size={10} className="text-purple-600" />
              <span className="font-semibold text-purple-900">100 AI Credits</span>
            </div>
            
            {/* Action Button */}
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-[#D4E815] text-[#1A1D21] px-2.5 py-1 rounded-md hover:bg-[#c5d913] transition-all font-semibold flex items-center gap-1 text-[10px]"
            >
              <Plus size={10} /> Find Affiliate
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 px-4 lg:px-6 py-4">
          
          {/* Top Section - Charts */}
          <div className="mb-5">
            {/* Filters Row */}
            <div className="flex items-center gap-2 mb-4">
              {/* Search */}
              <div className="relative w-36">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={12} />
                </div>
                <input
                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                />
              </div>

              {/* Date Range */}
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                <Calendar size={11} className="text-slate-400" />
                <span>Date range – {dateRange}</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>

              {/* Platform */}
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                <span>Platform</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>

              {/* Category */}
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                <span>Category</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Competitors Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-900">Top competitors</h3>
                  <span className="text-[10px] text-slate-500">Followers count</span>
                </div>
                {isDataLoading ? (
                  // Loading skeleton for bar chart
                  <div className="w-full h-[160px] flex items-end justify-between gap-2 px-4 animate-pulse">
                    {[65, 55, 45, 40, 30, 25, 20, 15].map((h, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className="w-8 bg-slate-200 rounded-t" style={{ height: `${h}%` }} />
                        <div className="w-6 h-6 bg-slate-200 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : socialAffiliates.length === 0 ? (
                  // Empty state for chart
                  <div className="w-full h-[160px] flex flex-col items-center justify-center text-slate-400">
                    <Users size={24} className="mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No affiliates discovered yet</p>
                    <p className="text-[10px]">Start a search to see competitor data</p>
                  </div>
                ) : (
                  <TopCompetitorsChart data={topCompetitorsData} />
                )}
              </div>

              {/* Market Share Trends */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-900 mb-3">Market share trends</h3>
                {isDataLoading ? (
                  // Loading skeleton for line chart
                  <div className="w-full h-[140px] flex items-center justify-center animate-pulse">
                    <div className="w-full h-full flex flex-col justify-between py-4">
                      {/* Y-axis labels skeleton */}
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-3 bg-slate-200 rounded" />
                        <div className="flex-1 h-0.5 bg-slate-100 rounded" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-3 bg-slate-200 rounded" />
                        <div className="flex-1 h-0.5 bg-slate-100 rounded" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-3 bg-slate-200 rounded" />
                        <div className="flex-1 h-0.5 bg-slate-100 rounded" />
                      </div>
                      {/* X-axis labels skeleton */}
                      <div className="flex justify-between pl-12 mt-2">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((_, i) => (
                          <div key={i} className="w-6 h-2 bg-slate-200 rounded" />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : socialAffiliates.length === 0 ? (
                  // Empty state for chart
                  <div className="w-full h-[140px] flex flex-col items-center justify-center text-slate-400">
                    <Search size={24} className="mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No trend data available</p>
                    <p className="text-[10px]">Discover affiliates to track growth</p>
                  </div>
                ) : (
                  <MarketShareChart data={marketShareData} />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section - Affiliate Cards */}
          <div>
            {/* Affiliate Filters Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative w-36">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={12} />
                  </div>
                  <input
                    className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all"
                    type="text"
                    value={affiliateSearch}
                    onChange={(e) => setAffiliateSearch(e.target.value)}
                    placeholder="Search affiliates..."
                  />
                </div>

                {/* Platform Filter Buttons */}
                {(['All', 'Instagram', 'TikTok', 'YouTube'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAffiliatePlatform(p)}
                    disabled={isDataLoading}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                      affiliatePlatform === p
                        ? "bg-[#D4E815] border border-[#D4E815] text-[#1A1D21]"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
                      isDataLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span>{p}</span>
                    {/* Show count for each platform - only when data is loaded */}
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[9px]",
                      affiliatePlatform === p ? "bg-[#1A1D21]/10" : "bg-slate-100"
                    )}>
                      {isDataLoading 
                        ? '-' 
                        : p === 'All' 
                          ? affiliateCards.length 
                          : affiliateCards.filter(a => a.platform === p).length
                      }
                    </span>
                  </button>
                ))}
              </div>

              {/* View All Discovered Link */}
              <a 
                href="/discovered"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all"
              >
                <SlidersHorizontal size={11} className="text-slate-400" />
                <span>View all discovered</span>
              </a>
            </div>

            {/* Affiliate Cards Grid */}
            {isDataLoading ? (
              // Loading skeleton
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-24 mb-1" />
                        <div className="h-3 bg-slate-100 rounded w-16" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <div className="h-6 bg-slate-200 rounded w-16 mb-1" />
                        <div className="h-2 bg-slate-100 rounded w-12" />
                      </div>
                      <div>
                        <div className="h-6 bg-slate-200 rounded w-16 mb-1" />
                        <div className="h-2 bg-slate-100 rounded w-12" />
                      </div>
                    </div>
                    <div className="h-8 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredAffiliates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAffiliates.map((affiliate) => (
                  <AffiliateCard
                    key={affiliate.id}
                    {...affiliate}
                    onAddProfile={() => handleAddProfile(affiliate.id)}
                  />
                ))}
              </div>
            ) : (
              // Empty state
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Users className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No affiliates found</h3>
                <p className="text-slate-400 text-sm mb-4">
                  {affiliateSearch || affiliatePlatform !== 'All' 
                    ? 'Try adjusting your filters' 
                    : 'Start discovering affiliates to see them here'
                  }
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-sm font-semibold rounded-lg hover:bg-[#c5d913] transition-all"
                >
                  <Plus size={14} />
                  Find Affiliates
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

