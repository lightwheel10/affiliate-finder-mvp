'use client';

import React from 'react';
import { Loader2, Check, X, Sparkles, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StripeCardInput, useStripeCardSetup } from './StripeCardInput';
import { CURRENCY_SYMBOL } from '@/lib/stripe-client';

// =============================================================================
// STEP 7 CARD FORM COMPONENT
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
  const { confirmSetup, isProcessing, error: setupError } = useStripeCardSetup();

  // Combine errors
  const displayError = stripeError || setupError;

  return (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <div className="w-5 h-5 bg-[#1A1D21] rounded-md flex items-center justify-center text-[#D4E815] shadow-md shadow-[#1A1D21]/10">
            <Lock size={10} />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900">Secure Checkout</span>
        </div>
        
        <h1 className="text-lg md:text-xl text-slate-900 font-bold tracking-tight mb-1">
          Start your 3-day free trial
        </h1>
        <p className="text-slate-500 text-sm">
          Enter your card details • You won&apos;t be charged today
        </p>
      </div>

      {/* Selected Plan Summary */}
      <div className="mb-6 p-4 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Selected Plan</p>
            <p className="text-base font-bold text-[#1A1D21]">{selectedPlanName}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#1A1D21]">
              {CURRENCY_SYMBOL}{selectedPlanPrice}
              <span className="text-sm font-normal text-slate-500">/mo</span>
            </p>
            {billingInterval === 'annual' && (
              <p className="text-[10px] text-slate-500">Billed annually</p>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#D4E815]/30 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-slate-600">
            First charge: <span className="font-semibold">3 days from now</span>
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

      {/* Error Display */}
      {displayError && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
          <AlertCircle size={14} className="shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Discount Code Section */}
      <div className="mt-4 space-y-1.5">
        <label className="text-xs font-semibold text-slate-700">Discount Code (Optional)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                onDiscountCodeChange(e.target.value.toUpperCase());
                onResetDiscount();
              }}
              placeholder="SAVE20"
              disabled={discountApplied || isLoading}
              className={cn(
                "w-full px-3 py-2.5 bg-white border rounded-lg text-sm text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 uppercase font-mono",
                discountApplied 
                  ? "border-green-300 bg-green-50 text-green-700"
                  : discountError
                  ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20"
              )}
            />
            {discountApplied && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check size={16} className="text-green-600" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onApplyDiscount}
            disabled={!discountCode.trim() || discountApplied || isApplyingDiscount || isLoading}
            className={cn(
              "px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              discountApplied
                ? "bg-green-100 text-green-700 border border-green-300 cursor-default"
                : !discountCode.trim() || isApplyingDiscount
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow"
            )}
          >
            {isApplyingDiscount ? (
              <Loader2 size={14} className="animate-spin" />
            ) : discountApplied ? (
              'Applied'
            ) : (
              'Apply'
            )}
          </button>
        </div>
        {discountError && (
          <p className="text-[10px] text-red-500 flex items-center gap-1">
            <X size={10} />
            {discountError}
          </p>
        )}
        {discountApplied && discountAmount > 0 && (
          <div className="flex items-center gap-1.5 p-2 bg-green-50 border border-green-200 rounded-lg">
            <Sparkles size={12} className="text-green-600" />
            <p className="text-[10px] text-green-700 font-semibold">
              {discountAmount}% discount applied! You&apos;ll save {CURRENCY_SYMBOL}{((selectedPlanPrice || 0) * discountAmount / 100).toFixed(2)}/mo
            </p>
          </div>
        )}
      </div>

      {/* Submit Button for Step 7 */}
      <div className="pt-5 mt-auto">
        <button
          type="button"
          onClick={() => onSubmit(confirmSetup)}
          disabled={!isCardReady || !cardholderName.trim() || isLoading || isProcessing}
          className={cn(
            "w-full py-3 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2",
            (!isCardReady || !cardholderName.trim() || isLoading || isProcessing)
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913]"
          )}
        >
          {(isLoading || isProcessing) ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock size={14} />
              Start 3-Day Free Trial
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step7CardForm;
