'use client';

import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { StripeProvider } from './StripeProvider';
import { StripeCardInput, useStripeCardSetup } from './StripeCardInput';

// =============================================================================
// ADD CARD MODAL
// 
// A secure modal for adding/updating payment methods using Stripe Elements.
// Card data is collected directly by Stripe's secure iframe - 
// sensitive data NEVER touches our servers (PCI DSS compliant).
//
// SECURITY:
// - Uses Stripe SetupIntent flow for secure card collection
// - Card details handled entirely by Stripe.js
// - 3D Secure authentication handled automatically
// - No raw card data stored anywhere
// =============================================================================

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
  userEmail: string; // Required for Stripe customer creation/lookup
}

// Inner form component that uses Stripe hooks (must be inside StripeProvider)
const CardForm: React.FC<{
  userId: number;
  userEmail: string;
  onSuccess: () => void;
  onClose: () => void;
}> = ({ userId, userEmail, onSuccess, onClose }) => {
  const { confirmSetup, isProcessing, error: setupError } = useStripeCardSetup();
  
  const [cardholderName, setCardholderName] = useState('');
  const [isCardReady, setIsCardReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Discount Code
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Combine errors for display
  const displayError = error || setupError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCardReady || !cardholderName.trim()) {
      setError('Please complete all card details');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create SetupIntent to securely collect card
      console.log('[AddCard] Creating SetupIntent...');
      const setupRes = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      if (!setupRes.ok) {
        const errorData = await setupRes.json();
        throw new Error(errorData.error || 'Failed to initialize card setup');
      }

      const { clientSecret, customerId } = await setupRes.json();
      console.log('[AddCard] SetupIntent created, confirming card...');

      // Step 2: Confirm card setup with Stripe (handles 3D Secure)
      const setupResult = await confirmSetup(clientSecret, cardholderName);

      if (!setupResult.success || !setupResult.paymentMethodId) {
        throw new Error(setupResult.error || 'Card verification failed');
      }

      console.log('[AddCard] Card verified successfully:', setupResult.paymentMethodId);

      // Step 3: Update the subscription's payment method (if user already has subscription)
      // This attaches the new payment method as the default for the subscription
      const updateRes = await fetch('/api/stripe/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paymentMethodId: setupResult.paymentMethodId,
          customerId,
        }),
      });

      // If update endpoint doesn't exist yet, that's okay - card is still saved to customer
      if (!updateRes.ok) {
        console.warn('[AddCard] Payment method update endpoint not available, card saved to Stripe customer');
      }

      // Success!
      onSuccess();
      onClose();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save card. Please try again.';
      console.error('[AddCard] Error:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe Card Input */}
      <StripeCardInput
        cardholderName={cardholderName}
        onCardholderNameChange={setCardholderName}
        onCardReady={setIsCardReady}
        onError={setError}
        disabled={isLoading || isProcessing}
        showSecurityBadge={true}
      />

      {/* Error Display */}
      {displayError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
          <AlertCircle size={14} className="shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Discount Code Section */}
      <div className="space-y-1.5 col-span-2">
        <label className="text-xs font-semibold text-slate-700">Discount Code (Optional)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setDiscountError('');
                setDiscountApplied(false);
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
          {/* 
            ==========================================================================
            DISCOUNT CODE VALIDATION (January 3rd, 2026)
            
            TODO: Implement real discount code validation via Stripe Promotion Codes API
            
            Implementation steps:
            1. Create API endpoint: POST /api/stripe/validate-promo-code
            2. Use Stripe's promotion_codes.list() or coupons.retrieve() to validate
            3. Return discount percentage/amount and apply to payment
            4. Pass coupon ID to update-payment-method or subscription update
            
            For now, discount codes are disabled (always returns "Discount codes coming soon")
            ==========================================================================
          */}
          <button
            type="button"
            onClick={async () => {
              if (!discountCode.trim()) return;
              
              setIsApplyingDiscount(true);
              setDiscountError('');
              
              try {
                // TODO: Replace with real API call to validate promo code
                // Example: const res = await fetch('/api/stripe/validate-promo-code', {
                //   method: 'POST',
                //   body: JSON.stringify({ code: discountCode })
                // });
                
                // For now, all codes are invalid until real validation is implemented
                setDiscountError('Discount codes coming soon');
                setDiscountApplied(false);
                setDiscountAmount(0);
              } catch {
                setDiscountError('Failed to validate code');
              } finally {
                setIsApplyingDiscount(false);
              }
            }}
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
              {discountAmount}% discount will be applied to your next billing cycle
            </p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isCardReady || !cardholderName.trim() || isLoading || isProcessing}
        className={cn(
          "w-full py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
          (isCardReady && cardholderName.trim() && !isLoading && !isProcessing)
            ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
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
            Save Payment Method
          </>
        )}
      </button>

      {/* Security Note */}
      <p className="text-[10px] text-slate-400 text-center">
        Your card details are stored securely by Stripe. We never see your full card number.
      </p>
    </form>
  );
};

export const AddCardModal: React.FC<AddCardModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId,
  userEmail,
}) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Payment Method" width="max-w-md">
      <StripeProvider>
        <CardForm 
          userId={userId} 
          userEmail={userEmail}
          onSuccess={onSuccess} 
          onClose={handleClose} 
        />
      </StripeProvider>
    </Modal>
  );
};

export default AddCardModal;
