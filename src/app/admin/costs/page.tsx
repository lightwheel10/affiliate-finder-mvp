'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign,
  Activity,
  Users,
  Clock,
  RefreshCw,
  Server,
  TrendingUp,
  BarChart3,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { ExportButton } from '../components/ExportButton';

interface ServiceBreakdown {
  service: string;
  calls: number;
  cost: number;
  results: number;
  avg_duration: number;
  success_count: number;
  error_count: number;
}

interface DailyCost {
  date: string;
  cost: number;
  calls: number;
}

interface TopUser {
  id: number;
  email: string;
  name: string;
  total_cost: number;
  total_calls: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface TotalStats {
  total_calls: number;
  total_cost: number;
  unique_users: number;
  avg_duration: number;
}

const COLORS = ['#D4E815', '#22C55E', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#06B6D4'];

export default function AdminCostsPage() {
  const router = useRouter();
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30');

  const fetchCosts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/costs?range=${timeRange}`);
      
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch costs');
      }

      const data = await res.json();
      setServiceBreakdown(data.serviceBreakdown || []);
      setDailyCosts(data.dailyCosts || []);
      setTopUsers(data.topUsers || []);
      setStatusBreakdown(data.statusBreakdown || []);
      setTotalStats(data.totalStats || null);
      setError('');
    } catch (err) {
      setError('Failed to load cost data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCosts();
  }, [timeRange]);

  // Format daily costs for chart
  const formattedDailyCosts = dailyCosts.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: Number(Number(item.cost || 0).toFixed(4)),
  }));

  // Format service breakdown for pie chart
  const pieData = serviceBreakdown.map((item) => ({
    name: formatServiceName(item.service),
    value: Number(item.cost || 0),
  }));

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[#23272B] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-80 bg-[#23272B] rounded-xl" />
            <div className="h-80 bg-[#23272B] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cost Analysis</h1>
          <p className="text-sm text-slate-400 mt-1">
            API usage costs and breakdown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-[#23272B] border border-[#2E3338] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <ExportButton 
            endpoint="/api/admin/costs" 
            filename="costs" 
            params={{ range: timeRange }}
          />
          <button
            onClick={fetchCosts}
            className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-[#D4E815]/10">
              <DollarSign className="w-5 h-5 text-[#D4E815]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            ${(totalStats?.total_cost || 0).toFixed(2)}
          </p>
          <p className="text-sm text-slate-400">Total Cost</p>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {(totalStats?.total_calls || 0).toLocaleString()}
          </p>
          <p className="text-sm text-slate-400">API Calls</p>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalStats?.unique_users || 0}
          </p>
          <p className="text-sm text-slate-400">Active Users</p>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <Clock className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {((totalStats?.avg_duration || 0) / 1000).toFixed(1)}s
          </p>
          <p className="text-sm text-slate-400">Avg Response Time</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Trend */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#D4E815]" />
            <h2 className="text-lg font-semibold text-white">Daily Cost Trend</h2>
          </div>
          {formattedDailyCosts.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedDailyCosts}>
                  <defs>
                    <linearGradient id="colorCost2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4E815" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4E815" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3338" vertical={false} />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#23272B', border: '1px solid #2E3338', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#D4E815" strokeWidth={2} fillOpacity={1} fill="url(#colorCost2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-500">No data</div>
          )}
        </div>

        {/* Cost by Service Pie */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#D4E815]" />
            <h2 className="text-lg font-semibold text-white">Cost by Service</h2>
          </div>
          {pieData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#23272B', border: '1px solid #2E3338', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => <span style={{ color: '#9CA3AF' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-500">No data</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service Breakdown Table */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-[#D4E815]" />
            <h2 className="text-lg font-semibold text-white">Service Breakdown</h2>
          </div>
          <div className="space-y-2">
            {serviceBreakdown.map((item, index) => (
              <div key={item.service} className="flex items-center justify-between p-3 bg-[#1A1D21] rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{formatServiceName(item.service)}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{item.calls.toLocaleString()} calls</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {item.success_count}
                      </span>
                      {item.error_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-red-400" />
                            {item.error_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#D4E815]">${Number(item.cost || 0).toFixed(2)}</p>
              </div>
            ))}
            {serviceBreakdown.length === 0 && (
              <p className="text-slate-500 text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#D4E815]" />
            <h2 className="text-lg font-semibold text-white">Top Users by Cost</h2>
          </div>
          <div className="space-y-2">
            {topUsers.map((user, index) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-3 bg-[#1A1D21] rounded-lg cursor-pointer hover:bg-[#2E3338] transition-colors"
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#D4E815]/10 flex items-center justify-center text-xs font-bold text-[#D4E815]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#D4E815]">${Number(user.total_cost || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{user.total_calls} calls</p>
                </div>
              </div>
            ))}
            {topUsers.length === 0 && (
              <p className="text-slate-500 text-center py-4">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">API Call Status</h2>
        <div className="flex items-center gap-6">
          {statusBreakdown.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 rounded-full',
                item.status === 'success' ? 'bg-green-400' :
                item.status === 'error' ? 'bg-red-400' :
                item.status === 'timeout' ? 'bg-yellow-400' :
                'bg-slate-400'
              )} />
              <span className="text-sm text-slate-400 capitalize">{item.status}:</span>
              <span className="text-sm font-medium text-white">{item.count.toLocaleString()}</span>
            </div>
          ))}
          {statusBreakdown.length === 0 && (
            <p className="text-slate-500">No data</p>
          )}
        </div>
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
