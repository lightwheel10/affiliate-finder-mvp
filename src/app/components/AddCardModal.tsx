'use client';

import React, { useState } from 'react';
import { CreditCard, Lock, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cardDetails: CardDetails) => void;
  userId: number;
}

export interface CardDetails {
  cardNumber: string;
  cardLast4: string;
  cardBrand: string;
  cardExpMonth: number;
  cardExpYear: number;
  cardCvc: string;
}

// Detect card brand from number
const detectCardBrand = (number: string): string => {
  const cleaned = number.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'Visa';
  if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
  if (/^3[47]/.test(cleaned)) return 'Amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
  return 'Card';
};

// Format card number with spaces
const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ').slice(0, 19) : cleaned;
};

// Format expiry as MM/YY
const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + (cleaned.length > 2 ? '/' + cleaned.slice(2, 4) : '');
  }
  return cleaned;
};

export const AddCardModal: React.FC<AddCardModalProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBrand = detectCardBrand(cardNumber);
  const cleanedNumber = cardNumber.replace(/\s/g, '');

  // Basic validation
  const isCardNumberValid = cleanedNumber.length >= 15 && cleanedNumber.length <= 16;
  const isExpiryValid = /^\d{2}\/\d{2}$/.test(expiry);
  const isCvcValid = cvc.length >= 3 && cvc.length <= 4;
  const isNameValid = cardholderName.trim().length > 0;
  const isFormValid = isCardNumberValid && isExpiryValid && isCvcValid && isNameValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setError('Please fill in all fields correctly');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [expMonth, expYear] = expiry.split('/');
      const fullYear = 2000 + parseInt(expYear);

      // Save card details to database
      const res = await fetch('/api/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cardLast4: cleanedNumber.slice(-4),
          cardBrand,
          cardExpMonth: parseInt(expMonth),
          cardExpYear: fullYear,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save card');
      }

      // Return card details to parent
      onSuccess({
        cardNumber: cleanedNumber,
        cardLast4: cleanedNumber.slice(-4),
        cardBrand,
        cardExpMonth: parseInt(expMonth),
        cardExpYear: fullYear,
        cardCvc: cvc,
      });

      // Reset form
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setCardholderName('');
      onClose();
    } catch (err) {
      console.error('Error saving card:', err);
      setError('Failed to save card. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Payment Method" width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <Lock size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold">Secure card storage</p>
            <p className="text-blue-600">Your card will be charged automatically after your 3-day trial ends.</p>
          </div>
        </div>

        {/* Cardholder Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Cardholder Name</label>
          <input
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Card Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Card Number</label>
          <div className="relative">
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className="w-full px-3 py-2.5 pr-12 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400 font-mono"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {cardBrand === 'Visa' && (
                <div className="w-8 h-5 bg-blue-600 rounded text-white text-[8px] font-bold flex items-center justify-center">VISA</div>
              )}
              {cardBrand === 'Mastercard' && (
                <div className="w-8 h-5 bg-gradient-to-r from-red-500 to-yellow-500 rounded text-white text-[6px] font-bold flex items-center justify-center">MC</div>
              )}
              {cardBrand === 'Amex' && (
                <div className="w-8 h-5 bg-blue-800 rounded text-white text-[6px] font-bold flex items-center justify-center">AMEX</div>
              )}
              {cardBrand === 'Discover' && (
                <div className="w-8 h-5 bg-orange-500 rounded text-white text-[6px] font-bold flex items-center justify-center">DISC</div>
              )}
              {cardBrand === 'Card' && (
                <CreditCard size={18} className="text-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* Expiry & CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Expiry Date</label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/YY"
              maxLength={5}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">CVC</label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              maxLength={4}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400 font-mono"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className={cn(
            "w-full py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
            isFormValid && !isLoading
              ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Lock size={14} />
              Save Payment Method
            </>
          )}
        </button>

        {/* Security Note */}
        <p className="text-[10px] text-slate-400 text-center">
          Your card details are stored securely. We'll charge your card after the trial period.
        </p>
      </form>
    </Modal>
  );
};

