'use client';

/**
 * Admin Settings Page
 * i18n Migration: January 10th, 2026 - Phase 3: Toast Notifications
 * 
 * All toast notifications have been migrated to use the translation dictionary.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { 
  Bell,
  DollarSign,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Alert {
  id: number;
  alert_type: string;
  threshold: number;
  is_active: boolean;
  currentCost: number;
  isTriggered: boolean;
  percentUsed: number;
}

interface CurrentCosts {
  daily_cost: number;
  weekly_cost: number;
  monthly_cost: number;
}

const ALERT_TYPES = [
  { key: 'daily_cost', label: 'Daily Cost Limit', description: 'Alert when daily API costs exceed threshold' },
  { key: 'weekly_cost', label: 'Weekly Cost Limit', description: 'Alert when weekly API costs exceed threshold' },
  { key: 'monthly_cost', label: 'Monthly Cost Limit', description: 'Alert when monthly API costs exceed threshold' },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentCosts, setCurrentCosts] = useState<CurrentCosts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Record<string, string>>({
    daily_cost: '',
    weekly_cost: '',
    monthly_cost: '',
  });
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({
    daily_cost: true,
    weekly_cost: true,
    monthly_cost: true,
  });

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/admin/alerts');
      
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      const data = await res.json();
      setAlerts(data.alerts || []);
      setCurrentCosts(data.currentCosts || null);

      // Populate form with existing values
      const newThresholds: Record<string, string> = { ...thresholds };
      const newActiveStates: Record<string, boolean> = { ...activeStates };
      
      data.alerts?.forEach((alert: Alert) => {
        newThresholds[alert.alert_type] = String(alert.threshold);
        newActiveStates[alert.alert_type] = alert.is_active;
      });
      
      setThresholds(newThresholds);
      setActiveStates(newActiveStates);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleSave = async (alertType: string) => {
    const threshold = parseFloat(thresholds[alertType]);
    if (isNaN(threshold) || threshold < 0) {
      // January 5th, 2026: Replaced alert() with Sonner toast
      // i18n: January 10th, 2026
      toast.warning(t.toasts.warning.invalidThreshold);
      return;
    }

    setSavingType(alertType);
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType,
          threshold,
          isActive: activeStates[alertType],
        }),
      });

      if (res.ok) {
        await fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to save alert:', err);
    } finally {
      setSavingType(null);
    }
  };

  const handleDelete = async (alertType: string) => {
    const alert = alerts.find(a => a.alert_type === alertType);
    if (!alert) return;

    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      await fetch(`/api/admin/alerts?id=${alert.id}`, { method: 'DELETE' });
      setThresholds(prev => ({ ...prev, [alertType]: '' }));
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const getAlertStatus = (alertType: string) => {
    const alert = alerts.find(a => a.alert_type === alertType);
    return alert || null;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-[#23272B] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage cost alerts and thresholds
        </p>
      </div>

      {/* Current Costs Summary */}
      {currentCosts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
            <p className="text-xs text-slate-400 mb-1">Today&apos;s Cost</p>
            <p className="text-xl font-bold text-white">${Number(currentCosts.daily_cost || 0).toFixed(2)}</p>
          </div>
          <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
            <p className="text-xs text-slate-400 mb-1">This Week&apos;s Cost</p>
            <p className="text-xl font-bold text-white">${Number(currentCosts.weekly_cost || 0).toFixed(2)}</p>
          </div>
          <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-4">
            <p className="text-xs text-slate-400 mb-1">This Month&apos;s Cost</p>
            <p className="text-xl font-bold text-white">${Number(currentCosts.monthly_cost || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Alert Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[#D4E815]" />
          <h2 className="text-lg font-semibold text-white">Cost Alerts</h2>
        </div>

        {ALERT_TYPES.map(({ key, label, description }) => {
          const alertStatus = getAlertStatus(key);
          const currentCost = currentCosts?.[key as keyof CurrentCosts] || 0;
          const threshold = parseFloat(thresholds[key]) || 0;
          const isTriggered = alertStatus?.isTriggered || (threshold > 0 && currentCost >= threshold);
          const percentUsed = threshold > 0 ? (currentCost / threshold) * 100 : 0;

          return (
            <div
              key={key}
              className={cn(
                'bg-[#23272B] rounded-xl border p-6',
                isTriggered && threshold > 0 ? 'border-red-500/50' : 'border-[#2E3338]'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{label}</h3>
                    {alertStatus && (
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        alertStatus.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'
                      )}>
                        {alertStatus.is_active ? 'Active' : 'Disabled'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{description}</p>
                </div>
                {isTriggered && threshold > 0 && (
                  <div className="flex items-center gap-1 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Threshold Exceeded</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {threshold > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">
                      ${Number(currentCost).toFixed(2)} / ${threshold.toFixed(2)}
                    </span>
                    <span className={cn(
                      'font-medium',
                      percentUsed >= 100 ? 'text-red-400' : 
                      percentUsed >= 80 ? 'text-yellow-400' : 'text-green-400'
                    )}>
                      {percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#1A1D21] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        percentUsed >= 100 ? 'bg-red-500' : 
                        percentUsed >= 80 ? 'bg-yellow-500' : 'bg-[#D4E815]'
                      )}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={thresholds[key]}
                      onChange={(e) => setThresholds(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Set threshold..."
                      className="w-full pl-10 pr-4 py-2 bg-[#1A1D21] border border-[#2E3338] rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
                    />
                  </div>
                </div>
                
                {/* Active toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-400">Active</span>
                  <div
                    onClick={() => setActiveStates(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                      activeStates[key] ? 'bg-[#D4E815]' : 'bg-[#2E3338]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        activeStates[key] ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </div>
                </label>

                <button
                  onClick={() => handleSave(key)}
                  disabled={savingType === key}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-sm font-medium rounded-lg hover:bg-[#c5d913] transition-colors disabled:opacity-50"
                >
                  {savingType === key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>

                {alertStatus && (
                  <button
                    onClick={() => handleDelete(key)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Email notification note */}
              <p className="text-xs text-slate-500 mt-3">
                {/* TODO: Email notifications coming soon */}
                Alerts are displayed on the dashboard when thresholds are exceeded.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
