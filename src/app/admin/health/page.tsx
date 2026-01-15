'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  AlertCircle,
  Server
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { AdminSelect } from '../components/AdminSelect';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Health page updated to align with bold, high-contrast admin styling.
// Polish pass (table striping + softer shadows) - January 15th, 2026

interface ServiceHealth {
  service: string;
  total_calls: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_duration: number;
  p95_duration: number;
  status: 'healthy' | 'degraded' | 'down';
}

interface ErrorTrendItem {
  hour: string;
  total: number;
  errors: number;
}

interface HourlyItem {
  hour: number;
  calls: number;
  success_count: number;
  error_count: number;
}

interface RecentError {
  id: string;
  service: string;
  endpoint: string;
  status: string;
  error_message: string;
  duration_ms: number;
  user_id: string;
  created_at: string;
}

interface OverallStats {
  total_calls: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_duration: number;
  p95_duration: number;
  unique_users: number;
}

interface HealthData {
  serviceHealth: ServiceHealth[];
  errorTrend: ErrorTrendItem[];
  hourlyDistribution: HourlyItem[];
  recentErrors: RecentError[];
  overallStats: OverallStats;
}

export default function AdminHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('24');

  // Refresh animation (Admin) - January 15th, 2026
  const fetchHealth = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/health?range=${timeRange}`);
      
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      const responseData = await res.json();
      setData(responseData);
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [timeRange]);

  if (isLoading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-black/10 border-2 border-black" />
            ))}
          </div>
          <div className="h-80 bg-black/10 border-2 border-black" />
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 border-2 border-black text-black';
      case 'degraded':
        return 'bg-yellow-100 border-2 border-black text-black';
      case 'down':
        return 'bg-red-100 border-2 border-black text-black';
      default:
        return 'bg-white border-2 border-black text-black';
    }
  };

  // Format error trend for chart
  const errorChartData = (data?.errorTrend || []).map(item => ({
    time: new Date(item.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    errors: item.errors,
    total: item.total,
    errorRate: item.total > 0 ? (item.errors / item.total * 100) : 0,
  }));

  // Format hourly distribution
  const hourlyData = (data?.hourlyDistribution || []).map(item => ({
    hour: `${item.hour}:00`,
    calls: item.calls,
    success: item.success_count,
    errors: item.error_count,
  }));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase text-black">API Health</h1>
          <p className="text-sm text-black/70 mt-1">
            Monitor service status, response times, and error rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Standard admin dropdown styling (matches main app pattern) - Jan 15, 2026 */}
          <AdminSelect
            ariaLabel="Health time range"
            value={timeRange}
            onChange={setTimeRange}
            className="min-w-[180px]"
            options={[
              { value: '1', label: 'Last 1 hour' },
              { value: '6', label: 'Last 6 hours' },
              { value: '24', label: 'Last 24 hours' },
              { value: '72', label: 'Last 3 days' },
              { value: '168', label: 'Last 7 days' },
              { value: '720', label: 'Last 30 days' },
            ]}
          />
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Total Calls</p>
              <p className="text-2xl font-black text-black">{data?.overallStats?.total_calls || 0}</p>
            </div>
            <div className="p-2 border-2 border-black bg-white">
              <Activity className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Success Rate</p>
              <p className={cn(
                'text-2xl font-black',
                'text-black'
              )}>
                {Number(data?.overallStats?.success_rate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-2 border-2 border-black bg-[#D4E815]">
              <CheckCircle className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Avg Response</p>
              <p className="text-2xl font-black text-black">{data?.overallStats?.avg_duration || 0}ms</p>
              <p className="text-xs text-black/60">P95: {data?.overallStats?.p95_duration || 0}ms</p>
            </div>
            <div className="p-2 border-2 border-black bg-white">
              <Zap className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">Errors</p>
              <p className={cn(
                'text-2xl font-black',
                'text-black'
              )}>
                {data?.overallStats?.error_count || 0}
              </p>
            </div>
            <div className="p-2 border-2 border-black bg-white">
              <AlertTriangle className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="mb-8">
        <h2 className="text-sm font-black uppercase text-black mb-4">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.serviceHealth || []).map((service) => (
            <div
              key={service.service}
              className={cn(
                'border p-4 shadow-[3px_3px_0px_0px_#111827]',
                getStatusColor(service.status)
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase">{service.service}</span>
                </div>
                {getStatusIcon(service.status)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-current opacity-60 uppercase">Success</p>
                  <p className="text-sm font-bold">{Number(service.success_rate || 0).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-current opacity-60 uppercase">Avg</p>
                  <p className="text-sm font-bold">{service.avg_duration}ms</p>
                </div>
                <div>
                  <p className="text-xs text-current opacity-60 uppercase">P95</p>
                  <p className="text-sm font-bold">{service.p95_duration}ms</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/20 flex justify-between text-xs font-bold uppercase">
                <span>{service.total_calls} calls</span>
                <span>{service.error_count} errors</span>
              </div>
            </div>
          ))}
          {(!data?.serviceHealth || data.serviceHealth.length === 0) && (
            <div className="col-span-full bg-white border-4 border-black p-8 text-center text-black/60 font-bold uppercase shadow-[3px_3px_0px_0px_#111827]">
              No service data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Error Trend */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <h3 className="text-sm font-black uppercase text-black mb-4">Error Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errorChartData}>
                <defs>
                  <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                <XAxis dataKey="time" stroke="#111827" fontSize={11} tickLine={false} />
                <YAxis stroke="#111827" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #111827',
                    borderRadius: '0px',
                    color: '#111827',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorErrors)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <h3 className="text-sm font-black uppercase text-black mb-4">Hourly Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
                <XAxis dataKey="hour" stroke="#111827" fontSize={11} tickLine={false} />
                <YAxis stroke="#111827" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #111827',
                    borderRadius: '0px',
                    color: '#111827',
                  }}
                />
                <Bar dataKey="success" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="errors" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Errors Table */}
      <div className="bg-white border-4 border-black overflow-hidden shadow-[3px_3px_0px_0px_#111827]">
        <div className="p-4 border-b-4 border-black">
          <h3 className="text-sm font-black uppercase text-black">Recent Errors</h3>
          <p className="text-xs text-black/60 mt-1">Last 20 failed API calls</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-4 border-black">
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Time</th>
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Service</th>
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Endpoint</th>
                <th className="text-left text-xs font-black uppercase text-black px-4 py-3">Error</th>
                <th className="text-right text-xs font-black uppercase text-black px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {(data?.recentErrors || []).map((error) => (
                <tr key={error.id} className="odd:bg-black/5 hover:bg-[#D4E815]/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm text-black/70">
                      {new Date(error.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 border-2 border-black text-black bg-red-200 text-xs font-bold uppercase capitalize">
                      {error.service}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-black font-mono">
                      {error.endpoint?.substring(0, 50)}...
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-black">
                      {error.error_message?.substring(0, 80)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-black/70">{error.duration_ms}ms</span>
                  </td>
                </tr>
              ))}
              {(!data?.recentErrors || data.recentErrors.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-black/60 font-bold uppercase">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-black" />
                    No errors in this period
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
