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
import { cn } from '@/lib/utils';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Dashboard updated to match the bold, high-contrast visual system.
// Polish pass (lighter shadows + calmer hovers) - January 15th, 2026

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Refresh animation (Admin) - January 15th, 2026
  const fetchStats = async () => {
    setIsRefreshing(true);
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
      setIsRefreshing(false);
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
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-black/10 border-2 border-black" />
            ))}
          </div>
          <div className="h-80 bg-black/10 border-2 border-black" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border-4 border-black p-6 text-center shadow-[3px_3px_0px_0px_#111827]">
          <p className="text-black font-bold uppercase">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
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
              className="flex items-center justify-between p-4 bg-red-100 border-4 border-black shadow-[3px_3px_0px_0px_#111827]"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-black" />
                <div>
                  <p className="text-sm font-bold uppercase text-black">
                    {formatAlertType(alert.alert_type)} Cost Threshold Exceeded
                  </p>
                  <p className="text-xs text-black/70">
                    Current: ${Number(alert.currentCost).toFixed(2)} / Limit: ${Number(alert.threshold).toFixed(2)} ({alert.percentUsed.toFixed(0)}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/settings"
                  className="px-3 py-1.5 text-xs font-bold uppercase text-black border-2 border-black hover:bg-black hover:text-white transition-colors"
                >
                  Manage Alerts
                </Link>
                <button
                  onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                  className="p-1.5 text-black border-2 border-black hover:bg-black hover:text-white transition-colors"
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
          <h1 className="text-3xl font-black uppercase text-black">Dashboard Overview</h1>
          <p className="text-sm font-medium text-black/70 mt-1">
            Platform analytics and usage statistics
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
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
        <div className="lg:col-span-2 bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <h2 className="text-lg font-black uppercase text-black mb-4">
            API Cost Trend (Last 30 Days)
          </h2>
          {costTrend.length > 0 ? (
            <CostChart data={costTrend} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-black/60 font-bold uppercase">
              No data available
            </div>
          )}
        </div>

        {/* Service Breakdown */}
        <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
          <h2 className="text-lg font-black uppercase text-black mb-4">
            Cost by Service
          </h2>
          {serviceBreakdown.length > 0 ? (
            <div className="space-y-3">
              {serviceBreakdown.map((item) => (
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
                  <p className="text-sm font-black text-black">
                    ${Number(item.cost || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-black/60 font-bold uppercase">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]">
        <h2 className="text-lg font-black uppercase text-black mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/users"
            className="flex items-center gap-3 p-4 border-2 border-black hover:bg-[#D4E815]/60 transition-colors group"
          >
            <Users className="w-5 h-5 text-black" />
            <div>
              <p className="text-sm font-bold uppercase text-black">User Management</p>
              <p className="text-xs text-black/60">View and manage users</p>
            </div>
          </a>
          <a
            href="/admin/costs"
            className="flex items-center gap-3 p-4 border-2 border-black hover:bg-[#D4E815]/60 transition-colors group"
          >
            <DollarSign className="w-5 h-5 text-black" />
            <div>
              <p className="text-sm font-bold uppercase text-black">Cost Analysis</p>
              <p className="text-xs text-black/60">Detailed cost breakdown</p>
            </div>
          </a>
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-3 p-4 border-2 border-black hover:bg-[#D4E815]/60 transition-colors group"
          >
            <Activity className="w-5 h-5 text-black" />
            <div>
              <p className="text-sm font-bold uppercase text-black">Main App</p>
              <p className="text-xs text-black/60">Open CrewCast Studio</p>
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
