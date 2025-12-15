'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  CreditCard, 
  Clock, 
  DollarSign,
  Activity,
  RefreshCw,
  Server,
  AlertTriangle,
  X
} from 'lucide-react';
import { StatCard } from './components/StatCard';
import { CostChart } from './components/CostChart';
import Link from 'next/link';

interface TriggeredAlert {
  id: number;
  alert_type: string;
  threshold: number;
  currentCost: number;
  percentUsed: number;
}

interface Stats {
  totalUsers: number;
  activeTrials: number;
  paidSubscriptions: number;
  monthlyCost: number;
  todayCalls: number;
}

interface CostTrendItem {
  date: string;
  cost: number;
  calls: number;
}

interface ServiceBreakdown {
  service: string;
  calls: number;
  cost: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [costTrend, setCostTrend] = useState<CostTrendItem[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/alerts'),
      ]);
      
      if (statsRes.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!statsRes.ok) {
        throw new Error('Failed to fetch stats');
      }

      const statsData = await statsRes.json();
      setStats(statsData.stats);
      setCostTrend(statsData.costTrend || []);
      setServiceBreakdown(statsData.serviceBreakdown || []);

      // Fetch triggered alerts
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setTriggeredAlerts(alertsData.triggeredAlerts || []);
      }

      setError('');
    } catch (err) {
      setError('Failed to load statistics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatAlertType = (type: string) => {
    switch (type) {
      case 'daily_cost': return 'Daily';
      case 'weekly_cost': return 'Weekly';
      case 'monthly_cost': return 'Monthly';
      default: return type;
    }
  };

  const visibleAlerts = triggeredAlerts.filter(a => !dismissedAlerts.includes(a.id));

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-[#23272B] rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-[#23272B] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-white hover:bg-[#2E3338] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Alert Banner */}
      {visibleAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    {formatAlertType(alert.alert_type)} Cost Threshold Exceeded
                  </p>
                  <p className="text-xs text-red-400/70">
                    Current: ${Number(alert.currentCost).toFixed(2)} / Limit: ${Number(alert.threshold).toFixed(2)} ({alert.percentUsed.toFixed(0)}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/settings"
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  Manage Alerts
                </Link>
                <button
                  onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                  className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Platform analytics and usage statistics
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Active Trials"
          value={stats?.activeTrials || 0}
          icon={Clock}
          variant="warning"
          subtitle="3-day free trials"
        />
        <StatCard
          title="Paid Subscriptions"
          value={stats?.paidSubscriptions || 0}
          icon={CreditCard}
          variant="success"
        />
        <StatCard
          title="API Cost (This Month)"
          value={`$${(stats?.monthlyCost || 0).toFixed(2)}`}
          icon={DollarSign}
          variant="default"
        />
        <StatCard
          title="API Calls Today"
          value={stats?.todayCalls || 0}
          icon={Activity}
          variant="default"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Cost Trend Chart */}
        <div className="lg:col-span-2 bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            API Cost Trend (Last 30 Days)
          </h2>
          {costTrend.length > 0 ? (
            <CostChart data={costTrend} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>

        {/* Service Breakdown */}
        <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Cost by Service
          </h2>
          {serviceBreakdown.length > 0 ? (
            <div className="space-y-3">
              {serviceBreakdown.map((item) => (
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
                    ${Number(item.cost || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/users"
            className="flex items-center gap-3 p-4 bg-[#1A1D21] rounded-lg hover:bg-[#2E3338] transition-colors group"
          >
            <Users className="w-5 h-5 text-slate-400 group-hover:text-[#D4E815]" />
            <div>
              <p className="text-sm font-medium text-white">User Management</p>
              <p className="text-xs text-slate-500">View and manage users</p>
            </div>
          </a>
          <a
            href="/admin/costs"
            className="flex items-center gap-3 p-4 bg-[#1A1D21] rounded-lg hover:bg-[#2E3338] transition-colors group"
          >
            <DollarSign className="w-5 h-5 text-slate-400 group-hover:text-[#D4E815]" />
            <div>
              <p className="text-sm font-medium text-white">Cost Analysis</p>
              <p className="text-xs text-slate-500">Detailed cost breakdown</p>
            </div>
          </a>
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-3 p-4 bg-[#1A1D21] rounded-lg hover:bg-[#2E3338] transition-colors group"
          >
            <Activity className="w-5 h-5 text-slate-400 group-hover:text-[#D4E815]" />
            <div>
              <p className="text-sm font-medium text-white">Main App</p>
              <p className="text-xs text-slate-500">Open CrewCast Studio</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function formatServiceName(service: string): string {
  const names: Record<string, string> = {
    serper: 'Serper (Google)',
    apify_youtube: 'Apify YouTube',
    apify_instagram: 'Apify Instagram',
    apify_tiktok: 'Apify TikTok',
    apify_similarweb: 'Apify SimilarWeb',
    apollo_email: 'Apollo Email',
    lusha_email: 'Lusha Email',
  };
  return names[service] || service;
}
