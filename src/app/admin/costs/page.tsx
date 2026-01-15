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
import { AdminSelect } from '../components/AdminSelect';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Cost analysis page updated for bold borders and high contrast.
// Polish pass (softer shadows + calmer hover) - January 15th, 2026

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30');

  // Refresh animation (Admin) - January 15th, 2026
  const fetchCosts = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
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
      setIsRefreshing(false);
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
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-black/10 border-2 border-black" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-80 bg-black/10 border-2 border-black" />
            <div className="h-80 bg-black/10 border-2 border-black" />
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
          <h1 className="text-3xl font-black uppercase text-black">Cost Analysis</h1>
          <p className="text-sm text-black/70 mt-1">
            API usage costs and breakdown
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Standard admin dropdown styling (matches main app pattern) - Jan 15, 2026 */}
          <AdminSelect
            ariaLabel="Cost range"
            value={timeRange}
            onChange={setTimeRange}
            className="min-w-[180px]"
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          <ExportButton 
            endpoint="/api/admin/costs" 
            filename="costs" 
            params={{ range: timeRange }}
          />
          <button
            onClick={fetchCosts}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border-4 border-black text-black text-sm font-bold uppercase shadow-[4px_4px_0px_0px_#111827]">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black bg-[#D4E815]">
              <DollarSign className="w-5 h-5 text-black" />
            </div>
          </div>
          <p className="text-2xl font-black text-black">
            ${(totalStats?.total_cost || 0).toFixed(2)}
          </p>
          <p className="text-sm font-bold uppercase text-black/70">Total Cost</p>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black bg-white">
              <Activity className="w-5 h-5 text-black" />
            </div>
          </div>
          <p className="text-2xl font-black text-black">
            {(totalStats?.total_calls || 0).toLocaleString()}
          </p>
          <p className="text-sm font-bold uppercase text-black/70">API Calls</p>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black bg-white">
              <Users className="w-5 h-5 text-black" />
            </div>
          </div>
          <p className="text-2xl font-black text-black">
            {totalStats?.unique_users || 0}
          </p>
          <p className="text-sm font-bold uppercase text-black/70">Active Users</p>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black bg-white">
              <Clock className="w-5 h-5 text-black" />
            </div>
          </div>
          <p className="text-2xl font-black text-black">
            {((totalStats?.avg_duration || 0) / 1000).toFixed(1)}s
          </p>
          <p className="text-sm font-bold uppercase text-black/70">Avg Response Time</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Trend */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-black" />
            <h2 className="text-lg font-black uppercase text-black">Daily Cost Trend</h2>
          </div>
          {formattedDailyCosts.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedDailyCosts}>
                  <defs>
                    <linearGradient id="colorCost2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4E815" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D4E815" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false} />
                  <XAxis dataKey="date" stroke="#111827" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#111827" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '2px solid #111827', borderRadius: '0px', fontSize: '12px' }}
                    labelStyle={{ color: '#111827' }}
                    formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#111827" strokeWidth={2} fillOpacity={1} fill="url(#colorCost2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-black/60 font-bold uppercase">No data</div>
          )}
        </div>

        {/* Cost by Service Pie */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-black" />
            <h2 className="text-lg font-black uppercase text-black">Cost by Service</h2>
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
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '2px solid #111827', borderRadius: '0px', fontSize: '12px' }}
                    formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => <span style={{ color: '#111827' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-black/60 font-bold uppercase">No data</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service Breakdown Table */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-black" />
            <h2 className="text-lg font-black uppercase text-black">Service Breakdown</h2>
          </div>
          <div className="space-y-2">
            {serviceBreakdown.map((item, index) => (
              <div key={item.service} className="flex items-center justify-between p-3 border-2 border-black">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <div>
                    <p className="text-sm font-bold uppercase text-black">{formatServiceName(item.service)}</p>
                    <div className="flex items-center gap-2 text-xs text-black/60">
                      <span>{item.calls.toLocaleString()} calls</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-black" />
                        {item.success_count}
                      </span>
                      {item.error_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-black" />
                            {item.error_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-black">${Number(item.cost || 0).toFixed(2)}</p>
              </div>
            ))}
            {serviceBreakdown.length === 0 && (
              <p className="text-black/60 font-bold uppercase text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-black" />
            <h2 className="text-lg font-black uppercase text-black">Top Users by Cost</h2>
          </div>
          <div className="space-y-2">
            {topUsers.map((user, index) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-3 border-2 border-black cursor-pointer hover:bg-[#D4E815] transition-colors"
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-black bg-[#D4E815] flex items-center justify-center text-xs font-bold text-black">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black">{user.name || 'Unnamed'}</p>
                    <p className="text-xs text-black/60">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-black">${Number(user.total_cost || 0).toFixed(2)}</p>
                  <p className="text-xs text-black/60">{user.total_calls} calls</p>
                </div>
              </div>
            ))}
            {topUsers.length === 0 && (
              <p className="text-black/60 font-bold uppercase text-center py-4">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
        <h2 className="text-lg font-black uppercase text-black mb-4">API Call Status</h2>
        <div className="flex items-center gap-6">
          {statusBreakdown.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 border border-black',
                item.status === 'success' ? 'bg-green-400' :
                item.status === 'error' ? 'bg-red-400' :
                item.status === 'timeout' ? 'bg-yellow-400' :
                'bg-slate-400'
              )} />
              <span className="text-sm text-black/70 font-bold uppercase capitalize">{item.status}:</span>
              <span className="text-sm font-bold text-black">{item.count.toLocaleString()}</span>
            </div>
          ))}
          {statusBreakdown.length === 0 && (
            <p className="text-black/60 font-bold uppercase">No data</p>
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
