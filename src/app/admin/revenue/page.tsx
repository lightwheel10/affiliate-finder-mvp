'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Percent,
  UserMinus
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { cn } from '@/lib/utils';
import { DateRangePicker, DateRange } from '../components/DateRangePicker';

interface RevenueData {
  mrr: number;
  totalRevenue: number;
  totalCost: number;
  profitMargin: number;
  profitMarginPercent: number;
  activeSubscribers: number;
  churnRate: number;
  arpu: number;
  canceledCount: number;
  userProfits: UserProfit[];
  revenueCostTrend: TrendItem[];
}

interface UserProfit {
  id: string;
  email: string;
  name: string;
  plan: string;
  monthlyRevenue: number;
  apiCost: number;
  profit: number;
  profitPercent: number;
}

interface TrendItem {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export default function AdminRevenuePage() {
  const router = useRouter();
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return { startDate: start, endDate: end, label: 'Last 30 days' };
  });

  const fetchRevenue = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/admin/revenue?${params}`);
      
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      const responseData = await res.json();
      setData(responseData);
    } catch (err) {
      console.error('Failed to fetch revenue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [dateRange]);

  if (isLoading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-[#23272B] rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-[#23272B] rounded-xl" />
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${Number(value || 0).toFixed(2)}`;
  const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

  // Format chart data
  const chartData = (data?.revenueCostTrend || []).map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: Number(item.revenue || 0),
    cost: Number(item.cost || 0),
    profit: Number(item.profit || 0),
  }));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Revenue vs cost analysis and profit margins
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={fetchRevenue}
            className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* MRR */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">MRR</p>
              <p className="text-2xl font-bold text-[#D4E815]">{formatCurrency(data?.mrr || 0)}</p>
              <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
            </div>
            <div className="p-2 bg-[#D4E815]/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-[#D4E815]" />
            </div>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Profit Margin</p>
              <p className={cn(
                'text-2xl font-bold',
                (data?.profitMargin || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {formatCurrency(data?.profitMargin || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                {(data?.profitMarginPercent || 0) >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-green-400" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-400" />
                )}
                {formatPercent(data?.profitMarginPercent || 0)} margin
              </p>
            </div>
            <div className={cn(
              'p-2 rounded-lg',
              (data?.profitMargin || 0) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            )}>
              {(data?.profitMargin || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Active Subscribers */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Active Subscribers</p>
              <p className="text-2xl font-bold text-white">{data?.activeSubscribers || 0}</p>
              <p className="text-xs text-slate-500 mt-1">ARPU: {formatCurrency(data?.arpu || 0)}/mo</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Churn Rate */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Churn Rate</p>
              <p className={cn(
                'text-2xl font-bold',
                (data?.churnRate || 0) > 5 ? 'text-red-400' : 'text-white'
              )}>
                {formatPercent(data?.churnRate || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">{data?.canceledCount || 0} canceled this period</p>
            </div>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <UserMinus className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Cost Chart */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6 mb-8">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Cost Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4E815" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D4E815" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3338" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1D21',
                  border: '1px solid #2E3338',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number, name: string) => [
                  `$${Number(value || 0).toFixed(2)}`,
                  name.charAt(0).toUpperCase() + name.slice(1)
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#D4E815"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorCost)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Total Revenue</p>
          <p className="text-3xl font-bold text-[#D4E815]">{formatCurrency(data?.totalRevenue || 0)}</p>
        </div>
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Total API Cost</p>
          <p className="text-3xl font-bold text-red-400">{formatCurrency(data?.totalCost || 0)}</p>
        </div>
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Net Profit</p>
          <p className={cn(
            'text-3xl font-bold',
            (data?.profitMargin || 0) >= 0 ? 'text-green-400' : 'text-red-400'
          )}>
            {formatCurrency(data?.profitMargin || 0)}
          </p>
        </div>
      </div>

      {/* Per-User Profit Table */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] overflow-hidden">
        <div className="p-4 border-b border-[#2E3338]">
          <h3 className="text-sm font-semibold text-white">Top Users by API Cost</h3>
          <p className="text-xs text-slate-400 mt-1">Revenue vs cost breakdown per user</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1A1D21]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">Plan</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase px-4 py-3">Monthly Revenue</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase px-4 py-3">API Cost</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase px-4 py-3">Profit</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase px-4 py-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3338]">
              {(data?.userProfits || []).map((user) => (
                <tr key={user.id} className="hover:bg-[#2E3338]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{user.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium capitalize',
                      user.plan === 'business' ? 'bg-purple-500/10 text-purple-400' :
                      user.plan === 'pro' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-500/10 text-slate-400'
                    )}>
                      {user.plan || 'free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-[#D4E815]">{formatCurrency(user.monthlyRevenue)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-red-400">{formatCurrency(user.apiCost)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'text-sm font-medium',
                      user.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {formatCurrency(user.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'text-sm',
                      user.profitPercent >= 50 ? 'text-green-400' :
                      user.profitPercent >= 0 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {formatPercent(user.profitPercent)}
                    </span>
                  </td>
                </tr>
              ))}
              {(!data?.userProfits || data.userProfits.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No user data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
