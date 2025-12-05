'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Check, ChevronDown, Sparkles, Globe, Plus, X, MessageSquare, MousePointerClick, CreditCard, Zap, Star, ShieldCheck, TrendingUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pricing plans data - matching PricingModal exactly
const PRICING_PLANS = [
  {
    id: 'pro',
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
    popular: false,
  },
  {
    id: 'business',
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
    popular: true,
  },
  {
    id: 'enterprise',
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
    popular: false,
  },
];

// Mock data for suggestions
const SUGGESTED_COMPETITORS = [
  { name: 'Partnerstack', domain: 'partnerstack.com', logo: 'https://logo.clearbit.com/partnerstack.com' },
  { name: 'Tapfiliate', domain: 'tapfiliate.com', logo: 'https://logo.clearbit.com/tapfiliate.com' },
  { name: 'Scaleo', domain: 'scaleo.com', logo: 'https://logo.clearbit.com/scaleo.com' },
  { name: 'Shareasale', domain: 'shareasale.com', logo: 'https://logo.clearbit.com/shareasale.com' },
  { name: 'Cj', domain: 'cj.com', logo: 'https://logo.clearbit.com/cj.com' },
  { name: 'Clickbank', domain: 'clickbank.com', logo: 'https://logo.clearbit.com/clickbank.com' },
  { name: 'Flexoffers', domain: 'flexoffers.com', logo: 'https://logo.clearbit.com/flexoffers.com' },
  { name: 'Maxbounty', domain: 'maxbounty.com', logo: 'https://logo.clearbit.com/maxbounty.com' },
  { name: 'Pepperjam', domain: 'pepperjam.com', logo: 'https://logo.clearbit.com/pepperjam.com' },
  { name: 'Holo', domain: 'holo.com', logo: 'https://logo.clearbit.com/holo.com' },
  { name: 'Shopmy', domain: 'shopmy.com', logo: 'https://logo.clearbit.com/shopmy.com' },
  { name: 'Structuredweb', domain: 'structuredweb.com', logo: 'https://logo.clearbit.com/structuredweb.com' },
  { name: 'Stay22', domain: 'stay22.com', logo: 'https://logo.clearbit.com/stay22.com' },
  { name: 'Voluum', domain: 'voluum.com', logo: 'https://logo.clearbit.com/voluum.com' },
  { name: 'Zebracat', domain: 'zebracat.com', logo: 'https://logo.clearbit.com/zebracat.com' },
  { name: 'Brandwatch', domain: 'brandwatch.com', logo: 'https://logo.clearbit.com/brandwatch.com' },
  { name: 'Copy', domain: 'copy.ai', logo: 'https://logo.clearbit.com/copy.ai' },
  { name: 'Moredeal', domain: 'moredeal.ai', logo: 'https://logo.clearbit.com/moredeal.ai' },
  { name: 'Systeme', domain: 'systeme.io', logo: 'https://logo.clearbit.com/systeme.io' },
];

const SUGGESTED_TOPICS = [
  "best Affiliate-Marketing-Platform",
  "AI-Fraud-Detection for Affiliate Programs",
  "Affiliate Program without monthly fees",
  "Benefits of Prepayment Affiliate Networks",
  "Quick Affiliate Onboarding",
  "Tool to prevent Affiliate Coupon Fraud",
  "Affiliate Tracking Platform for Influencers",
  "Commission Calculator for Affiliate Programs",
  "Affiliate Marketing as a Service Platform",
  "Transparent Affiliate Billing Model"
];

const AFFILIATE_TYPES = [
  "Publishers/Bloggers",
  "Instagram",
  "TikTok",
  "X (Twitter)",
  "LinkedIn",
  "Reddit",
  "YouTube",
  "Other"
];

interface OnboardingScreenProps {
  userId: number;
  userName: string;
  initialStep?: number; // Resume from this step
  userData?: {
    name?: string;
    role?: string;
    brand?: string;
    targetCountry?: string;
    targetLanguage?: string;
    competitors?: string[];
    topics?: string[];
    affiliateTypes?: string[];
  };
  onComplete: () => void;
}

export const OnboardingScreen = ({ userId, userName, initialStep = 1, userData, onComplete }: OnboardingScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(initialStep);
  
  // Step 1 Data - pre-fill from userData if resuming
  const [name, setName] = useState(userData?.name || userName || '');
  const [role, setRole] = useState(userData?.role || '');
  const [brand, setBrand] = useState(userData?.brand || '');
  
  // Step 2 Data - pre-fill from userData if resuming
  const [targetCountry, setTargetCountry] = useState(userData?.targetCountry || '');
  const [targetLanguage, setTargetLanguage] = useState(userData?.targetLanguage || '');
  
  // Step 3 Data - pre-fill from userData if resuming
  const [competitors, setCompetitors] = useState<string[]>(userData?.competitors || []);
  const [competitorInput, setCompetitorInput] = useState('');

  // Step 4 Data - pre-fill from userData if resuming
  const [topics, setTopics] = useState<string[]>(userData?.topics || []);
  const [topicInput, setTopicInput] = useState('');

  // Step 5 Data - pre-fill from userData if resuming
  const [affiliateTypes, setAffiliateTypes] = useState<string[]>(userData?.affiliateTypes || []);

  // Step 6 Data - Pricing
  const [selectedPlan, setSelectedPlan] = useState<string>('business'); // Default to business (most popular)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');

  // Step 7 Data - Card Details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // UI States
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Refs for click-outside detection
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles = [
    'Brand Owner', 'Affiliate Manager', 'Agency Owner', 
    'Freelancer', 'Content Creator', 'Other'
  ];

  const countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France'];
  const languages = ['English', 'Spanish', 'German', 'French', 'Portuguese', 'Italian'];

  // Helper to save progress to database
  const saveProgress = async (nextStep: number, additionalData?: Record<string, unknown>) => {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          onboardingStep: nextStep,
          ...additionalData,
        }),
      });
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
    }
  };

  const handleContinue = async () => {
    if (step === 1) {
      if (!name || !role || !brand) return;
      // Save step 1 data and move to step 2
      await saveProgress(2, { name, role, brand });
      setStep(2);
    } else if (step === 2) {
      if (!targetCountry || !targetLanguage) return;
      // Save step 2 data and move to step 3
      await saveProgress(3, { targetCountry, targetLanguage });
      setStep(3);
    } else if (step === 3) {
      // Save step 3 data and move to step 4
      await saveProgress(4, { competitors });
      setStep(4);
    } else if (step === 4) {
      // Save step 4 data and move to step 5
      await saveProgress(5, { topics });
      setStep(5);
    } else if (step === 5) {
      // Save step 5 data and move to step 6 (Pricing)
      await saveProgress(6, { affiliateTypes });
      setStep(6);
    } else if (step === 6) {
      // User selected plan, move to step 7 (Card Details)
      // Enterprise users skip card entry
      if (selectedPlan === 'enterprise') {
        // For enterprise, just complete onboarding without card
        setIsLoading(true);
        try {
          await fetch('/api/users/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: userId,
              name,
              role,
              brand,
              targetCountry,
              targetLanguage,
              competitors,
              topics,
              affiliateTypes,
            }),
          });
          onComplete();
        } catch (error) {
          console.error('Onboarding failed', error);
        } finally {
          setIsLoading(false);
        }
        return;
      }
      await saveProgress(7, { plan: selectedPlan });
      setStep(7);
    } else {
      // Final Submission - Step 7: Card entered, create subscription + complete onboarding
      setIsLoading(true);
      try {
        // Parse card details
        const cleanedCardNumber = cardNumber.replace(/\s/g, '');
        const [expMonth, expYear] = cardExpiry.split('/');
        const fullYear = 2000 + parseInt(expYear || '0');
        
        // Detect card brand
        let cardBrand = 'Card';
        if (/^4/.test(cleanedCardNumber)) cardBrand = 'Visa';
        else if (/^5[1-5]/.test(cleanedCardNumber)) cardBrand = 'Mastercard';
        else if (/^3[47]/.test(cleanedCardNumber)) cardBrand = 'Amex';
        else if (/^6(?:011|5)/.test(cleanedCardNumber)) cardBrand = 'Discover';

        // 1. Complete onboarding data
        const onboardingRes = await fetch('/api/users/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          id: userId,
          name,
          role,
          brand,
          targetCountry,
          targetLanguage,
          competitors,
          topics,
          affiliateTypes,
          }),
        });
        
        if (!onboardingRes.ok) {
          throw new Error('Onboarding failed');
        }

        // 2. Create subscription with selected plan + card details (3-day trial starts NOW)
        const subscriptionRes = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            plan: selectedPlan,
            billingInterval,
            cardLast4: cleanedCardNumber.slice(-4),
            cardBrand,
            cardExpMonth: parseInt(expMonth || '0'),
            cardExpYear: fullYear,
          }),
        });

        if (!subscriptionRes.ok) {
          throw new Error('Subscription creation failed');
        }
        
        onComplete();
      } catch (error) {
        console.error('Onboarding failed', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Helpers
  const toggleCompetitor = (domain: string) => {
    if (competitors.includes(domain)) {
      setCompetitors(competitors.filter(c => c !== domain));
    } else {
      if (competitors.length >= 5) return;
      setCompetitors([...competitors, domain]);
    }
  };

  const addCustomCompetitor = () => {
    if (!competitorInput.trim()) return;
    if (competitors.includes(competitorInput.trim())) {
       setCompetitorInput('');
       return;
    }
    if (competitors.length >= 5) return;
    
    setCompetitors([...competitors, competitorInput.trim()]);
    setCompetitorInput('');
  };

  const toggleTopic = (topic: string) => {
    if (topics.includes(topic)) {
      setTopics(topics.filter(t => t !== topic));
    } else {
      if (topics.length >= 10) return;
      setTopics([...topics, topic]);
    }
  };

  const addCustomTopic = () => {
    if (!topicInput.trim()) return;
    if (topics.includes(topicInput.trim())) {
       setTopicInput('');
       return;
    }
    if (topics.length >= 10) return;
    
    setTopics([...topics, topicInput.trim()]);
    setTopicInput('');
  };

  const toggleAffiliateType = (type: string) => {
    if (affiliateTypes.includes(type)) {
      setAffiliateTypes(affiliateTypes.filter(t => t !== type));
    } else {
      setAffiliateTypes([...affiliateTypes, type]);
    }
  };

  const renderStep1 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-slate-600 text-xs font-medium mb-1.5">
          Thanks for joining CrewCast Studio
        </p>
        <h1 className="text-xl md:text-2xl text-slate-900 font-medium tracking-tight">
          Let&apos;s <span className="text-[#1A1D21] font-serif italic">get to know</span> each other
        </h1>
      </div>

      <div className="space-y-3">
        {/* Name Input */}
        <div className="space-y-1">
          <label className="text-slate-900 font-medium ml-1 text-sm">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all text-sm"
            placeholder="Enter your full name"
          />
        </div>

        {/* Role Dropdown */}
        <div className="space-y-1 relative" ref={roleDropdownRef}>
          <label className="text-slate-900 font-medium ml-1 text-sm">What&apos;s your role</label>
          <button
            type="button"
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className={cn(
              "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-left flex items-center justify-between focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all text-sm",
              !role ? "text-slate-400" : "text-slate-800"
            )}
          >
            {role || "Select your role"}
            <ChevronDown className={cn("text-slate-400 transition-transform", isRoleDropdownOpen && "rotate-180")} size={16} />
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto scrollbar-hide">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setIsRoleDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm flex items-center justify-between group"
                >
                  {r}
                  {role === r && <Check size={14} className="text-[#D4E815]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brand Input */}
        <div className="space-y-1">
          <label className="text-slate-900 font-medium ml-1 text-sm">Which brand do you want to find affiliates for?</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all text-sm"
            placeholder="e.g. spectrumailabs.com"
          />
          <p className="text-slate-500 text-xs leading-relaxed px-1 pt-0.5">
            For agencies, this should be your client&apos;s website, not your own.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] rounded-md flex items-center justify-center text-[#D4E815] shadow-md shadow-[#1A1D21]/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">CrewCast<span className="text-[#1A1D21]">Studio</span></span>
        </div>
        <span className="text-slate-400 text-xs">Step 1 of 5</span>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 1 ? "bg-[#D4E815]" : "bg-slate-100"
            )} 
           />
        ))}
      </div>

      {/* Question Block - Compact */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <div className="w-6 h-6 rounded-full bg-[#D4E815]/20 flex items-center justify-center shrink-0 text-[#1A1D21]">
             <Globe size={12} />
      </div>
          <p className="text-slate-900 font-medium text-sm">
            Target market
          </p>
        </div>

        {/* Country Dropdown */}
        <div className="space-y-1 relative" ref={countryDropdownRef}>
          <label className="text-slate-700 text-xs font-medium ml-1">Country</label>
          <button
            type="button"
            onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
            className={cn(
              "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-left flex items-center justify-between focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all text-sm",
              !targetCountry ? "text-slate-900" : "text-slate-900"
            )}
          >
            {targetCountry || "Select your target country..."}
            <ChevronDown className={cn("text-slate-400 transition-transform", isCountryDropdownOpen && "rotate-180")} size={14} />
          </button>
           {isCountryDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto scrollbar-hide">
              {countries.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setTargetCountry(c);
                    setIsCountryDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm flex items-center justify-between group"
                >
                  {c}
                  {targetCountry === c && <Check size={14} className="text-[#D4E815]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language Dropdown */}
        <div className="space-y-1 relative" ref={langDropdownRef}>
          <label className="text-slate-700 text-xs font-semibold ml-1">Target Language</label>
          <button
            type="button"
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className={cn(
              "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-left flex items-center justify-between focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all text-sm",
              !targetLanguage ? "text-slate-400" : "text-slate-900"
            )}
          >
            {targetLanguage || "Select your target language..."}
            <ChevronDown className={cn("text-slate-400 transition-transform", isLangDropdownOpen && "rotate-180")} size={14} />
          </button>
           {isLangDropdownOpen && (
            <div className="absolute bottom-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto scrollbar-hide">
              {languages.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setTargetLanguage(l);
                    setIsLangDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm flex items-center justify-between group"
                >
                  {l}
                  {targetLanguage === l && <Check size={14} className="text-[#D4E815]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] rounded-md flex items-center justify-center text-[#D4E815] shadow-md shadow-[#1A1D21]/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">CrewCast<span className="text-[#1A1D21]">Studio</span></span>
        </div>
        <span className="text-slate-400 text-xs">Step 2 of 5</span>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 2 ? "bg-[#D4E815]" : "bg-slate-100"
            )} 
           />
        ))}
      </div>

      {/* Question Block - More Compact */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
           <div className="w-6 h-6 rounded-full bg-[#D4E815]/20 flex items-center justify-center shrink-0 text-[#1A1D21]">
             <Sparkles size={12} />
      </div>
          <p className="text-slate-900 font-medium text-sm">
            Add your top 5 competitors
          </p>
        </div>

        {/* Competitor Input */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input 
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCompetitor())}
              placeholder="e.g. competitor.com"
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400"
            />
             <button 
              type="button"
              onClick={addCustomCompetitor}
              disabled={!competitorInput.trim() || competitors.length >= 5}
              className="w-9 h-9 rounded-full bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-[11px] text-slate-400 ml-1">
            {competitors.length}/5 added
          </p>
        </div>

        {/* Selected & Suggested Grid */}
        <div className="space-y-2">
          <p className="text-slate-600 text-xs font-medium">Quick add suggestions:</p>
          
          <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto scrollbar-hide">
            {/* Render Selected First */}
            {competitors.map(comp => {
              const suggestion = SUGGESTED_COMPETITORS.find(s => s.domain === comp);
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => toggleCompetitor(comp)}
                  className="group relative flex items-center gap-2 p-2 rounded-lg bg-[#D4E815]/10 border-2 border-[#D4E815] text-left transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                    {suggestion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={suggestion.logo} alt="" className="w-4 h-4 object-contain" />
                    ) : (
                       <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                         {comp[0].toUpperCase()}
                       </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-900 truncate">{suggestion?.name || comp}</p>
                    <p className="text-[9px] text-slate-500 truncate">{comp}</p>
                  </div>
                   <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <X size={10} />
                   </div>
                </button>
              );
            })}

            {/* Render Suggestions */}
            {SUGGESTED_COMPETITORS.filter(s => !competitors.includes(s.domain)).map((comp) => (
               <button
                  key={comp.domain}
                  type="button"
                  disabled={competitors.length >= 5}
                  onClick={() => toggleCompetitor(comp.domain)}
                  className="group flex items-center gap-2 p-2 rounded-lg bg-white border-2 border-slate-200 text-left hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={comp.logo} alt="" className="w-4 h-4 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-900 truncate">{comp.name}</p>
                    <p className="text-[9px] text-slate-400 truncate group-hover:text-slate-500 transition-colors">{comp.domain}</p>
                  </div>
                </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] rounded-md flex items-center justify-center text-[#D4E815] shadow-md shadow-[#1A1D21]/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">CrewCast<span className="text-[#1A1D21]">Studio</span></span>
        </div>
        <span className="text-slate-400 text-xs">Step 3 of 5</span>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 3 ? "bg-[#D4E815]" : "bg-slate-100"
            )} 
           />
        ))}
      </div>

      {/* Question Block - Compact */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
           <div className="w-6 h-6 rounded-full bg-[#D4E815]/20 flex items-center justify-center shrink-0 text-[#1A1D21]">
             <MessageSquare size={12} />
      </div>
          <p className="text-slate-900 font-medium text-sm">
            What topics do you cover?
          </p>
        </div>

        {/* Topic Input */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTopic())}
              placeholder="e.g. best CRMs, skincare..."
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20 transition-all placeholder:text-slate-400"
            />
             <button 
              type="button"
              onClick={addCustomTopic}
              disabled={!topicInput.trim() || topics.length >= 10}
              className="w-9 h-9 rounded-full bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-[11px] text-slate-400 ml-1">
            {topics.length}/10 added
          </p>
        </div>

        {/* Selected & Suggested List */}
        <div className="space-y-2">
          <p className="text-slate-600 text-xs font-medium">Quick add suggestions:</p>
          
          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto scrollbar-hide">
            {/* Render Selected First */}
            {topics.map(topic => (
               <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4E815]/10 border-2 border-[#D4E815] text-[11px] font-medium text-[#1A1D21] transition-all text-left"
                >
                  {topic}
                   <div className="w-3.5 h-3.5 rounded-full bg-[#D4E815]/30 text-[#1A1D21] flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                     <X size={8} />
                   </div>
                </button>
            ))}

            {/* Render Suggestions */}
            {SUGGESTED_TOPICS.filter(t => !topics.includes(t)).map((topic) => (
               <button
                  key={topic}
                  type="button"
                  disabled={topics.length >= 10}
                  onClick={() => toggleTopic(topic)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border-2 border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {topic}
                </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] rounded-md flex items-center justify-center text-[#D4E815] shadow-md shadow-[#1A1D21]/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">CrewCast<span className="text-[#1A1D21]">Studio</span></span>
        </div>
        <span className="text-slate-400 text-xs">Step 4 of 5</span>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 4 ? "bg-[#D4E815]" : "bg-slate-100"
            )} 
           />
        ))}
      </div>

      {/* Question Block - Compact */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
           <div className="w-6 h-6 rounded-full bg-[#D4E815]/20 flex items-center justify-center shrink-0 text-[#1A1D21]">
             <MousePointerClick size={12} />
      </div>
          <p className="text-slate-900 font-medium text-sm">
            What types of affiliates do you want?
          </p>
        </div>

        {/* Affiliate Types Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {AFFILIATE_TYPES.map((type) => {
            const isSelected = affiliateTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleAffiliateType(type)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left group",
                  isSelected 
                    ? "bg-[#D4E815]/10 border-[#D4E815] text-slate-900" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                  isSelected 
                    ? "bg-[#D4E815] border-[#D4E815] text-[#1A1D21]" 
                    : "border-slate-300 group-hover:border-[#D4E815]"
                )}>
                  {isSelected && <Check size={8} strokeWidth={3} />}
                </div>
                <span className="truncate text-[13px]">{type}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg text-slate-900 font-bold tracking-tight mb-1">
          Choose your plan
        </h1>
        <p className="text-slate-500 text-xs mb-3">
          Start with a <span className="font-semibold text-[#1A1D21]">3-day free trial</span> • Cancel anytime
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              billingInterval === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
              billingInterval === 'annual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Annual
            <span className="bg-[#D4E815]/20 text-[#1A1D21] text-[9px] font-extrabold px-1 py-0.5 rounded uppercase">-20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRICING_PLANS.map((plan) => {
          const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
          const isSelected = selectedPlan === plan.id;
          const isPopular = plan.popular;
          const isEnterprise = plan.id === 'enterprise';

  return (
            <button
              key={plan.id}
              type="button"
              onClick={() => !isEnterprise && setSelectedPlan(plan.id)}
              disabled={isEnterprise}
              className={cn(
                "relative rounded-lg bg-white flex flex-col text-left transition-all",
                isPopular 
                  ? "border-2 border-[#D4E815] shadow-md shadow-[#D4E815]/10" 
                  : "border border-slate-200 shadow-sm",
                isSelected && !isEnterprise && "ring-2 ring-[#1A1D21] ring-offset-1",
                isEnterprise && "opacity-70 cursor-not-allowed"
              )}
            >
              {isPopular && (
                <div className="absolute -top-2.5 left-0 right-0 flex justify-center">
                  <div className="bg-[#1A1D21] text-[#D4E815] text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <Star size={8} fill="currentColor" />
                    Best Value
                  </div>
                </div>
              )}

              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-2">
                  <h3 className={cn("text-sm font-bold", isPopular ? "text-[#1A1D21]" : "text-slate-900")}>
                    {plan.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{plan.description}</p>
                </div>

                <div className="mb-2">
                  <div className="flex items-baseline gap-0.5">
                    {plan.priceLabel ? (
                      <span className="text-xl font-bold text-slate-900">{plan.priceLabel}</span>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-slate-900">${price}</span>
                        <span className="text-slate-400 text-xs font-medium">/mo</span>
                      </>
                    )}
                  </div>
                  {!plan.priceLabel && billingInterval === 'annual' && (
                    <p className="text-[9px] text-[#1A1D21] font-medium">Billed ${price! * 12}/yr</p>
                  )}
                </div>

                {/* Select indicator */}
                <div className={cn(
                  "w-full py-1.5 rounded-md text-[10px] font-bold mb-2 transition-all flex items-center justify-center gap-1",
                  isSelected && !isEnterprise
                    ? "bg-[#D4E815] text-[#1A1D21]"
                    : isPopular 
                      ? "bg-[#1A1D21]/10 text-[#1A1D21]"
                      : "bg-slate-100 text-slate-600"
                )}>
                  {isEnterprise ? (
                    "Contact Sales"
                  ) : isSelected ? (
                    <>
                      <Check size={10} strokeWidth={3} />
                      Selected
                    </>
                  ) : (
                    "Select Plan"
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wider mb-1">Included:</p>
                  {plan.features.slice(0, 5).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <div className={cn(
                        "mt-0.5 w-3 h-3 rounded-full flex items-center justify-center shrink-0",
                        isPopular ? "bg-[#1A1D21] text-[#D4E815]" : "bg-slate-100 text-slate-600"
                      )}>
                        <Check size={6} strokeWidth={4} />
                      </div>
                      <span className="text-[10px] text-slate-600 leading-tight">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Guarantee Footer */}
      <div className="mt-4 text-center pt-3 border-t border-slate-100">
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-[#D4E815]" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp size={12} className="text-[#1A1D21]" />
            <span>Cancel Anytime</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper functions for card formatting
  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ').slice(0, 19) : cleaned;
  };

  const formatExpiry = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 1) {
      let month = cleaned.slice(0, 2);
      // Auto-correct invalid months
      if (cleaned.length === 1 && parseInt(cleaned) > 1) {
        month = '0' + cleaned;
      }
      if (cleaned.length >= 2) {
        const monthNum = parseInt(month);
        if (monthNum > 12) month = '12';
        if (monthNum === 0) month = '01';
      }
      return month + (cleaned.length > 2 ? '/' + cleaned.slice(2, 4) : '');
    }
    return cleaned;
  };

  const detectCardBrand = (number: string): string => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'Amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    return 'Card';
  };

  const renderStep7 = () => {
    const cardBrand = detectCardBrand(cardNumber);
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    const isCardNumberValid = cleanedNumber.length >= 15 && cleanedNumber.length <= 16;
    
    // Validate expiry: must be MM/YY format with valid month (01-12) and future date
    const expiryMatch = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
    const isExpiryValid = (() => {
      if (!expiryMatch) return false;
      const month = parseInt(expiryMatch[1]);
      const year = parseInt('20' + expiryMatch[2]);
      if (month < 1 || month > 12) return false;
      const now = new Date();
      const expDate = new Date(year, month - 1);
      return expDate >= new Date(now.getFullYear(), now.getMonth());
    })();
    
    // CVC: 3 digits for most cards, 4 for Amex
    const expectedCvcLength = cardBrand === 'Amex' ? 4 : 3;
    const isCvcValid = cardCvc.length === expectedCvcLength;
    const isNameValid = cardholderName.trim().length > 0;

    // Get selected plan info
    const selectedPlanInfo = PRICING_PLANS.find(p => p.id === selectedPlan);
    const price = billingInterval === 'monthly' ? selectedPlanInfo?.monthlyPrice : selectedPlanInfo?.annualPrice;

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
            Enter your card details • You won't be charged today
          </p>
        </div>

        {/* Selected Plan Summary */}
        <div className="mb-6 p-4 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Selected Plan</p>
              <p className="text-base font-bold text-[#1A1D21]">{selectedPlanInfo?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#1A1D21]">${price}<span className="text-sm font-normal text-slate-500">/mo</span></p>
              {billingInterval === 'annual' && (
                <p className="text-[10px] text-slate-500">Billed annually</p>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D4E815]/30 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-slate-600">First charge: <span className="font-semibold">3 days from now</span></span>
          </div>
        </div>

        {/* Card Form */}
        <div className="space-y-4">
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
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                className={cn(
                  "w-full px-3 py-2.5 bg-white border rounded-lg text-sm text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 font-mono",
                  cardExpiry.length === 5 && !isExpiryValid
                    ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                    : "border-slate-200 focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20"
                )}
              />
              {cardExpiry.length === 5 && !isExpiryValid && (
                <p className="text-[10px] text-red-500">Invalid or expired date</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">CVC</label>
              <input
                type="text"
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, cardBrand === 'Amex' ? 4 : 3))}
                placeholder={cardBrand === 'Amex' ? '1234' : '123'}
                maxLength={cardBrand === 'Amex' ? 4 : 3}
                className={cn(
                  "w-full px-3 py-2.5 bg-white border rounded-lg text-sm text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 font-mono",
                  cardCvc.length > 0 && !isCvcValid
                    ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                    : "border-slate-200 focus:border-[#D4E815] focus:ring-1 focus:ring-[#D4E815]/20"
                )}
              />
            </div>
          </div>
        </div>

        {/* Submit Button for Step 7 */}
        <button
          type="submit"
          disabled={!isCardNumberValid || !isExpiryValid || !isCvcValid || !isNameValid || isLoading}
          className={cn(
            "w-full mt-5 py-3 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2",
            (!isCardNumberValid || !isExpiryValid || !isCvcValid || !isNameValid || isLoading)
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913]"
          )}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Lock size={14} />
              Start 3-Day Free Trial
            </>
          )}
        </button>

        {/* Security Note */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-[#D4E815]" />
            <span>256-bit SSL encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-[#1A1D21]" />
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    );
  };

  // Card validation helper for step 7 button
  const getStep7Validation = () => {
    const cardBrand = detectCardBrand(cardNumber);
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    const isCardNumberValid = cleanedNumber.length >= 15 && cleanedNumber.length <= 16;
    const expiryMatch = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
    const isExpiryValid = (() => {
      if (!expiryMatch) return false;
      const month = parseInt(expiryMatch[1]);
      const year = parseInt('20' + expiryMatch[2]);
      if (month < 1 || month > 12) return false;
      const now = new Date();
      const expDate = new Date(year, month - 1);
      return expDate >= new Date(now.getFullYear(), now.getMonth());
    })();
    const expectedCvcLength = cardBrand === 'Amex' ? 4 : 3;
    const isCvcValid = cardCvc.length === expectedCvcLength;
    const isNameValid = cardholderName.trim().length > 0;
    return isCardNumberValid && isExpiryValid && isCvcValid && isNameValid;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F0F2F5] font-sans py-4 px-4">
      <div className={cn(
        "bg-white rounded-2xl shadow-sm p-5 relative flex flex-col",
        step === 6 ? "w-full max-w-3xl" : "w-full max-w-[420px] max-h-[90vh]"
      )}>
        
        <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="flex-1 flex flex-col">
           {/* Content area - only scroll on steps that need it (3, 4, 5 have lots of content, 6 needs full width) */}
           <div className={cn(
             "flex-1 pr-1",
             step >= 3 && step <= 5 ? "overflow-y-auto scrollbar-hide" : "overflow-visible"
           )}>
             {step === 1 && renderStep1()}
             {step === 2 && renderStep2()}
             {step === 3 && renderStep3()}
             {step === 4 && renderStep4()}
             {step === 5 && renderStep5()}
             {step === 6 && renderStep6()}
             {step === 7 && renderStep7()}
           </div>

           {/* Submit Button - Hide for step 7 since it has its own button */}
          {step !== 7 && (
          <div className="pt-5 mt-auto shrink-0">
              {(() => {
                const isDisabled = 
                (step === 1 && (!name || !role || !brand)) ||
                (step === 2 && (!targetCountry || !targetLanguage)) || 
                  (step === 6 && !selectedPlan) ||
                  isLoading;

                return (
                  <button
                    type="submit"
                    disabled={isDisabled}
              className={cn(
                      "w-full py-3 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2",
                      isDisabled
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913]"
              )}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
                    ) : step === 6 ? (
                      selectedPlan === 'enterprise' ? (
                        "Contact Sales"
                      ) : (
                        "Continue to Payment"
                      )
                    ) : step === 5 ? (
                      "Choose Plan"
                    ) : step === 1 ? (
                      "Continue"
                    ) : (
                      "Next"
              )}
            </button>
                );
              })()}
          </div>
          )}
        </form>

      </div>
    </div>
  );
};

