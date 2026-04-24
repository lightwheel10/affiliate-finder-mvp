'use client';

import React from 'react';
import { Loader2, Check, X, Sparkles, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StripeCardInput, useStripeCardSetup } from './StripeCardInput';
import { CURRENCY_SYMBOL } from '@/lib/stripe-client';
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// STEP 7 CARD FORM COMPONENT - NEO-BRUTALIST
//
// Last Updated: January 9th, 2026
//
// NEO-BRUTALIST DESIGN UPDATE (January 9th, 2026):
// - Sharp edges on all containers (removed rounded-xl, rounded-lg)
// - Sharp edges on discount input and Apply button
// - Sharp submit button with offset shadow
// - Bold typography (font-black uppercase)
// - Dark mode support throughout
//
// This component is extracted from OnboardingScreen to fix a React re-rendering
// issue. When defined inside the parent component, the function was recreated 
// on every render, causing React to unmount/remount and lose input focus.
//
// By extracting it as a separate component, React can properly reconcile the
// component identity across renders.
// =============================================================================

interface Step7CardFormProps {
  // Plan info
  selectedPlanName: string;
  selectedPlanPrice: number;
  billingInterval: 'monthly' | 'annual';
  
  // Card state (managed by parent)
  cardholderName: string;
  onCardholderNameChange: (name: string) => void;
  isCardReady: boolean;
  onCardReadyChange: (ready: boolean) => void;
  stripeError: string | null;
  onStripeErrorChange: (error: string | null) => void;
  
  // Discount state (managed by parent)
  discountCode: string;
  onDiscountCodeChange: (code: string) => void;
  isApplyingDiscount: boolean;
  discountApplied: boolean;
  discountError: string;
  discountAmount: number;
  discountSummary?: string;
  onApplyDiscount: () => void;
  onResetDiscount: () => void;
  
  // Submit handler
  onSubmit: (confirmSetup: (clientSecret: string, name: string) => Promise<{ success: boolean; paymentMethodId?: string; error?: string }>) => void;
  
  // Loading state
  isLoading: boolean;
}

export const Step7CardForm: React.FC<Step7CardFormProps> = ({
  selectedPlanName,
  selectedPlanPrice,
  billingInterval,
  cardholderName,
  onCardholderNameChange,
  isCardReady,
  onCardReadyChange,
  stripeError,
  onStripeErrorChange,
  discountCode,
  onDiscountCodeChange,
  isApplyingDiscount,
  discountApplied,
  discountError,
  discountAmount,
  discountSummary,
  onApplyDiscount,
  onResetDiscount,
  onSubmit,
  isLoading,
}) => {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  const { confirmSetup, isProcessing, error: setupError } = useStripeCardSetup();

  // Combine errors
  const displayError = stripeError || setupError;

  return (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header — smoover refresh (April 24th, 2026). Lock-icon tile softened to rounded-md + hairline border. "Secure Checkout" adopts the smoover eyebrow pattern (text-xs font-semibold #8898aa uppercase tracking-wider). Hero uses font-display (Archivo). */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <div className="w-5 h-5 bg-[#1A1D21] dark:bg-[#1a1a1a] flex items-center justify-center text-[#ffbf23] rounded-md border border-[#e6ebf1] dark:border-gray-700">
            <Lock size={10} />
          </div>
          <span className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.onboarding.step7.secureCheckout}</span>
        </div>

        <h1 className="text-lg md:text-xl font-display text-[#0f172a] dark:text-white font-bold tracking-tight mb-1">
          {t.onboarding.step7.title}
        </h1>
        <p className="text-[#8898aa] dark:text-gray-400 text-sm">
          {t.onboarding.step7.subtitle}
        </p>
      </div>

      {/* Selected Plan Summary — smoover refresh (April 24th, 2026). Yellow-tinted card: border-2 -> border + rounded-xl. Internal eyebrow/label/price tokens migrate to smoover palette. Green status dot becomes rounded-full. */}
      <div className="mb-6 p-4 bg-[#ffbf23]/10 border border-[#ffbf23] rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.onboarding.step7.selectedPlan}</p>
            <p className="text-base font-semibold text-[#0f172a] dark:text-white">{selectedPlanName}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#0f172a] dark:text-white">
              {CURRENCY_SYMBOL}{selectedPlanPrice}
              <span className="text-sm font-normal text-[#8898aa] dark:text-gray-400">{t.onboarding.step7.perMonth}</span>
            </p>
            {billingInterval === 'annual' && (
              <p className="text-[10px] text-[#8898aa] dark:text-gray-400 font-medium">{t.onboarding.step7.billedAnnually}</p>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#ffbf23]/30 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-[#425466] dark:text-gray-400">
            {t.onboarding.step7.firstCharge}
          </span>
        </div>
      </div>

      {/* Stripe Card Input */}
      <StripeCardInput
        cardholderName={cardholderName}
        onCardholderNameChange={onCardholderNameChange}
        onCardReady={onCardReadyChange}
        onError={onStripeErrorChange}
        disabled={isLoading || isProcessing}
        showSecurityBadge={true}
      />

      {/* Error Display — smoover refresh (April 24th, 2026). Hairline + rounded-xl; red-500 signal color kept vivid for clarity. */}
      {displayError && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span className="font-medium">{displayError}</span>
        </div>
      )}

      {/* Discount Code Section — smoover refresh (April 24th, 2026). Input adopts hairline + rounded-xl + soft bg (matches Step 1 inputs). Apply button drops brutalist black border + 2px offset shadow for rounded-xl + shadow-yellow-glow-sm with subtle hover lift (matches Step 3's + button). Green applied-state + red error signals kept vivid. `uppercase` CSS on the input is retained — the onChange() forces toUpperCase() anyway, so this is just a display echo, not a logic change. */}
      <div className="mt-4 space-y-1.5">
        <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.onboarding.step7.discountLabel}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                onDiscountCodeChange(e.target.value.toUpperCase());
                onResetDiscount();
              }}
              placeholder={t.onboarding.step7.discountPlaceholder}
              disabled={discountApplied || isLoading}
              className={cn(
                "w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-[#1a1a1a] border rounded-xl text-sm text-[#0f172a] dark:text-white focus:outline-none transition-all placeholder-[#8898aa] uppercase font-mono",
                discountApplied
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : discountError
                  ? "border-red-500 focus:border-red-500"
                  : "border-[#e6ebf1] dark:border-gray-700 focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 focus:bg-white dark:focus:bg-[#1a1a1a]"
              )}
            />
            {discountApplied && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check size={16} className="text-green-600" />
              </div>
            )}
          </div>
          {/* Apply Button — smoover refresh (April 24th, 2026). Same pattern as Step 3/4 + buttons. */}
          <button
            type="button"
            onClick={onApplyDiscount}
            disabled={!discountCode.trim() || discountApplied || isApplyingDiscount || isLoading}
            className={cn(
              "px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap uppercase",
              discountApplied
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500 cursor-default"
                : !discountCode.trim() || isApplyingDiscount
                ? "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] border-[#e6ebf1] dark:border-gray-700 cursor-not-allowed"
                : "bg-[#ffbf23] text-[#1A1D21] border-transparent hover:bg-[#e5ac20] shadow-yellow-glow-sm hover:shadow-yellow-glow hover:-translate-y-px"
            )}
          >
            {isApplyingDiscount ? (
              <Loader2 size={14} className="animate-spin" />
            ) : discountApplied ? (
              t.onboarding.step7.applied
            ) : (
              t.onboarding.step7.apply
            )}
          </button>
        </div>
        {discountError && (
          <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
            <X size={10} />
            {discountError}
          </p>
        )}
        {/* Discount Applied Message — smoover refresh (April 24th, 2026). Hairline + rounded-xl; green signal kept vivid. */}
        {discountApplied && (
          <div className="flex items-center gap-1.5 p-2 bg-green-50 dark:bg-green-900/30 border border-green-500 rounded-xl">
            <Sparkles size={12} className="text-green-600" />
            <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold">
              {discountSummary || (
                discountAmount > 0
                  ? `${discountAmount}${t.onboarding.step7.discountApplied} ${CURRENCY_SYMBOL}${((selectedPlanPrice || 0) * discountAmount / 100).toFixed(2)}/mo`
                  : 'Discount code will be applied at checkout'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Submit Button — smoover refresh (April 24th, 2026). Money CTA drops brutalist border-black + 4px offset shadow; adopts rounded-full + shadow-yellow-glow-sm with subtle hover lift (matches the sign-in primary CTA exactly). font-black -> font-bold. `uppercase` retained to preserve existing label casing. Disabled state migrates to smoover gray tokens. */}
      <div className="pt-5 mt-auto">
        <button
          type="button"
          onClick={() => onSubmit(confirmSetup)}
          disabled={!isCardReady || !cardholderName.trim() || isLoading || isProcessing}
          className={cn(
            "w-full py-3 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 uppercase rounded-full",
            (!isCardReady || !cardholderName.trim() || isLoading || isProcessing)
              ? "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] border border-[#e6ebf1] dark:border-gray-700 cursor-not-allowed"
              : "bg-[#ffbf23] text-[#1A1D21] hover:bg-[#e5ac20] shadow-yellow-glow-sm hover:shadow-yellow-glow hover:-translate-y-px"
          )}
        >
          {(isLoading || isProcessing) ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t.onboarding.step7.processing}
            </>
          ) : (
            <>
              <Lock size={14} />
              {t.onboarding.step7.startTrial}
            </>
          )}
        </button>

        {/* Trust Messaging - Added January 24th, 2026 */}
        <p className="text-center text-[11px] text-[#8898aa] dark:text-gray-400 mt-3">
          {t.onboarding.step7.cancelAnytime}
        </p>
        <p className="text-center text-[10px] text-[#8898aa] dark:text-gray-500 mt-2">
          {t.onboarding.step7.secureFooter}
        </p>
      </div>
    </div>
  );
};

export default Step7CardForm;
