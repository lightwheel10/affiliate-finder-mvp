'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  User,
  Mail,
  CreditCard,
  Calendar,
  Activity,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  Server,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// User detail page updated to match high-contrast admin design.
// Polish pass (table striping + softer shadows) - January 15th, 2026

interface UserDetail {
  id: number;
  email: string;
  name: string;
  plan: string;
  created_at: string;
  is_onboarded: boolean;
  subscription_status: string | null;
  subscription_plan: string | null;
  billing_interval: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  card_last4: string | null;
  card_brand: string | null;
  topic_search_credits_total: number | null;
  topic_search_credits_used: number | null;
  email_credits_total: number | null;
  email_credits_used: number | null;
  ai_credits_total: number | null;
  ai_credits_used: number | null;
  is_trial_period: boolean | null;
}

interface ApiCall {
  id: number;
  service: string;
  endpoint: string | null;
  keyword: string | null;
  domain: string | null;
  status: string;
  results_count: number;
  estimated_cost: number;
  duration_ms: number | null;
  created_at: string;
}

interface SearchRecord {
  id: number;
  keyword: string;
  sources: string[];
  results_count: number;
  total_cost: number | null;
  searched_at: string;
}

interface CostBreakdown {
  service: string;
  calls: number;
  cost: number;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'api-calls' | 'searches'>('overview');

  useEffect(() => {
    const fetchUserDetail = async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }

        if (res.status === 404) {
          setError('User not found');
          setIsLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to fetch user details');
        }

        const data = await res.json();
        setUser(data.user);
        setApiCalls(data.apiCalls || []);
        setSearches(data.searches || []);
        setCostBreakdown(data.costBreakdown || []);
        setError('');
      } catch (err) {
        setError('Failed to load user details');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserDetail();
    }
  }, [userId]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-black/10 border-2 border-black" />
          <div className="h-40 bg-black/10 border-2 border-black" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-black/10 border-2 border-black" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push('/admin/users')}
          className="flex items-center gap-2 text-sm font-bold uppercase text-black hover:bg-black hover:text-white border-2 border-black px-3 py-1 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <div className="bg-red-100 border-4 border-black p-6 text-center shadow-[4px_4px_0px_0px_#111827]">
          <p className="text-black font-bold uppercase">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  const totalCost = costBreakdown.reduce((acc, item) => acc + item.cost, 0);
  const totalCalls = costBreakdown.reduce((acc, item) => acc + item.calls, 0);

  return (
    <div className="p-8">
      {/* Back Button */}
      <button
        onClick={() => router.push('/admin/users')}
        className="flex items-center gap-2 text-sm font-bold uppercase text-black hover:bg-black hover:text-white border-2 border-black px-3 py-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      {/* User Header */}
      <div className="bg-white border-4 border-black p-6 mb-6 shadow-[3px_3px_0px_0px_#111827]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border-2 border-black bg-[#D4E815] flex items-center justify-center">
              <User className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase text-black">{user.name || 'Unnamed User'}</h1>
              <p className="text-sm text-black/70 flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn(
                  'px-2 py-1 border-2 border-black text-xs font-bold uppercase text-black',
                  user.plan === 'business' ? 'bg-purple-200' :
                  user.plan === 'pro' ? 'bg-blue-200' :
                  'bg-white'
                )}>
                  {user.plan?.charAt(0).toUpperCase() + user.plan?.slice(1) || 'Free'}
                </span>
                {user.is_trial_period && (
                  <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-[#D4E815] text-black">
                    <Clock className="w-3 h-3 text-black" />
                    Trial
                  </span>
                )}
                {user.subscription_status === 'active' && !user.is_trial_period && (
                  <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-green-200 text-black">
                    <CheckCircle className="w-3 h-3 text-black" />
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-black/70">
            <p className="flex items-center gap-2 justify-end">
              <Calendar className="w-4 h-4" />
              Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
            {user.card_last4 && (
              <p className="flex items-center gap-2 justify-end mt-1">
                <CreditCard className="w-4 h-4" />
                {user.card_brand} •••• {user.card_last4}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Credits */}
        <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-black" />
            <span className="text-xs font-bold uppercase text-black/70">Topic Searches</span>
          </div>
          <p className="text-lg font-black text-black">
            {user.topic_search_credits_used || 0} / {user.topic_search_credits_total || 0}
          </p>
        </div>
        <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-black" />
            <span className="text-xs font-bold uppercase text-black/70">Email Credits</span>
          </div>
          <p className="text-lg font-black text-black">
            {user.email_credits_used || 0} / {user.email_credits_total || 0}
          </p>
        </div>
        <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-black" />
            <span className="text-xs font-bold uppercase text-black/70">AI Credits</span>
          </div>
          <p className="text-lg font-black text-black">
            {user.ai_credits_used || 0} / {user.ai_credits_total || 0}
          </p>
        </div>
        <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-black" />
            <span className="text-xs font-bold uppercase text-black/70">Monthly Cost</span>
          </div>
          <p className="text-lg font-black text-black">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-black/60">{totalCalls} API calls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(['overview', 'api-calls', 'searches'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 border-2 border-black text-sm font-bold uppercase transition-colors',
              activeTab === tab
                ? 'bg-[#D4E815] text-black'
                : 'bg-white text-black/70 hover:bg-black hover:text-white'
            )}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'api-calls' && `API Calls (${apiCalls.length})`}
            {tab === 'searches' && `Searches (${searches.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white border-4 border-black shadow-[3px_3px_0px_0px_#111827]">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h3 className="text-sm font-black uppercase text-black mb-4">Cost by Service (This Month)</h3>
            {costBreakdown.length > 0 ? (
              <div className="space-y-3">
                {costBreakdown.map((item) => (
                  <div 
                    key={item.service}
                    className="flex items-center justify-between p-3 border-2 border-black"
                  >
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-black" />
                      <div>
                        <p className="text-sm font-bold uppercase text-black">
                          {formatServiceName(item.service)}
                        </p>
                        <p className="text-xs text-black/60">
                          {item.calls.toLocaleString()} calls
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-black">
                      ${Number(item.cost || 0).toFixed(4)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-black/60 font-bold uppercase text-center py-8">No API usage this month</p>
            )}
          </div>
        )}

        {activeTab === 'api-calls' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-4 border-black bg-black/5">
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Service</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Query</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Status</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Results</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Cost</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {apiCalls.slice(0, 50).map((call) => (
                  <tr key={call.id} className="border-b-2 border-black last:border-0 odd:bg-black/5 hover:bg-[#D4E815]/60">
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-black">{formatServiceName(call.service)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-black/70 max-w-[200px] truncate block">
                        {call.keyword || call.domain || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-1 border-2 border-black text-xs font-bold uppercase text-black',
                        call.status === 'success' ? 'bg-green-200' : 'bg-red-200'
                      )}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-black/70">{call.results_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-black">${Number(call.estimated_cost || 0).toFixed(4)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-black/70">
                        {new Date(call.created_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {apiCalls.length === 0 && (
              <p className="text-black/60 font-bold uppercase text-center py-8">No API calls recorded</p>
            )}
          </div>
        )}

        {activeTab === 'searches' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-4 border-black bg-black/5">
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Keyword</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Sources</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Results</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Cost</th>
                  <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {searches.map((search) => (
                  <tr key={search.id} className="border-b-2 border-black last:border-0 odd:bg-black/5 hover:bg-[#D4E815]/60">
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-black">{search.keyword}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {search.sources?.map((source) => (
                          <span key={source} className="px-1.5 py-0.5 border-2 border-black text-xs font-bold uppercase bg-white text-black">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-black/70">{search.results_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-black">
                        ${Number(search.total_cost || 0).toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-black/70">
                        {new Date(search.searched_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searches.length === 0 && (
              <p className="text-black/60 font-bold uppercase text-center py-8">No searches recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatServiceName(service: string): string {
  const names: Record<string, string> = {
    serper: 'Serper',
    apify_youtube: 'Apify YouTube',
    apify_instagram: 'Apify Instagram',
    apify_tiktok: 'Apify TikTok',
    apify_similarweb: 'Apify SimilarWeb',
    apollo_email: 'Apollo Email',
    lusha_email: 'Lusha Email',
  };
  return names[service] || service;
}
