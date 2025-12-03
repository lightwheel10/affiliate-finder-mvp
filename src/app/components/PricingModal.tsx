'use client';

import React, { useState } from 'react';
import { Check, Zap, Loader2, Star, ShieldCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (planName: string) => {
    setIsLoading(planName);
    try {
      // Simulate Stripe/Checkout delay - TODO: Integrate with actual payment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, just close the modal
      // In production, this would redirect to Stripe Checkout
      onClose();
    } catch (error) {
      console.error('Subscription failed', error);
    } finally {
      setIsLoading(null);
    }
  };

  const plans = [
    {
      name: 'Pro',
      description: 'Perfect for solo founders & small teams starting their affiliate journey.',
      monthlyPrice: 99,
      annualPrice: 79,
      features: [
        'Find 500 new affiliates / month',
        '150 Verified email credits / month',
        '1 Brand Project',
        'Basic Search Filters',
        'Email Support',
        'Export to CSV'
      ],
      cta: 'Upgrade Now for Full Access',
      popular: false,
      color: 'blue'
    },
    {
      name: 'Business',
      description: 'For growing brands that need to scale their outreach volume.',
      monthlyPrice: 249,
      annualPrice: 199,
      features: [
        'Find Unlimited affiliates',
        '500 Verified email credits / month',
        '5 Brand Projects',
        'Advanced Competitor Analysis',
        'Priority Chat Support',
        'API Access',
        'Team Collaboration (5 seats)'
      ],
      cta: 'Upgrade Now for Full Access',
      popular: true,
      color: 'indigo'
    },
    {
      name: 'Enterprise',
      description: 'Custom solutions for large organizations with specific needs.',
      priceLabel: 'Custom',
      features: [
        'Unlimited everything',
        'Dedicated Account Manager',
        'Custom AI Model Training',
        'SSO & Advanced Security',
        'White-glove Onboarding',
        'Custom Invoicing'
      ],
      cta: "Contact Sales",
      popular: false,
      color: 'slate'
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" width="max-w-5xl">
      <div className="py-6 px-2">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl text-slate-900 font-bold tracking-tight mb-4">
            Supercharge your <span className="text-[#1A1D21]">affiliate growth</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-8">
            Stop wasting hours searching manually. Get instant access to thousands of high-converting affiliates tailored to your niche.
          </p>

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

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const isPopular = plan.popular;

            return (
              <div 
                key={plan.name}
                className={cn(
                  "relative rounded-2xl bg-white flex flex-col",
                  isPopular 
                    ? "border-2 border-[#D4E815] shadow-xl shadow-[#D4E815]/20 z-10" 
                    : "border border-slate-200 shadow-lg"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <div className="bg-[#1A1D21] text-[#D4E815] text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                      <Star size={12} fill="currentColor" />
                      Best Value
                    </div>
                  </div>
                )}

                <div className="p-6 lg:p-8 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h3 className={cn("text-xl font-bold mb-2", isPopular ? "text-[#1A1D21]" : "text-slate-900")}>
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[40px]">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {plan.priceLabel ? (
                        <span className="text-4xl font-bold text-slate-900">{plan.priceLabel}</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-slate-900">${price}</span>
                          <span className="text-slate-400 font-medium">/mo</span>
                        </>
                      )}
                    </div>
                    {!plan.priceLabel && billingInterval === 'annual' && (
                       <p className="text-xs text-[#1A1D21] font-medium mt-1">Billed ${price! * 12} yearly</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.name)}
                    disabled={isLoading !== null}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-bold mb-8 transition-all duration-200 shadow-sm flex items-center justify-center gap-2",
                      isPopular 
                        ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] hover:shadow-[#D4E815]/25" 
                        : "bg-[#1A1D21] text-white hover:bg-[#2a2f35]"
                    )}
                  >
                     {isLoading === plan.name ? (
                       <Loader2 size={18} className="animate-spin" />
                     ) : (
                       <>
                         {plan.cta}
                         {isPopular && <Zap size={14} fill="currentColor" className="text-[#1A1D21]" />}
                       </>
                     )}
                  </button>

                  <div className="space-y-3 flex-1">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">What's included:</p>
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

        {/* Guarantee Footer */}
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
        </div>
      </div>
    </Modal>
  );
};
