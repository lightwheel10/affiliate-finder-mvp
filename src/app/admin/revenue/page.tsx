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

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Revenue dashboard updated to match high-contrast admin theme.
// Polish pass (table striping + softer shadows) - January 15th, 2026

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return { startDate: start, endDate: end, label: 'Last 30 days' };
  });

  // Refresh animation (Admin) - January 15th, 2026
  const fetchRevenue = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [dateRange]);

  if (isLoading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-black/10 border-2 border-black" />
            ))}
          </div>
          <div className="h-80 bg-black/10 border-2 border-black" />
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
          <h1 className="text-3xl font-black uppercase text-black">Revenue Dashboard</h1>
          <p className="text-sm text-black/70 mt-1">
            Revenue vs cost analysis and profit margins
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Wider dropdown to avoid cutoff in admin revenue page - Jan 15, 2026 */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            dropdownWidthClassName="w-[360px]"
          />
          <button
            onClick={fetchRevenue}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* MRR */}
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">MRR</p>
              <p className="text-2xl font-black text-black">{formatCurrency(data?.mrr || 0)}</p>
              <p className="text-xs text-black/60 mt-1">Monthly Recurring Revenue</p>
            </div>
            <div className="p-2 border-2 border-black bg-[#D4E815]">
              <DollarSign className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Profit Margin</p>
              <p className={cn(
                'text-2xl font-black',
                (data?.profitMargin || 0) >= 0 ? 'text-black' : 'text-black'
              )}>
                {formatCurrency(data?.profitMargin || 0)}
              </p>
              <p className="text-xs text-black/60 mt-1 flex items-center gap-1">
                {(data?.profitMarginPercent || 0) >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-black" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-black" />
                )}
                {formatPercent(data?.profitMarginPercent || 0)} margin
              </p>
            </div>
            <div className={cn(
              'p-2 border-2 border-black',
              (data?.profitMargin || 0) >= 0 ? 'bg-[#D4E815]' : 'bg-white'
            )}>
              {(data?.profitMargin || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-black" />
              ) : (
                <TrendingDown className="w-5 h-5 text-black" />
              )}
            </div>
          </div>
        </div>

        {/* Active Subscribers */}
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Active Subscribers</p>
              <p className="text-2xl font-black text-black">{data?.activeSubscribers || 0}</p>
              <p className="text-xs text-black/60 mt-1">ARPU: {formatCurrency(data?.arpu || 0)}/mo</p>
            </div>
            <div className="p-2 border-2 border-black bg-white">
              <Users className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Churn Rate */}
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Churn Rate</p>
              <p className={cn(
                'text-2xl font-black',
                (data?.churnRate || 0) > 5 ? 'text-black' : 'text-black'
              )}>
                {formatPercent(data?.churnRate || 0)}
              </p>
              <p className="text-xs text-black/60 mt-1">{data?.canceledCount || 0} canceled this period</p>
            </div>
            <div className="p-2 border-2 border-black bg-white">
              <UserMinus className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Cost Chart */}
      <div className="bg-white border-4 border-black p-6 mb-8 shadow-[3px_3px_0px_0px_#111827]">
        <h3 className="text-sm font-black uppercase text-black mb-4">Revenue vs Cost Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4E815" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#D4E815" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
              <XAxis 
                dataKey="date" 
                stroke="#111827" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#111827" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #111827',
                  borderRadius: '0px',
                  color: '#111827',
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
                stroke="#111827"
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
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-2">Total Revenue</p>
          <p className="text-3xl font-black text-black">{formatCurrency(data?.totalRevenue || 0)}</p>
        </div>
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-2">Total API Cost</p>
          <p className="text-3xl font-black text-black">{formatCurrency(data?.totalCost || 0)}</p>
        </div>
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-2">Net Profit</p>
          <p className={cn(
            'text-3xl font-black',
            (data?.profitMargin || 0) >= 0 ? 'text-black' : 'text-black'
          )}>
            {formatCurrency(data?.profitMargin || 0)}
          </p>
        </div>
      </div>

      {/* Per-User Profit Table */}
      <div className="bg-white border-4 border-black overflow-hidden shadow-[3px_3px_0px_0px_#111827]">
        <div className="p-4 border-b-4 border-black">
          <h3 className="text-sm font-black uppercase text-black">Top Users by API Cost</h3>
          <p className="text-xs text-black/60 mt-1">Revenue vs cost breakdown per user</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-4 border-black">
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">User</th>
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Plan</th>
                <th className="text-right text-xs font-black uppercase text-black px-4 py-3">Monthly Revenue</th>
                <th className="text-right text-xs font-black uppercase text-black px-4 py-3">API Cost</th>
                <th className="text-right text-xs font-black uppercase text-black px-4 py-3">Profit</th>
                <th className="text-right text-xs font-black uppercase text-black px-4 py-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {(data?.userProfits || []).map((user) => (
                <tr key={user.id} className="odd:bg-black/5 hover:bg-[#D4E815]/60 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-black">{user.name || 'Unknown'}</p>
                      <p className="text-xs text-black/60">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-1 border-2 border-black text-xs font-bold uppercase text-black',
                      user.plan === 'business' ? 'bg-purple-200' :
                      user.plan === 'pro' ? 'bg-blue-200' :
                      'bg-white'
                    )}>
                      {user.plan || 'free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-black">{formatCurrency(user.monthlyRevenue)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-black">{formatCurrency(user.apiCost)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'text-sm font-bold',
                      user.profit >= 0 ? 'text-black' : 'text-black'
                    )}>
                      {formatCurrency(user.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'text-sm font-bold',
                      user.profitPercent >= 50 ? 'text-black' :
                      user.profitPercent >= 0 ? 'text-black' : 'text-black'
                    )}>
                      {formatPercent(user.profitPercent)}
                    </span>
                  </td>
                </tr>
              ))}
              {(!data?.userProfits || data.userProfits.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-black/60 font-bold uppercase">
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
