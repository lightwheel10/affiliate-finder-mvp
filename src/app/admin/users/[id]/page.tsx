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
  const userId = params.id as string;

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
          <div className="h-8 w-32 bg-[#23272B] rounded-lg" />
          <div className="h-40 bg-[#23272B] rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-[#23272B] rounded-xl" />
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
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400">{error || 'User not found'}</p>
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
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      {/* User Header */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#D4E815]/10 flex items-center justify-center">
              <User className="w-8 h-8 text-[#D4E815]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{user.name || 'Unnamed User'}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium',
                  user.plan === 'business' ? 'bg-purple-500/10 text-purple-400' :
                  user.plan === 'pro' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-500/10 text-slate-400'
                )}>
                  {user.plan?.charAt(0).toUpperCase() + user.plan?.slice(1) || 'Free'}
                </span>
                {user.is_trial_period && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400">
                    <Clock className="w-3 h-3" />
                    Trial
                  </span>
                )}
                {user.subscription_status === 'active' && !user.is_trial_period && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-slate-400">
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
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-[#D4E815]" />
            <span className="text-xs font-medium text-slate-400">Topic Searches</span>
          </div>
          <p className="text-lg font-bold text-white">
            {user.topic_search_credits_used || 0} / {user.topic_search_credits_total || 0}
          </p>
        </div>
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-400">Email Credits</span>
          </div>
          <p className="text-lg font-bold text-white">
            {user.email_credits_used || 0} / {user.email_credits_total || 0}
          </p>
        </div>
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-slate-400">AI Credits</span>
          </div>
          <p className="text-lg font-bold text-white">
            {user.ai_credits_used || 0} / {user.ai_credits_total || 0}
          </p>
        </div>
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-slate-400">Monthly Cost</span>
          </div>
          <p className="text-lg font-bold text-[#D4E815]">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-slate-500">{totalCalls} API calls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(['overview', 'api-calls', 'searches'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-[#D4E815]/10 text-[#D4E815]'
                : 'text-slate-400 hover:bg-[#23272B] hover:text-white'
            )}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'api-calls' && `API Calls (${apiCalls.length})`}
            {tab === 'searches' && `Searches (${searches.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338]">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Cost by Service (This Month)</h3>
            {costBreakdown.length > 0 ? (
              <div className="space-y-3">
                {costBreakdown.map((item) => (
                  <div 
                    key={item.service}
                    className="flex items-center justify-between p-3 bg-[#1A1D21] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {formatServiceName(item.service)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.calls.toLocaleString()} calls
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#D4E815]">
                      ${Number(item.cost || 0).toFixed(4)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No API usage this month</p>
            )}
          </div>
        )}

        {activeTab === 'api-calls' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2E3338]">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Service</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Query</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Results</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Cost</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {apiCalls.slice(0, 50).map((call) => (
                  <tr key={call.id} className="border-b border-[#2E3338] last:border-0">
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{formatServiceName(call.service)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400 max-w-[200px] truncate block">
                        {call.keyword || call.domain || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-1 rounded-md text-xs font-medium',
                        call.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      )}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">{call.results_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#D4E815]">${Number(call.estimated_cost || 0).toFixed(4)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">
                        {new Date(call.created_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {apiCalls.length === 0 && (
              <p className="text-slate-500 text-center py-8">No API calls recorded</p>
            )}
          </div>
        )}

        {activeTab === 'searches' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2E3338]">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Keyword</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Sources</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Results</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Cost</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {searches.map((search) => (
                  <tr key={search.id} className="border-b border-[#2E3338] last:border-0">
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{search.keyword}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {search.sources?.map((source) => (
                          <span key={source} className="px-1.5 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">{search.results_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#D4E815]">
                        ${Number(search.total_cost || 0).toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">
                        {new Date(search.searched_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searches.length === 0 && (
              <p className="text-slate-500 text-center py-8">No searches recorded</p>
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
