'use client';

// =============================================================================
// PRICING MODAL COMPONENT
// 
// Created: December 2025
// Author: Development Team
//
// PURPOSE:
// Displays available subscription plans and allows users to:
// - View plan features and pricing
// - Upgrade to a higher plan (immediate, prorated charge)
// - Downgrade to a lower plan (takes effect next billing cycle)
// - Change billing interval (monthly ↔ annual)
// - End trial early and start billing (for trial users)
//
// USAGE:
// <PricingModal 
//   isOpen={true}
//   onClose={() => {}}
//   userId={123}                    // Required for API calls
//   currentPlan="pro"               // User's current plan (null if none)
//   currentBillingInterval="monthly" // Current interval
//   isTrialing={true}               // Is user on trial?
//   onSuccess={() => refetch()}     // Called after successful change
// />
//
// SECURITY:
// - All plan changes go through authenticated API routes
// - Server validates all inputs
// - This component only handles UI
// =============================================================================

import React, { useState } from 'react';
import { Check, Zap, Loader2, Star, ShieldCheck, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { CURRENCY_SYMBOL, PLAN_PRICING } from '@/lib/stripe-client';

// =============================================================================
// TYPES
// =============================================================================

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Subscription context - pass these to enable plan changes
  userId?: number | null;
  currentPlan?: string | null;        // 'pro', 'business', 'enterprise', or null
  currentBillingInterval?: string | null; // 'monthly', 'annual', or null
  isTrialing?: boolean;
  onSuccess?: () => void;             // Called after successful plan change
}

interface PlanConfig {
  name: string;
  id: string;                         // 'pro', 'business', 'enterprise'
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  features: readonly string[];        // readonly to match PLAN_PRICING type
  popular: boolean;
}

// =============================================================================
// PLAN CONFIGURATION
// Prices in EUR - must match Stripe configuration
// =============================================================================

const PLANS: PlanConfig[] = [
  {
    name: 'Pro',
    id: 'pro',
    description: 'Perfect for solo founders & small teams starting their affiliate journey.',
    monthlyPrice: PLAN_PRICING.pro.monthlyPrice,
    annualPrice: PLAN_PRICING.pro.annualPrice,
    features: PLAN_PRICING.pro.features,
    popular: false,
  },
  {
    name: 'Business',
    id: 'business',
    description: 'For growing brands that need to scale their outreach volume.',
    monthlyPrice: PLAN_PRICING.business.monthlyPrice,
    annualPrice: PLAN_PRICING.business.annualPrice,
    features: PLAN_PRICING.business.features,
    popular: true,
  },
  {
    name: 'Enterprise',
    id: 'enterprise',
    description: 'Custom solutions for large organizations with specific needs.',
    monthlyPrice: null,  // Custom pricing
    annualPrice: null,
    features: PLAN_PRICING.enterprise.features,
    popular: false,
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const PricingModal: React.FC<PricingModalProps> = ({ 
  isOpen, 
  onClose,
  userId = null,
  currentPlan = null,
  currentBillingInterval = null,
  isTrialing = false,
  onSuccess,
}) => {
  // =========================================================================
  // STATE
  // =========================================================================
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(
    (currentBillingInterval as 'monthly' | 'annual') || 'annual'
  );
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrialEndOption, setShowTrialEndOption] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] = useState<{ plan: string; interval: string } | null>(null);

  // =========================================================================
  // HELPERS
  // =========================================================================
  
  // Determine plan hierarchy for upgrade/downgrade detection
  const getPlanLevel = (plan: string): number => {
    const levels: Record<string, number> = { 'pro': 1, 'business': 2, 'enterprise': 3 };
    return levels[plan] || 0;
  };

  // Check if selecting this plan would be an upgrade, downgrade, or same
  const getChangeType = (newPlan: string, newInterval: string): 'upgrade' | 'downgrade' | 'interval_change' | 'same' | 'new' => {
    if (!currentPlan) return 'new';
    
    const currentLevel = getPlanLevel(currentPlan);
    const newLevel = getPlanLevel(newPlan);
    
    if (newPlan === currentPlan && newInterval === currentBillingInterval) {
      return 'same';
    }
    
    if (newLevel > currentLevel) return 'upgrade';
    if (newLevel < currentLevel) return 'downgrade';
    
    // Same plan, different interval
    return 'interval_change';
  };

  // Get the CTA button text based on context
  // Updated December 2025: Trial users can "Buy Now" their current plan
  const getButtonText = (plan: PlanConfig): string => {
    if (plan.id === 'enterprise') {
      return 'Contact Sales';
    }

    const changeType = getChangeType(plan.id, billingInterval);
    
    switch (changeType) {
      case 'same':
        // Trial users can buy their current plan immediately
        // Non-trial users see "Current Plan" (disabled)
        return isTrialing ? 'Buy Now' : 'Current Plan';
      case 'upgrade':
        return 'Upgrade Now';
      case 'downgrade':
        return 'Switch Plan';
      case 'interval_change':
        return billingInterval === 'annual' ? 'Switch to Annual' : 'Switch to Monthly';
      case 'new':
      default:
        return 'Get Started';
    }
  };

  // Check if button should be disabled
  // Updated December 2025: Trial users can click their current plan to "Buy Now"
  const isButtonDisabled = (plan: PlanConfig): boolean => {
    if (isLoading) return true;
    if (plan.id === 'enterprise') return false; // Enterprise is always clickable (opens contact)
    
    const changeType = getChangeType(plan.id, billingInterval);
    
    // If user is on trial and viewing their current plan, allow "Buy Now"
    // Only disable for non-trial users viewing their current plan
    if (changeType === 'same') {
      return !isTrialing; // Enable for trial users, disable for active subscribers
    }
    
    return false;
  };

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handlePlanSelect = async (plan: PlanConfig) => {
    // Enterprise plan - open contact (no API call)
    if (plan.id === 'enterprise') {
      // TODO: Open contact form or redirect to contact page
      window.open('mailto:sales@crewcaststudio.com?subject=Enterprise%20Plan%20Inquiry', '_blank');
      return;
    }

    // Validation
    if (!userId) {
      setError('Please sign in to change your plan.');
      return;
    }

    const changeType = getChangeType(plan.id, billingInterval);
    
    // For non-trial users, don't allow selecting current plan (no-op)
    // For trial users, 'same' means "Buy Now" - end trial and start billing
    if (changeType === 'same' && !isTrialing) {
      return;
    }

    // If user is on trial, show the trial end option for:
    // - 'same': Buy current plan now (end trial)
    // - 'upgrade': Move to higher plan
    // - 'interval_change': Switch billing interval
    if (isTrialing && (changeType === 'same' || changeType === 'upgrade' || changeType === 'interval_change')) {
      setPendingPlanChange({ plan: plan.id, interval: billingInterval });
      setShowTrialEndOption(true);
      return;
    }

    // Proceed with plan change
    await executePlanChange(plan.id, billingInterval, false);
  };

  const executePlanChange = async (newPlan: string, newInterval: string, endTrialNow: boolean) => {
    setIsLoading(newPlan);
    setError(null);
    setShowTrialEndOption(false);
    setPendingPlanChange(null);

    try {
      const response = await fetch('/api/stripe/change-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          newPlan,
          newBillingInterval: newInterval,
          endTrialNow,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to change plan');
      }

      // Success!
      console.log('[PricingModal] Plan changed successfully:', data);
      
      // Dispatch custom event to notify ALL useSubscription instances to refetch
      // This ensures Sidebar, Settings, and any other component stays in sync
      // Added December 2025
      window.dispatchEvent(new CustomEvent('subscription-updated'));
      
      // Call success callback to refresh data (for the local component)
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();

    } catch (err) {
      console.error('[PricingModal] Error changing plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to change plan. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleTrialEndDecision = (endNow: boolean) => {
    if (!pendingPlanChange) return;
    executePlanChange(pendingPlanChange.plan, pendingPlanChange.interval, endNow);
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" width="max-w-5xl">
      <div className="py-6 px-2">
        {/* ================================================================= */}
        {/* HEADER */}
        {/* ================================================================= */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl text-slate-900 font-bold tracking-tight mb-4">
            {currentPlan ? 'Manage your plan' : 'Supercharge your'} <span className="text-[#1A1D21]">{currentPlan ? '' : 'affiliate growth'}</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-8">
            {currentPlan 
              ? 'Upgrade to unlock more features or adjust your billing preferences.'
              : 'Stop wasting hours searching manually. Get instant access to thousands of high-converting affiliates tailored to your niche.'
            }
          </p>

          {/* Current Plan Badge */}
          {currentPlan && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full mb-6">
              <span className="text-sm text-slate-600">Current plan:</span>
              <span className="text-sm font-bold text-slate-900 capitalize">{currentPlan}</span>
              {isTrialing && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  <Clock size={10} />
                  Trial
                </span>
              )}
            </div>
          )}

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-xl relative">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200",
                billingInterval === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2",
                billingInterval === 'annual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Annual
              <span className="bg-[#D4E815]/20 text-[#1A1D21] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">Save 20%</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ERROR MESSAGE */}
        {/* ================================================================= */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TRIAL END OPTION MODAL */}
        {/* ================================================================= */}
        {showTrialEndOption && pendingPlanChange && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Clock size={20} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-900 mb-1">You&apos;re currently on a trial</h4>
                <p className="text-xs text-blue-700 mb-4">
                  Would you like to end your trial now and start billing immediately, or keep your trial and just change the plan?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleTrialEndDecision(false)}
                    disabled={isLoading !== null}
                    className="px-4 py-2 bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-300 hover:bg-blue-50 transition-all"
                  >
                    Keep Trial, Change Plan
                  </button>
                  <button
                    onClick={() => handleTrialEndDecision(true)}
                    disabled={isLoading !== null}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                  >
                    End Trial &amp; Start Billing
                  </button>
                  <button
                    onClick={() => {
                      setShowTrialEndOption(false);
                      setPendingPlanChange(null);
                    }}
                    className="px-4 py-2 text-slate-500 text-xs font-medium hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PRICING GRID */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const isPopular = plan.popular;
            const isCurrentPlan = currentPlan === plan.id && currentBillingInterval === billingInterval;
            const changeType = getChangeType(plan.id, billingInterval);
            const buttonDisabled = isButtonDisabled(plan);
            const buttonText = getButtonText(plan);

            return (
              <div 
                key={plan.id}
                className={cn(
                  "relative rounded-2xl bg-white flex flex-col transition-all duration-200",
                  isPopular 
                    ? "border-2 border-[#D4E815] shadow-xl shadow-[#D4E815]/20 z-10" 
                    : "border border-slate-200 shadow-lg",
                  isCurrentPlan && "ring-2 ring-blue-400 ring-offset-2"
                )}
              >
                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-4">
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Popular Badge */}
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <div className="bg-[#1A1D21] text-[#D4E815] text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                      <Star size={12} fill="currentColor" />
                      Best Value
                    </div>
                  </div>
                )}

                <div className="p-6 lg:p-8 flex-1 flex flex-col">
                  {/* Plan Name & Description */}
                  <div className="mb-6">
                    <h3 className={cn("text-xl font-bold mb-2", isPopular ? "text-[#1A1D21]" : "text-slate-900")}>
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[40px]">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {price === null ? (
                        <span className="text-4xl font-bold text-slate-900">Custom</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-slate-900">{CURRENCY_SYMBOL}{price}</span>
                          <span className="text-slate-400 font-medium">/mo</span>
                        </>
                      )}
                    </div>
                    {price !== null && billingInterval === 'annual' && (
                      <p className="text-xs text-[#1A1D21] font-medium mt-1">Billed {CURRENCY_SYMBOL}{price * 12} yearly</p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    disabled={buttonDisabled}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-bold mb-8 transition-all duration-200 shadow-sm flex items-center justify-center gap-2",
                      isCurrentPlan
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : isPopular 
                          ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] hover:shadow-[#D4E815]/25" 
                          : "bg-[#1A1D21] text-white hover:bg-[#2a2f35]",
                      buttonDisabled && !isCurrentPlan && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isLoading === plan.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        {buttonText}
                        {isPopular && !isCurrentPlan && changeType !== 'same' && (
                          <Zap size={14} fill="currentColor" className="text-[#1A1D21]" />
                        )}
                      </>
                    )}
                  </button>

                  {/* Change Type Indicator */}
                  {currentPlan && changeType !== 'same' && changeType !== 'new' && plan.id !== 'enterprise' && (
                    <div className={cn(
                      "mb-4 px-3 py-2 rounded-lg text-xs text-center",
                      changeType === 'upgrade' && "bg-green-50 text-green-700",
                      changeType === 'downgrade' && "bg-orange-50 text-orange-700",
                      changeType === 'interval_change' && "bg-blue-50 text-blue-700"
                    )}>
                      {changeType === 'upgrade' && '⬆️ Immediate upgrade with proration'}
                      {changeType === 'downgrade' && '⬇️ Takes effect next billing cycle'}
                      {changeType === 'interval_change' && '🔄 Billing change with proration'}
                    </div>
                  )}

                  {/* Features List */}
                  <div className="space-y-3 flex-1">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">What&apos;s included:</p>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                          isPopular ? "bg-[#1A1D21] text-[#D4E815]" : "bg-slate-100 text-slate-600"
                        )}>
                          <Check size={10} strokeWidth={4} />
                        </div>
                        <span className="text-sm text-slate-600 leading-tight">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* FOOTER */}
        {/* ================================================================= */}
        <div className="mt-12 text-center border-t border-slate-100 pt-8">
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#D4E815]" />
              <span>Secure SSL Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#1A1D21]" />
              <span>Cancel Anytime</span>
            </div>
          </div>
          
          {/* Downgrade Info */}
          {currentPlan && (
            <p className="mt-4 text-xs text-slate-400">
              Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
