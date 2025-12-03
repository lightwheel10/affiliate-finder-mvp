'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, Zap, Building2, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PricingScreen = () => {
  const { startFreeTrial } = useAuth();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleStartTrial = async (planName: string) => {
    // Enterprise plan - contact sales (no trial)
    if (planName === 'Enterprise') {
      // In production, this would open a contact form or redirect
      window.open('mailto:sales@crewcast.studio?subject=Enterprise%20Inquiry', '_blank');
      return;
    }
    
    setLoadingPlan(planName);
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Start 7-day free trial with selected plan
      const selectedPlan = planName.toLowerCase() as 'pro' | 'business';
      await startFreeTrial(selectedPlan);
    } catch (error) {
      console.error('Failed to start trial', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Pro',
      description: 'For serious affiliate program growth',
      price: '$99',
      period: '/month',
      features: [
        'Unlimited Affiliate Discovery',
        'Weekly New Affiliate Discoveries',
        '150 Verified Email Addresses Monthly',
        '150 AI-Generated Personalised Outreach Emails',
        '1 Brand',
        'Advanced Search (Based on 10 Keywords, 5 Competitors)',
        '2 Team Seats',
        'Advanced Search and Filtering Tools',
        'Bulk features',
        'Priority Support',
        'One-Click CRM Export'
      ],
      cta: 'Start your 7-day free trial now',
      popular: true,
      highlight: true
    },
    {
      name: 'Business',
      description: 'For teams managing multiple programs',
      price: '$249',
      period: '/month',
      features: [
        'Everything in Pro +',
        '500 Verified Email Addresses Monthly',
        '5 Brands',
        'Custom Search (Based on 10 Keywords, 10 Competitors)',
        '5 Team Seats',
        'Advanced Analytics Dashboard',
        'Dedicated Account Manager',
        'Custom CRM Integration Setup'
      ],
      cta: 'Start your 7-day free trial now',
      popular: false,
      highlight: false
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with custom requirements',
      price: 'Custom',
      period: '',
      features: [
        'Everything in Business +',
        'Unlimited Verified Emails',
        'Unlimited Brand Portfolio Management',
        'Unlimited Team Access',
        'Custom AI Training',
        '24/7 Priority Support',
        'API Access for Custom Integrations',
        'Custom Webhooks'
      ],
      cta: "Let's Talk",
      popular: false,
      highlight: false
    }
  ];

  return (
    <div className="min-h-screen w-full bg-[#FDFDFD] font-sans py-12 px-4 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-6 h-6 rounded-md shadow-md shadow-[#1A1D21]/10 object-cover"
            />
            <span className="font-bold text-lg tracking-tight text-slate-900">CrewCast <span className="text-[#1A1D21]">Studio</span></span>
          </div>
          
          <h1 className="text-2xl md:text-3xl text-slate-900 font-medium tracking-tight mb-6">
            Select a plan to start your <span className="text-[#1A1D21] font-serif italic">free 7-day</span> trial
          </h1>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/60 relative">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 z-10",
                billingInterval === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 z-10 flex items-center gap-2",
                billingInterval === 'annual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Annual
              <span className="bg-[#D4E815]/20 text-[#1A1D21] text-[10px] font-bold px-1.5 py-0.5 rounded">30% discount</span>
            </button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={cn(
                "relative rounded-2xl bg-white border transition-all duration-300 flex flex-col",
                plan.highlight 
                  ? "border-[#D4E815] shadow-xl shadow-[#D4E815]/20 scale-[1.02] z-10" 
                  : "border-slate-200 shadow-sm hover:shadow-md"
              )}
            >
              {plan.popular && (
                <div className="bg-[#1A1D21] text-[#D4E815] text-xs font-bold tracking-wider uppercase text-center py-2 rounded-t-xl flex items-center justify-center gap-1.5">
                  <Zap size={12} fill="currentColor" />
                  Most Popular
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={cn("text-3xl font-medium tracking-tight", plan.highlight ? "text-[#1A1D21]" : "text-slate-900")}>
                      {plan.price}
                    </span>
                    <span className={cn("text-base font-serif italic", plan.highlight ? "text-[#333333]" : "text-[#333333]")}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleStartTrial(plan.name)}
                  disabled={loadingPlan !== null}
                  className={cn(
                    "w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 shadow-sm hover:shadow-md",
                    plan.highlight 
                      ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913]" 
                      : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                   {loadingPlan === plan.name ? (
                     <Loader2 size={18} className="animate-spin mx-auto" />
                   ) : plan.cta}
                </button>

                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, idx) => {
                     const isHeader = feature.includes('Everything in');
                     return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className={cn(
                          "mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                          isHeader ? "bg-transparent" : "bg-[#1A1D21] text-[#D4E815]"
                        )}>
                           {!isHeader && <Check size={8} strokeWidth={3} />}
                        </div>
                        <span className={cn(
                          "text-xs leading-relaxed",
                          isHeader ? "font-semibold text-slate-900" : "text-slate-600"
                        )}>
                          {feature}
                        </span>
                      </div>
                     );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

