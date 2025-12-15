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
  const [timeRange, setTimeRange] = useState('24');

  const fetchHealth = async () => {
    setIsLoading(true);
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
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [timeRange]);

  if (isLoading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-[#23272B] rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-[#23272B] rounded-xl" />
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
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'degraded':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'down':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
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
          <h1 className="text-2xl font-bold text-white">API Health</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor service status, response times, and error rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-[#23272B] border border-[#2E3338] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
          >
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="72">Last 3 days</option>
            <option value="168">Last 7 days</option>
          </select>
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Total Calls</p>
              <p className="text-2xl font-bold text-white">{data?.overallStats?.total_calls || 0}</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Success Rate</p>
              <p className={cn(
                'text-2xl font-bold',
                (data?.overallStats?.success_rate || 0) >= 95 ? 'text-green-400' :
                (data?.overallStats?.success_rate || 0) >= 80 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {Number(data?.overallStats?.success_rate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Avg Response</p>
              <p className="text-2xl font-bold text-white">{data?.overallStats?.avg_duration || 0}ms</p>
              <p className="text-xs text-slate-500">P95: {data?.overallStats?.p95_duration || 0}ms</p>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Errors</p>
              <p className={cn(
                'text-2xl font-bold',
                (data?.overallStats?.error_count || 0) === 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {data?.overallStats?.error_count || 0}
              </p>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.serviceHealth || []).map((service) => (
            <div
              key={service.service}
              className={cn(
                'rounded-xl border p-4',
                getStatusColor(service.status)
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span className="text-sm font-medium capitalize">{service.service}</span>
                </div>
                {getStatusIcon(service.status)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-current opacity-60">Success</p>
                  <p className="text-sm font-semibold">{Number(service.success_rate || 0).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-current opacity-60">Avg</p>
                  <p className="text-sm font-semibold">{service.avg_duration}ms</p>
                </div>
                <div>
                  <p className="text-xs text-current opacity-60">P95</p>
                  <p className="text-sm font-semibold">{service.p95_duration}ms</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-current/10 flex justify-between text-xs">
                <span>{service.total_calls} calls</span>
                <span>{service.error_count} errors</span>
              </div>
            </div>
          ))}
          {(!data?.serviceHealth || data.serviceHealth.length === 0) && (
            <div className="col-span-full bg-[#23272B] rounded-xl border border-[#2E3338] p-8 text-center text-slate-400">
              No service data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Error Trend */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Error Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errorChartData}>
                <defs>
                  <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3338" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1D21',
                    border: '1px solid #2E3338',
                    borderRadius: '8px',
                    color: '#fff',
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
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Hourly Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3338" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1D21',
                    border: '1px solid #2E3338',
                    borderRadius: '8px',
                    color: '#fff',
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
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] overflow-hidden">
        <div className="p-4 border-b border-[#2E3338]">
          <h3 className="text-sm font-semibold text-white">Recent Errors</h3>
          <p className="text-xs text-slate-400 mt-1">Last 20 failed API calls</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1A1D21]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">Time</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">Service</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">Endpoint</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase px-4 py-3">Error</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3338]">
              {(data?.recentErrors || []).map((error) => (
                <tr key={error.id} className="hover:bg-[#2E3338]/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {new Date(error.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium capitalize">
                      {error.service}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white font-mono">
                      {error.endpoint?.substring(0, 50)}...
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-red-400">
                      {error.error_message?.substring(0, 80)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-400">{error.duration_ms}ms</span>
                  </td>
                </tr>
              ))}
              {(!data?.recentErrors || data.recentErrors.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
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
