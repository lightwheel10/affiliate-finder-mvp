'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AuthGuard } from '../components/AuthGuard';
import { cn } from '@/lib/utils';
import { useUser } from '@stackframe/stack';
import { PricingModal } from '../components/PricingModal';
import { AddCardModal } from '../components/AddCardModal';
import { Modal } from '../components/Modal';
import { useNeonUser } from '../hooks/useNeonUser';
import { useSubscription } from '../hooks/useSubscription';
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
  XCircle
} from 'lucide-react';

type SettingsTab = 'profile' | 'plan' | 'notifications' | 'security';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const user = useUser();
  const { userId } = useNeonUser();
  const { subscription, isLoading: subscriptionLoading, isTrialing, daysLeftInTrial, refetch: refetchSubscription, cancelSubscription, resumeSubscription } = useSubscription(userId);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={16} />, description: 'Manage your personal information' },
    { id: 'plan', label: 'Plan & Billing', icon: <CreditCard size={16} />, description: 'Manage your subscription and billing' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} />, description: 'Configure how you want to be notified' },
    { id: 'security', label: 'Security', icon: <Shield size={16} />, description: 'Protect your account' },
  ];

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-52">
        {/* Header */}
        <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
           <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
            </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-8rem)]">
            
            {/* Left Panel - Navigation */}
            <div className="w-full md:w-64 shrink-0">
              <div className="sticky top-24 space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account</h3>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-[#D4E815]/10 text-[#1A1D21] shadow-sm ring-1 ring-[#D4E815]/30"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className={cn(
                      "shrink-0",
                      activeTab === tab.id ? "text-[#1A1D21]" : "text-slate-400 group-hover:text-slate-600"
                    )}>
                      {tab.icon}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {activeTab === tab.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4E815]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-full overflow-y-auto p-6 lg:p-8">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm text-slate-500 mb-8">
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
                    />
                  )}
                  {activeTab === 'notifications' && <NotificationSettings />}
                  {activeTab === 'security' && <SecuritySettings user={user} />}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      
      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
      />

      {userId && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          userId={userId}
          onSuccess={() => {
            refetchSubscription();
            setIsAddCardModalOpen(false);
          }}
        />
      )}

      {/* Cancel Plan Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={subscription?.cancel_at_period_end ? "Resume Subscription" : "Cancel Subscription"}
        width="max-w-md"
      >
        <div className="space-y-4">
          {subscription?.cancel_at_period_end ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Would you like to resume your subscription? Your plan will continue as normal and you'll be billed at the next billing cycle.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1A1D21] hover:bg-[#2a2f35] border border-transparent rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
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
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Are you sure you want to cancel?</p>
                    <p className="text-xs text-red-700 mt-1">
                      You'll lose access to premium features at the end of your current billing period.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Your subscription will remain active until the end of your current billing period. You can resume anytime before then.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border border-transparent rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
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
    </div>
  );
}

function ProfileSettings({ user }: { user: any }) {
  const userName = user?.displayName || 'User';
  const userEmail = user?.primaryEmail || '';
  
  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
        <div className="relative">
          <img 
            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${userName}&background=0f172a&color=fff&size=128`}
            alt="Profile" 
            className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-sm object-cover"
          />
          <button 
            className="absolute bottom-0 right-0 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 text-slate-600"
          >
            <User size={14} />
          </button>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Profile Photo</h3>
          <p className="text-xs text-slate-500 mt-1">Update your profile picture in account settings.</p>
        </div>
      </div>

      {/* User Info Display */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Full Name</label>
          <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
            {userName}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <div className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              {userEmail}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button 
          onClick={() => user?.update({})}
          className="px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-sm font-semibold rounded-lg hover:bg-[#c5d913] transition-colors shadow-sm hover:shadow"
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
}

function PlanSettings({ subscription, isLoading, isTrialing, daysLeftInTrial, onUpgrade, onAddCard, onCancelPlan }: PlanSettingsProps) {
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

  // Get status badge color
  const getStatusBadge = () => {
    if (subscription?.cancel_at_period_end) {
      return { label: 'Cancelled', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
    }
    if (isTrialing) {
      return { label: 'Trial', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    }
    if (subscription?.status === 'active') {
      return { label: 'Active', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    }
    return { label: 'Active', bg: 'bg-[#D4E815]/20', text: 'text-[#1A1D21]', border: 'border-[#D4E815]/40' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className={cn(
        "p-4 rounded-xl border space-y-4",
        isTrialing ? "bg-blue-50/50 border-blue-200" : "bg-[#D4E815]/10 border-[#D4E815]/30"
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#1A1D21]">
                {subscription ? getPlanDisplayName(subscription.plan) : 'No Plan'}
              </span>
              {subscription && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                  statusBadge.bg, statusBadge.text, statusBadge.border
                )}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            
            {/* Trial info */}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700">
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
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar size={12} />
                <span>Next billing: {subscription.nextBillingDate}</span>
              </div>
            )}

            {/* Price */}
            {subscription && subscription.formattedPrice && (
              <p className="text-xs text-slate-600">
                {subscription.formattedPrice}
                {subscription.billing_interval === 'annual' && ' (billed annually)'}
              </p>
            )}
          </div>
          
          {/* Upgrade button - only show if not on enterprise */}
          {(!subscription || subscription.plan !== 'enterprise') && (
            <button 
              onClick={onUpgrade}
              className="px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-[#D4E815]/20 transition-all flex items-center gap-1.5"
            >
              <Zap size={14} />
              {subscription ? 'Change Plan' : 'Choose Plan'}
            </button>
          )}
        </div>

        {/* Trial warning */}
        {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold">Your trial is ending soon</p>
              <p className="text-amber-700">Add a payment method to continue using all features.</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-4">Payment Method</h3>
        {subscription?.card_last4 ? (
          <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-slate-100 rounded flex items-center justify-center">
                <CreditCard size={16} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {subscription.card_brand || 'Card'} •••• {subscription.card_last4}
                </p>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <p className="text-xs text-slate-500">
                    Expires {String(subscription.card_exp_month).padStart(2, '0')}/{String(subscription.card_exp_year).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={onAddCard}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 font-medium mb-1">No payment method added</p>
            <p className="text-xs text-slate-500 mb-4">
              {isTrialing 
                ? 'Add a card to continue using all features after your trial ends.'
                : 'Add a payment method to upgrade your plan.'
              }
            </p>
            <button 
              onClick={onAddCard}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-xs font-bold rounded-lg hover:bg-[#c5d913] transition-colors shadow-sm"
            >
              <Plus size={14} />
              Add Payment Method
            </button>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-4">Invoice History</h3>
        <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center">
          <p className="text-sm text-slate-500">No invoices yet</p>
        </div>
      </div>

      {/* Cancel Plan Section - only show if user has an active subscription */}
      {subscription && subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Cancel Subscription</h3>
          <p className="text-xs text-slate-500 mb-4">
            If you cancel, you'll still have access to your plan until the end of your current billing period.
          </p>
          <button 
            onClick={onCancelPlan}
            className="px-4 py-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
          >
            Cancel Plan
          </button>
        </div>
      )}

      {/* Cancellation pending notice */}
      {subscription?.cancel_at_period_end && (
        <div className="pt-6 border-t border-slate-100">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-orange-800">Subscription Canceling</h4>
                <p className="text-xs text-orange-700 mt-1">
                  Your plan will be canceled at the end of the current billing period. 
                  You'll continue to have access until then.
                </p>
                <button 
                  onClick={onCancelPlan}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800 bg-white border border-orange-300 rounded-lg transition-all"
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

function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Email Notifications</h3>
        
        {[
          { id: 'emailMatches', label: 'New affiliate matches found', desc: 'Get notified when we find new high-potential affiliates.' },
          { id: 'emailReports', label: 'Weekly performance report', desc: 'Summary of your campaign performance and outreach stats.' },
          { id: 'emailUpdates', label: 'Product updates', desc: 'News about new features and improvements.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors -mx-3">
            <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-4 w-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block cursor-pointer">{item.label}</label>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-100" />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">App Notifications</h3>
        {[
          { id: 'appReplies', label: 'Successful outreach replies', desc: 'Notify me when an affiliate replies to my email.' },
          { id: 'appReminders', label: 'Task reminders', desc: 'Remind me about follow-ups and scheduled tasks.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors -mx-3">
             <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-4 w-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block cursor-pointer">{item.label}</label>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecuritySettings({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Password & Security</h3>
        <p className="text-sm text-slate-500">
          Manage your password and security settings through your account portal.
        </p>
        <div className="pt-2">
          <button 
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            Manage Security Settings
          </button>
        </div>
      </div>
      
      <div className="h-px bg-slate-100" />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-red-600">Danger Zone</h3>
        <p className="text-xs text-slate-500">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}
