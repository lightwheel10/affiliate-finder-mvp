'use client';

/**
 * =============================================================================
 * SETTINGS PAGE
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE (January 8th, 2026):
 * ------------------------------------------------
 * Updated all components to match the neo-brutalist design system:
 *   - Sharp edges (no rounded corners)
 *   - Bold borders (border-2 to border-4 with black)
 *   - Offset shadows (shadow-[Xpx_Xpx_0px_0px_#000000])
 *   - Yellow accent color (#ffbf23)
 *   - Font-black uppercase typography
 *   - Dark mode support
 * 
 * ARCHITECTURE (January 3rd, 2026):
 * -----------------------------------------
 * This page is now part of the (dashboard) route group. The layout handles:
 *   - AuthGuard (authentication + onboarding check)
 *   - ErrorBoundary (error handling)
 *   - Sidebar (navigation - persists across page navigation)
 *   - Main container with ml-64 margin
 * 
 * This page only renders the content: header + main content area.
 * 
 * =============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUser } from '@stackframe/stack';
import { PricingModal } from '../../components/PricingModal';
import { AddCardModal } from '../../components/AddCardModal';
import { Modal } from '../../components/Modal';
import { useNeonUser } from '../../hooks/useNeonUser';
import { useSubscription } from '../../hooks/useSubscription';
import { 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Mail, 
  Zap,
  Clock,
  AlertTriangle,
  Calendar,
  Check,
  Loader2,
  Plus,
  XCircle,
  FileText,
  ExternalLink,
  Download
} from 'lucide-react';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

type SettingsTab = 'profile' | 'plan' | 'notifications' | 'security';

// =============================================================================
// SETTINGS PAGE - January 3rd, 2026
// 
// Layout now handles: AuthGuard, ErrorBoundary, and Sidebar.
// This component only renders the header and main content area.
// =============================================================================
export default function SettingsPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const user = useUser();
  const { userId } = useNeonUser();
  const { subscription, isLoading: subscriptionLoading, isTrialing, daysLeftInTrial, refetch: refetchSubscription, cancelSubscription, resumeSubscription } = useSubscription(userId);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Tabs - Translated (January 9th, 2026)
  const tabs = [
    { id: 'profile', label: t.dashboard.settings.tabs.profile.label, icon: <User size={16} />, description: t.dashboard.settings.tabs.profile.description },
    { id: 'plan', label: t.dashboard.settings.tabs.plan.label, icon: <CreditCard size={16} />, description: t.dashboard.settings.tabs.plan.description },
    { id: 'notifications', label: t.dashboard.settings.tabs.notifications.label, icon: <Bell size={16} />, description: t.dashboard.settings.tabs.notifications.description },
    { id: 'security', label: t.dashboard.settings.tabs.security.label, icon: <Shield size={16} />, description: t.dashboard.settings.tabs.security.description },
  ];

  // ==========================================================================
  // RENDER - January 8th, 2026
  // 
  // NEO-BRUTALIST DESIGN:
  // - Header: h-16 with border-b-4 and uppercase font-black title
  // - Left navigation: Sharp-edged tabs with yellow active state
  // - Right panel: Sharp edges with border-2 and offset shadow
  // 
  // Note: The outer container with Sidebar is now handled by the layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b-4 border-black dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wide">{t.dashboard.settings.pageTitle}</h1>
        </div>
      </header>

        {/* Main Content - NEO-BRUTALIST (Updated January 8th, 2026) */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-8rem)]">
            
            {/* Left Panel - Navigation - NEO-BRUTALIST */}
            <div className="w-full md:w-64 shrink-0">
              <div className="sticky top-24 space-y-1">
                <h3 className="px-3 text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Account</h3>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000]"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white border-2 border-transparent"
                    )}
                  >
                    <span className={cn(
                      "shrink-0",
                      activeTab === tab.id ? "text-black" : "text-gray-400 group-hover:text-gray-600"
                    )}>
                      {tab.icon}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {activeTab === tab.id && (
                      <span className="w-2 h-2 bg-black" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel - Content - NEO-BRUTALIST */}
            <div className="flex-1 min-w-0 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] overflow-hidden">
              <div className="h-full overflow-y-auto p-6 lg:p-8">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm text-gray-500 mb-8">
                    {tabs.find(t => t.id === activeTab)?.description}
                  </p>

                  {activeTab === 'profile' && <ProfileSettings user={user} />}
                  {activeTab === 'plan' && (
                    <PlanSettings 
                      subscription={subscription}
                      isLoading={subscriptionLoading}
                      isTrialing={isTrialing}
                      daysLeftInTrial={daysLeftInTrial}
                      onUpgrade={() => setIsPricingModalOpen(true)}
                      onAddCard={() => setIsAddCardModalOpen(true)}
                      onCancelPlan={() => setIsCancelModalOpen(true)}
                      userId={userId}
                    />
                  )}
                  {activeTab === 'notifications' && <NotificationSettings />}
                  {activeTab === 'security' && <SecuritySettings user={user} />}
                </div>
              </div>
            </div>

          </div>
        </div>
      
      {/* Pricing Modal - Pass subscription context for plan changes */}
      {/* Updated December 2025 to support in-app plan upgrades/downgrades */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        userId={userId}
        currentPlan={subscription?.plan || null}
        currentBillingInterval={subscription?.billing_interval || null}
        isTrialing={isTrialing}
        onSuccess={() => {
          // Refetch subscription data after successful plan change
          refetchSubscription();
        }}
      />

      {userId && user?.primaryEmail && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          userId={userId}
          userEmail={user.primaryEmail}
          onSuccess={() => {
            refetchSubscription();
            setIsAddCardModalOpen(false);
          }}
        />
      )}

      {/* Cancel Plan Confirmation Modal - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={subscription?.cancel_at_period_end ? "Resume Subscription" : "Cancel Subscription"}
        width="max-w-md"
      >
        <div className="space-y-4">
          {subscription?.cancel_at_period_end ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Would you like to resume your subscription? Your plan will continue as normal and you'll be billed at the next billing cycle.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
                >
                  Keep Canceled
                </button>
                <button
                  onClick={async () => {
                    setIsCanceling(true);
                    await resumeSubscription();
                    await refetchSubscription();
                    setIsCanceling(false);
                    setIsCancelModalOpen(false);
                  }}
                  disabled={isCanceling}
                  className="px-4 py-2 text-xs font-black text-black bg-[#ffbf23] hover:bg-yellow-400 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase"
                >
                  {isCanceling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Resume Subscription
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-800 dark:text-red-300">Are you sure you want to cancel?</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      You'll lose access to premium features at the end of your current billing period.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Your subscription will remain active until the end of your current billing period. You can resume anytime before then.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={async () => {
                    setIsCanceling(true);
                    await cancelSubscription();
                    await refetchSubscription();
                    setIsCanceling(false);
                    setIsCancelModalOpen(false);
                  }}
                  disabled={isCanceling}
                  className="px-4 py-2 text-xs font-black text-white bg-red-500 hover:bg-red-600 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase"
                >
                  {isCanceling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  Cancel Subscription
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

// =============================================================================
// PROFILE SETTINGS - NEO-BRUTALIST (Updated January 8th, 2026)
// 
// Design updates:
// - Square avatar with bold border
// - Sharp-edged input fields
// - Neo-brutalist Edit Profile button
// =============================================================================
function ProfileSettings({ user }: { user: any }) {
  const userName = user?.displayName || 'User';
  const userEmail = user?.primaryEmail || '';
  
  return (
    <div className="space-y-6">
      {/* Avatar Section - NEO-BRUTALIST */}
      <div className="flex items-center gap-6 pb-6 border-b-2 border-gray-200 dark:border-gray-700">
        <div className="relative">
          <img 
            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${userName}&background=0f172a&color=fff&size=128`}
            alt="Profile" 
            className="w-20 h-20 border-4 border-black dark:border-gray-600 object-cover"
          />
          <button 
            className="absolute bottom-0 right-0 p-1.5 bg-[#ffbf23] border-2 border-black text-black hover:bg-yellow-400 transition-colors"
          >
            <User size={14} />
          </button>
        </div>
        <div>
          <h3 className="font-black text-gray-900 dark:text-white">Profile Photo</h3>
          <p className="text-xs text-gray-500 mt-1">Update your profile picture in account settings.</p>
        </div>
      </div>

      {/* User Info Display - NEO-BRUTALIST */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Full Name</label>
          <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium">
            {userName}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
            <div className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium">
              {userEmail}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 flex justify-end">
        <button 
          onClick={() => user?.update({})}
          className="px-5 py-2.5 bg-[#ffbf23] text-black text-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}

interface PlanSettingsProps {
  subscription: any;
  isLoading: boolean;
  isTrialing: boolean;
  daysLeftInTrial: number | null;
  onUpgrade: () => void;
  onAddCard: () => void;
  onCancelPlan: () => void;
  userId: number | null; // Added December 2025 for invoice fetching
}

// =============================================================================
// INVOICE TYPES
// Added December 2025 to display invoice history from Stripe
// Updated January 8th, 2026 for neo-brutalist design
// =============================================================================
interface Invoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
}

function PlanSettings({ subscription, isLoading, isTrialing, daysLeftInTrial, onUpgrade, onAddCard, onCancelPlan, userId }: PlanSettingsProps) {
  // =========================================================================
  // INVOICE STATE & FETCHING
  // Added December 2025 to display invoice history from Stripe
  // =========================================================================
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!userId) return;
    
    setInvoicesLoading(true);
    setInvoicesError(null);
    
    try {
      const response = await fetch(`/api/stripe/invoices?userId=${userId}`);
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch invoices');
      }
      
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error('[PlanSettings] Error fetching invoices:', err);
      setInvoicesError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  }, [userId]);

  // Fetch invoices when component mounts or userId changes
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Format currency amount (cents to display)
  const formatAmount = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    const currencySymbol = currency === 'eur' ? '€' : currency === 'usd' ? '$' : currency.toUpperCase() + ' ';
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  // Format date from Unix timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get status badge styling for invoices - NEO-BRUTALIST (Updated January 8th, 2026)
  const getInvoiceStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { label: 'PAID', bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
      case 'open':
        return { label: 'OPEN', bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
      case 'draft':
        return { label: 'DRAFT', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
      case 'void':
        return { label: 'VOID', bg: 'bg-red-500', text: 'text-white', border: 'border-black' };
      case 'uncollectible':
        return { label: 'UNCOLLECTIBLE', bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
      default:
        return { label: status?.toUpperCase() || 'UNKNOWN', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Format plan name for display
  const getPlanDisplayName = (plan: string) => {
    const names: Record<string, string> = {
      'free_trial': 'Free Trial',
      'pro': 'Pro',
      'business': 'Business',
      'enterprise': 'Enterprise',
    };
    return names[plan] || plan;
  };

  // Get status badge color - NEO-BRUTALIST (Updated January 8th, 2026)
  const getStatusBadge = () => {
    if (subscription?.cancel_at_period_end) {
      return { label: 'CANCELLED', bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
    }
    if (isTrialing) {
      return { label: 'TRIAL', bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
    }
    if (subscription?.status === 'active') {
      return { label: 'ACTIVE', bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
    }
    return { label: 'ACTIVE', bg: 'bg-[#ffbf23]', text: 'text-black', border: 'border-black' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="space-y-8">
      {/* Current Plan - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div className={cn(
        "p-4 border-2 space-y-4",
        isTrialing ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" : "bg-[#ffbf23]/10 border-[#ffbf23]"
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 dark:text-white uppercase">
                {subscription ? getPlanDisplayName(subscription.plan) : 'No Plan'}
              </span>
              {subscription && (
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border-2",
                  statusBadge.bg, statusBadge.text, statusBadge.border
                )}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            
            {/* Trial info */}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-bold">
                <Clock size={12} />
                <span>
                  {daysLeftInTrial === 0 
                    ? 'Trial ends today' 
                    : `${daysLeftInTrial} day${daysLeftInTrial !== 1 ? 's' : ''} left in trial`
                  }
                </span>
              </div>
            )}

            {/* Billing info */}
            {subscription && !isTrialing && subscription.nextBillingDate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                <Calendar size={12} />
                <span>Next billing: {subscription.nextBillingDate}</span>
              </div>
            )}

            {/* Price */}
            {subscription && subscription.formattedPrice && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {subscription.formattedPrice}
                {subscription.billing_interval === 'annual' && ' (billed annually)'}
              </p>
            )}
          </div>
          
          {/* Upgrade/Manage button - NEO-BRUTALIST */}
          {/* Updated January 8th, 2026 - contextual button text with neo-brutalist styling */}
          {(!subscription || subscription.plan !== 'enterprise') && (
            <button 
              onClick={onUpgrade}
              className="px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-1.5"
            >
              <Zap size={14} />
              {!subscription 
                ? 'Choose Plan' 
                : isTrialing 
                  ? 'Upgrade Plan' 
                  : 'Manage Plan'
              }
            </button>
          )}
        </div>

        {/* Trial warning - NEO-BRUTALIST */}
        {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-black">Your trial is ending soon</p>
              <p className="text-amber-700 dark:text-amber-400">Add a payment method to continue using all features.</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Payment Method</h3>
        {subscription?.card_last4 ? (
          <div className="p-4 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <CreditCard size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {subscription.card_brand || 'Card'} •••• {subscription.card_last4}
                </p>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <p className="text-xs text-gray-500">
                    Expires {String(subscription.card_exp_month).padStart(2, '0')}/{String(subscription.card_exp_year).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={onAddCard}
              className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white uppercase"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-1">No payment method added</p>
            <p className="text-xs text-gray-500 mb-4">
              {isTrialing 
                ? 'Add a card to continue using all features after your trial ends.'
                : 'Add a payment method to upgrade your plan.'
              }
            </p>
            <button 
              onClick={onAddCard}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Plus size={14} />
              Add Payment Method
            </button>
          </div>
        )}
      </div>

      {/* Invoices - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Invoice History</h3>
        
        {/* Loading State */}
        {invoicesLoading && (
          <div className="p-8 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500 font-medium">Loading invoices...</span>
          </div>
        )}

        {/* Error State */}
        {!invoicesLoading && invoicesError && (
          <div className="p-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/20 flex items-center gap-3">
            <XCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{invoicesError}</p>
            <button 
              onClick={fetchInvoices}
              className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 uppercase"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!invoicesLoading && !invoicesError && invoices.length === 0 && (
          <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-bold">No invoices yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Invoices will appear here after your first billing cycle
            </p>
          </div>
        )}

        {/* Invoice List - NEO-BRUTALIST */}
        {!invoicesLoading && !invoicesError && invoices.length > 0 && (
          <div className="border-2 border-black dark:border-gray-600 overflow-hidden">
            {/* Table Header */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b-2 border-black dark:border-gray-600 grid grid-cols-12 gap-4 text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              <div className="col-span-3">Invoice</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            
            {/* Invoice Rows */}
            {invoices.map((invoice) => {
              const statusBadge = getInvoiceStatusBadge(invoice.status);
              return (
                <div 
                  key={invoice.id}
                  className="px-4 py-3 border-b-2 border-gray-200 dark:border-gray-700 last:border-b-0 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Invoice Number & Description */}
                  <div className="col-span-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {invoice.number || 'Draft'}
                    </p>
                    {invoice.description && (
                      <p className="text-xs text-gray-500 truncate" title={invoice.description}>
                        {invoice.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Date */}
                  <div className="col-span-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {formatDate(invoice.created)}
                    </p>
                  </div>
                  
                  {/* Amount */}
                  <div className="col-span-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatAmount(invoice.amount_due, invoice.currency)}
                    </p>
                  </div>
                  
                  {/* Status */}
                  <div className="col-span-2">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border",
                      statusBadge.bg, statusBadge.text, statusBadge.border
                    )}>
                      {statusBadge.label}
                    </span>
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="View invoice"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {invoice.invoice_pdf && (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Download PDF"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Plan Section - NEO-BRUTALIST (Updated January 8th, 2026) */}
      {subscription && subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Cancel Subscription</h3>
          <p className="text-xs text-gray-500 mb-4">
            If you cancel, you'll still have access to your plan until the end of your current billing period.
          </p>
          <button 
            onClick={onCancelPlan}
            className="px-4 py-2 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-500 border-2 border-red-400 hover:border-red-600 transition-all uppercase"
          >
            Cancel Plan
          </button>
        </div>
      )}

      {/* Cancellation pending notice - NEO-BRUTALIST */}
      {subscription?.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-orange-800 dark:text-orange-300 uppercase">Subscription Canceling</h4>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  Your plan will be canceled at the end of the current billing period. 
                  You'll continue to have access until then.
                </p>
                <button 
                  onClick={onCancelPlan}
                  className="mt-3 px-3 py-1.5 text-xs font-bold text-orange-700 hover:text-white bg-white hover:bg-orange-500 border-2 border-orange-400 hover:border-orange-600 transition-all uppercase"
                >
                  Resume Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NOTIFICATION SETTINGS - NEO-BRUTALIST (Updated January 8th, 2026)
// 
// Design updates:
// - Sharp-edged notification rows
// - Bold checkboxes with yellow accent
// - Bold typography
// =============================================================================
function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Email Notifications</h3>
        
        {[
          { id: 'emailMatches', label: 'New affiliate matches found', desc: 'Get notified when we find new high-potential affiliates.' },
          { id: 'emailReports', label: 'Weekly performance report', desc: 'Summary of your campaign performance and outreach stats.' },
          { id: 'emailUpdates', label: 'Product updates', desc: 'News about new features and improvements.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors -mx-3 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700">
            <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-5 w-5 border-2 border-black dark:border-gray-600 accent-[#ffbf23] cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-900 dark:text-white block cursor-pointer">{item.label}</label>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">App Notifications</h3>
        {[
          { id: 'appReplies', label: 'Successful outreach replies', desc: 'Notify me when an affiliate replies to my email.' },
          { id: 'appReminders', label: 'Task reminders', desc: 'Remind me about follow-ups and scheduled tasks.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors -mx-3 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700">
             <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-5 w-5 border-2 border-black dark:border-gray-600 accent-[#ffbf23] cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-900 dark:text-white block cursor-pointer">{item.label}</label>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SECURITY SETTINGS - NEO-BRUTALIST (Updated January 8th, 2026)
// 
// Design updates:
// - Sharp-edged buttons
// - Bold typography
// - Neo-brutalist Danger Zone section
// =============================================================================
function SecuritySettings({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Password & Security</h3>
        <p className="text-sm text-gray-500">
          Manage your password and security settings through your account portal.
        </p>
        <div className="pt-2">
          <button 
            className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors uppercase"
          >
            Manage Security Settings
          </button>
        </div>
      </div>
      
      <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        <h3 className="text-sm font-black text-red-600 uppercase tracking-wide">Danger Zone</h3>
        <p className="text-xs text-gray-500">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-400 text-sm font-bold hover:bg-red-500 hover:text-white hover:border-red-600 transition-all uppercase">
          Delete Account
        </button>
      </div>
    </div>
  );
}
