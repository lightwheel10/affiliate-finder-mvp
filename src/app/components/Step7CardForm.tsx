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
      {/* Header - NEO-BRUTALIST (January 9th, 2026) - Translated (January 9th, 2026) */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Lock size={10} />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white uppercase">{t.onboarding.step7.secureCheckout}</span>
        </div>
        
        <h1 className="text-lg md:text-xl text-gray-900 dark:text-white font-black tracking-tight mb-1">
          {t.onboarding.step7.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t.onboarding.step7.subtitle}
        </p>
      </div>

      {/* Selected Plan Summary - NEO-BRUTALIST (January 9th, 2026) - Translated (January 9th, 2026) */}
      <div className="mb-6 p-4 bg-[#ffbf23]/10 border-2 border-[#ffbf23]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide">{t.onboarding.step7.selectedPlan}</p>
            <p className="text-base font-black text-gray-900 dark:text-white">{selectedPlanName}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-900 dark:text-white">
              {CURRENCY_SYMBOL}{selectedPlanPrice}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{t.onboarding.step7.perMonth}</span>
            </p>
            {billingInterval === 'annual' && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t.onboarding.step7.billedAnnually}</p>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t-2 border-[#ffbf23]/30 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">
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

      {/* Error Display - NEO-BRUTALIST (January 9th, 2026) */}
      {displayError && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border-2 border-red-500 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span className="font-medium">{displayError}</span>
        </div>
      )}

      {/* Discount Code Section - NEO-BRUTALIST (January 9th, 2026) - Translated (January 9th, 2026) */}
      <div className="mt-4 space-y-1.5">
        <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.onboarding.step7.discountLabel}</label>
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
                "w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 text-sm text-gray-900 dark:text-white focus:outline-none transition-all placeholder:text-gray-400 uppercase font-mono",
                discountApplied 
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : discountError
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:border-[#ffbf23]"
              )}
            />
            {discountApplied && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check size={16} className="text-green-600" />
              </div>
            )}
          </div>
          {/* Apply Button - NEO-BRUTALIST (January 9th, 2026) */}
          <button
            type="button"
            onClick={onApplyDiscount}
            disabled={!discountCode.trim() || discountApplied || isApplyingDiscount || isLoading}
            className={cn(
              "px-4 py-2.5 border-2 text-sm font-black transition-all whitespace-nowrap uppercase",
              discountApplied
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500 cursor-default"
                : !discountCode.trim() || isApplyingDiscount
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                : "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
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
          <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
            <X size={10} />
            {discountError}
          </p>
        )}
        {/* Discount Applied Message - NEO-BRUTALIST (January 9th, 2026) - Translated (January 9th, 2026) */}
        {discountApplied && discountAmount > 0 && (
          <div className="flex items-center gap-1.5 p-2 bg-green-50 dark:bg-green-900/30 border-2 border-green-500">
            <Sparkles size={12} className="text-green-600" />
            <p className="text-[10px] text-green-700 dark:text-green-400 font-bold">
              {discountAmount}{t.onboarding.step7.discountApplied} {CURRENCY_SYMBOL}{((selectedPlanPrice || 0) * discountAmount / 100).toFixed(2)}/mo
            </p>
          </div>
        )}
      </div>

      {/* Submit Button - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="pt-5 mt-auto">
        <button
          type="button"
          onClick={() => onSubmit(confirmSetup)}
          disabled={!isCardReady || !cardholderName.trim() || isLoading || isProcessing}
          className={cn(
            "w-full py-3 font-black text-sm transition-all duration-200 flex items-center justify-center gap-2 uppercase border-2",
            (!isCardReady || !cardholderName.trim() || isLoading || isProcessing)
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
              : "bg-[#ffbf23] text-black border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]"
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
      </div>
    </div>
  );
};

export default Step7CardForm;
