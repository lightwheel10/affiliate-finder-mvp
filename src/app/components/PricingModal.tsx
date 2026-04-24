'use client';

/**
 * =============================================================================
 * PRICING MODAL COMPONENT — SMOOVER REFRESH
 * =============================================================================
 *
 * Created: December 2025
 * Updated: April 25th, 2026 — smoover visual refresh
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 * Credits Refresh Fix: January 14th, 2026 - Dispatch 'credits-updated' event
 *
 * CURRENT DESIGN LANGUAGE ("smoover"):
 * - Rounded-2xl card shell with hairline #e6ebf1 border + soft drop shadow.
 * - Popular plan: border-[#ffbf23] + shadow-yellow-glow (no more border-4
 *   brutalist offset shadow).
 * - Archivo display title (font-display) for the modal h1 + plan names.
 * - Rounded-full CTA pattern matching sign-in + onboarding primary buttons:
 *   shadow-yellow-glow-sm + hover:bg-[#e5ac20] + hover:-translate-y-px.
 * - All 5 CTA states (disabled / current+trialing / trialing / popular /
 *   default) preserved with smoover treatment; vivid red / amber / green /
 *   blue status colours retained for error / change-type / current-plan
 *   signals.
 * - Billing toggle + "Most Popular" ribbon + "Save 20%" chip all match the
 *   onboarding Step 6 pricing card patterns exactly.
 *
 * PURPOSE:
 * Displays available subscription plans and allows users to:
 * - View plan features and pricing
 * - Upgrade to a higher plan (immediate, prorated charge)
 * - Downgrade to a lower plan (takes effect next billing cycle)
 * - Change billing interval (monthly ↔ annual)
 * - End trial early and start billing (for trial users)
 *
 * SECURITY:
 * - All plan changes go through authenticated API routes
 * - Server validates all inputs
 * - This component only handles UI
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * =============================================================================
 */

import React, { useState } from 'react';
import { Check, Zap, Loader2, Star, ShieldCheck, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { CURRENCY_SYMBOL, PLAN_PRICING } from '@/lib/stripe-client';
import { useLanguage } from '@/contexts/LanguageContext';

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
    name: PLAN_PRICING.pro.name,
    id: 'pro',
    description: PLAN_PRICING.pro.description,
    monthlyPrice: PLAN_PRICING.pro.monthlyPrice,
    annualPrice: PLAN_PRICING.pro.annualPrice,
    features: PLAN_PRICING.pro.features,
    popular: PLAN_PRICING.pro.popular,
  },
  {
    name: PLAN_PRICING.business.name,
    id: 'business',
    description: PLAN_PRICING.business.description,
    monthlyPrice: PLAN_PRICING.business.monthlyPrice,
    annualPrice: PLAN_PRICING.business.annualPrice,
    features: PLAN_PRICING.business.features,
    popular: PLAN_PRICING.business.popular,
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
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  // =========================================================================
  // STATE
  // =========================================================================
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(
    (currentBillingInterval as 'monthly' | 'annual') || 'monthly'
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
  // Updated January 10th, 2026: i18n migration
  // Updated February 2026: Removed Enterprise plan from modal
  const getButtonText = (plan: PlanConfig): string => {
    const changeType = getChangeType(plan.id, billingInterval);
    
    switch (changeType) {
      case 'same':
        // Trial users can buy their current plan immediately
        // Non-trial users see "Current Plan" (disabled)
        return isTrialing ? t.pricingModal.buyNow : t.pricingModal.currentPlan;
      case 'upgrade':
        return t.pricingModal.upgradeNow;
      case 'downgrade':
        return t.pricingModal.switchPlan;
      case 'interval_change':
        return billingInterval === 'annual' ? t.pricingModal.switchToAnnual : t.pricingModal.switchToMonthly;
      case 'new':
      default:
        return t.pricingModal.getStarted;
    }
  };

  // Check if button should be disabled
  // Updated December 2025: Trial users can click their current plan to "Buy Now"
  // Updated February 2026: Removed Enterprise plan from modal
  const isButtonDisabled = (plan: PlanConfig): boolean => {
    if (isLoading) return true;
    
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
    // Validation
    if (!userId) {
      setError(t.pricingModal.signInRequired);
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
      // =========================================================================
      // DISPATCH EVENTS TO REFRESH UI STATE
      // 
      // We dispatch two events to ensure all hooks refetch their data:
      // 
      // 1. 'subscription-updated' - Listened by useSubscription hook
      //    - Refreshes plan, status, billing interval in Sidebar & Settings
      //    - Added December 2025
      // 
      // 2. 'credits-updated' - Listened by useCredits hook
      //    - Refreshes credit balances after plan change
      //    - For upgrades: Backend resets credits to new plan limits immediately
      //    - For downgrades: Credits stay same (change takes effect at period end)
      //    - Added January 14th, 2026 - Fix for credits not updating after upgrade
      // =========================================================================
      window.dispatchEvent(new CustomEvent('subscription-updated'));
      window.dispatchEvent(new CustomEvent('credits-updated'));
      
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
        {/* HEADER — smoover refresh (April 25th, 2026) */}
        {/* ================================================================= */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-display text-[#0f172a] dark:text-white font-bold tracking-tight mb-4">
            {currentPlan ? t.pricingModal.manageYourPlan : t.pricingModal.superchargeYour} <span className="text-[#0f172a] dark:text-white">{currentPlan ? '' : t.pricingModal.affiliateGrowth}</span>
          </h1>
          <p className="text-[#8898aa] dark:text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            {currentPlan
              ? t.pricingModal.manageSubtitle
              : t.pricingModal.newSubtitle
            }
          </p>

          {/* Current Plan Badge — smoover refresh (April 25th, 2026) */}
          {currentPlan && (
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 rounded-full">
                <span className="text-sm text-[#8898aa] dark:text-gray-400 font-medium">{t.pricingModal.currentPlan}:</span>
                <span className="text-sm font-semibold text-[#0f172a] dark:text-white">{currentPlan}</span>
                {isTrialing && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 font-semibold">
                    <Clock size={10} />
                    {t.pricingModal.trial}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Billing Toggle — smoover refresh (April 25th, 2026). Matches onboarding Step 6 pricing toggle. */}
          <div className="flex justify-center">
            <div className="inline-flex items-center bg-[#f6f9fc] dark:bg-gray-800 p-1 rounded-full relative">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn(
                "px-6 py-2 text-sm font-semibold rounded-full transition-all duration-200",
                billingInterval === 'monthly' ? "bg-white dark:bg-gray-900 text-[#0f172a] dark:text-white shadow-soft-sm" : "text-[#8898aa] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200"
              )}
            >
              {t.pricingModal.monthly}
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={cn(
                "px-6 py-2 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2",
                billingInterval === 'annual' ? "bg-white dark:bg-gray-900 text-[#0f172a] dark:text-white shadow-soft-sm" : "text-[#8898aa] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200"
              )}
            >
              {t.pricingModal.annual}
              <span className="bg-[#ffbf23]/20 text-[#1A1D21] dark:text-[#ffbf23] text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider">{t.pricingModal.save20}</span>
            </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ERROR MESSAGE - NEO-BRUTALIST (Updated January 8th, 2026) */}
        {/* ================================================================= */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700 font-semibold text-lg"
            >
              ×
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TRIAL END OPTION - NEO-BRUTALIST (Updated January 8th, 2026) */}
        {/* Updated January 10th, 2026 - i18n migration */}
        {/* ================================================================= */}
        {showTrialEndOption && pendingPlanChange && (
          <div className="mb-6 p-4 bg-[#ffbf23]/10 dark:bg-[#ffbf23]/10 border border-[#ffbf23] rounded-xl">
            <div className="flex items-start gap-3">
              <Clock size={20} className="text-[#ffbf23] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[#0f172a] dark:text-white mb-1">{t.pricingModal.trialTitle}</h4>
                <p className="text-xs text-[#425466] dark:text-gray-400 mb-4">
                  {t.pricingModal.trialMessage}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleTrialEndDecision(true)}
                    disabled={isLoading !== null}
                    className="px-4 py-2 bg-[#ffbf23] text-[#1A1D21] text-xs font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all"
                  >
                    {t.pricingModal.endTrialStartBilling}
                  </button>
                  <button
                    onClick={() => {
                      setShowTrialEndOption(false);
                      setPendingPlanChange(null);
                    }}
                    className="px-4 py-2 text-[#425466] text-xs font-semibold hover:text-[#0f172a] dark:hover:text-gray-300 transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PRICING GRID - NEO-BRUTALIST (Updated January 8th, 2026) */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl mx-auto">
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
                  "relative bg-white dark:bg-[#0f0f0f] rounded-2xl flex flex-col transition-all duration-200",
                  isPopular
                    ? "border border-[#ffbf23] shadow-yellow-glow z-10"
                    : "border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm",
                  isCurrentPlan && "ring-2 ring-blue-500"
                )}
              >
                {/* Current Plan Badge — smoover refresh (April 25th, 2026) */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-4">
                    <span className="bg-blue-500 text-white text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider shadow-soft-sm">
                      {t.pricingModal.currentPlan}
                    </span>
                  </div>
                )}

                {/* Popular Badge — smoover refresh (April 25th, 2026). Matches onboarding Step 6 "Most Popular" ribbon. */}
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <div className="bg-[#1A1D21] text-[#ffbf23] text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full shadow-soft-sm flex items-center gap-1.5">
                      <Star size={12} fill="currentColor" />
                      {t.pricingModal.mostPopular}
                    </div>
                  </div>
                )}

                <div className="p-6 lg:p-8 flex-1 flex flex-col">
                  {/* Plan Name & Description — smoover refresh (April 25th, 2026). h3 gets font-display; conditional popular/default color unified to text-[#0f172a] since smoover uses the same near-black token for both. */}
                  <div className="mb-6">
                    <h3 className="text-xl font-display font-bold mb-2 tracking-tight text-[#0f172a] dark:text-white">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-[#8898aa] dark:text-gray-400 leading-relaxed min-h-[40px]">{plan.description}</p>
                  </div>

                  {/* Price — smoover refresh (April 25th, 2026). font-black on big number -> font-bold; "per month" + billed-yearly note migrated to smoover tokens (matches onboarding Step 6 pricing cards). */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {price === null ? (
                        <span className="text-4xl font-bold text-[#0f172a] dark:text-white">{t.pricingModal.custom}</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-[#0f172a] dark:text-white">{CURRENCY_SYMBOL}{price}</span>
                          <span className="text-[#8898aa] dark:text-gray-500 font-medium">{t.pricingModal.perMonth}</span>
                        </>
                      )}
                    </div>
                    {price !== null && billingInterval === 'annual' && (
                      <p className="text-xs text-[#1A1D21] dark:text-[#ffbf23] font-medium mt-1">{t.pricingModal.billedYearly} {CURRENCY_SYMBOL}{price * 12}</p>
                    )}
                  </div>

                  {/* CTA Button — smoover refresh (April 25th, 2026). 5 visible states preserved: disabled (current, not trialing), primary yellow (current + trialing), soft yellow (trialing + other plan), primary yellow (popular), secondary dark (default). */}
                  {/* February 2026: Trial users on their current plan see a bold "Buy Now" button.
                      Other plans (upgrade) get a lighter secondary style so "Buy Now" stands out. */}
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    disabled={buttonDisabled}
                    className={cn(
                      "w-full py-3 text-sm font-semibold mb-8 rounded-full transition-all duration-200 flex items-center justify-center gap-2",
                      isCurrentPlan && !isTrialing
                        ? "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] border border-[#e6ebf1] dark:border-gray-700 cursor-not-allowed"
                        : isCurrentPlan && isTrialing
                          ? "bg-[#ffbf23] text-[#1A1D21] shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px"
                          : isTrialing
                            ? "bg-[#ffbf23]/10 text-[#1A1D21] dark:text-[#ffbf23] border border-[#ffbf23]/30 hover:bg-[#ffbf23]/20 hover:border-[#ffbf23]"
                            : isPopular
                              ? "bg-[#ffbf23] text-[#1A1D21] shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px"
                              : "bg-[#1A1D21] text-white hover:bg-[#0f172a]",
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

                  {/* Change Type Indicator — smoover refresh (April 25th, 2026). border-2 -> border + rounded-lg; softer bg-50 tints; vivid signal borders retained. */}
                  {currentPlan && changeType !== 'same' && changeType !== 'new' && (
                    <div className={cn(
                      "mb-4 px-3 py-2 text-xs text-center border rounded-lg font-semibold",
                      changeType === 'upgrade' && "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500",
                      changeType === 'downgrade' && "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-500",
                      changeType === 'interval_change' && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-500"
                    )}>
                      {changeType === 'upgrade' && t.pricingModal.immediateUpgrade}
                      {changeType === 'downgrade' && t.pricingModal.takesEffectNextCycle}
                      {changeType === 'interval_change' && t.pricingModal.billingChangeProration}
                    </div>
                  )}

                  {/* Features List — smoover refresh (April 25th, 2026). Eyebrow softened; check bullets become rounded-full; popular variant keeps black-on-yellow emphasis using #1A1D21 token. */}
                  <div className="space-y-3 flex-1">
                    <p className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider mb-3">{t.pricingModal.whatsIncluded}</p>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                          isPopular ? "bg-[#1A1D21] text-[#ffbf23]" : "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 border border-[#e6ebf1] dark:border-gray-700"
                        )}>
                          <Check size={10} strokeWidth={4} />
                        </div>
                        <span className="text-sm text-[#425466] dark:text-gray-400 leading-tight">
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
        {/* FOOTER - NEO-BRUTALIST (Updated January 8th, 2026) */}
        {/* Updated January 10th, 2026 - i18n migration */}
        {/* ================================================================= */}
        <div className="mt-12 text-center border-t border-[#e6ebf1] dark:border-gray-700 pt-8">
          <div className="flex items-center justify-center gap-6 text-sm text-[#8898aa] dark:text-gray-400 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#ffbf23]" />
              <span>{t.pricingModal.securePayment}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#0f172a] dark:text-white" />
              <span>{t.pricingModal.cancelAnytime}</span>
            </div>
          </div>

          {/* Downgrade Info */}
          {currentPlan && (
            <p className="mt-4 text-xs text-[#8898aa] dark:text-gray-500">
              {t.pricingModal.upgradeDowngradeNote}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
