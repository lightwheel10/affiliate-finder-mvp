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

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Settings page updated to match bold borders and high-contrast styling.
// Polish pass (softer shadows + cleaner spacing) - January 15th, 2026

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
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-black/10 border-2 border-black" />
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
        <h1 className="text-3xl font-black uppercase text-black">Settings</h1>
        <p className="text-sm text-black/70 mt-1">
          Manage cost alerts and thresholds
        </p>
      </div>

      {/* Current Costs Summary */}
      {currentCosts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
            <p className="text-xs font-bold uppercase text-black/70 mb-1">Today&apos;s Cost</p>
            <p className="text-xl font-black text-black">${Number(currentCosts.daily_cost || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
            <p className="text-xs font-bold uppercase text-black/70 mb-1">This Week&apos;s Cost</p>
            <p className="text-xl font-black text-black">${Number(currentCosts.weekly_cost || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white border-4 border-black p-4 shadow-[3px_3px_0px_0px_#111827]">
            <p className="text-xs font-bold uppercase text-black/70 mb-1">This Month&apos;s Cost</p>
            <p className="text-xl font-black text-black">${Number(currentCosts.monthly_cost || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Alert Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-black" />
          <h2 className="text-lg font-black uppercase text-black">Cost Alerts</h2>
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
                'bg-white border-4 border-black p-6 shadow-[3px_3px_0px_0px_#111827]',
                isTriggered && threshold > 0 ? 'bg-red-100' : 'bg-white'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase text-black">{label}</h3>
                    {alertStatus && (
                      <span className={cn(
                        'px-2 py-0.5 border-2 border-black text-xs font-bold uppercase',
                        alertStatus.is_active ? 'bg-[#D4E815] text-black' : 'bg-white text-black'
                      )}>
                        {alertStatus.is_active ? 'Active' : 'Disabled'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-black/60 mt-1">{description}</p>
                </div>
                {isTriggered && threshold > 0 && (
                  <div className="flex items-center gap-1 text-black">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Threshold Exceeded</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {threshold > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-black/70 font-bold uppercase">
                      ${Number(currentCost).toFixed(2)} / ${threshold.toFixed(2)}
                    </span>
                    <span className={cn(
                      'font-bold',
                      percentUsed >= 100 ? 'text-black' : 
                      percentUsed >= 80 ? 'text-black' : 'text-black'
                    )}>
                      {percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-black/10 border-2 border-black overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        percentUsed >= 100 ? 'bg-black' : 
                        percentUsed >= 80 ? 'bg-black' : 'bg-[#D4E815]'
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
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={thresholds[key]}
                      onChange={(e) => setThresholds(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Set threshold..."
                      className="w-full pl-10 pr-4 py-2 bg-white border-2 border-black text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
                
                {/* Active control (checkbox for clearer state) - January 15th, 2026 */}
                {/* Keep fixed width so Active/Inactive doesn't shift layout - Jan 15, 2026 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeStates[key]}
                    onChange={() => setActiveStates(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="h-4 w-4 appearance-none border-2 border-black bg-white checked:bg-[#D4E815] checked:shadow-[2px_2px_0px_0px_#111827] transition-colors"
                  />
                  <span
                    className={cn(
                      'text-xs font-bold uppercase inline-flex w-16 justify-start',
                      activeStates[key] ? 'text-black' : 'text-black/50'
                    )}
                  >
                    {activeStates[key] ? 'Active' : 'Inactive'}
                  </span>
                </label>

                <button
                  onClick={() => handleSave(key)}
                  disabled={savingType === key}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4E815] border-2 border-black text-black text-sm font-bold uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-50"
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
                    className="p-2 border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Email notification note */}
              <p className="text-xs text-black/60 mt-3">
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
