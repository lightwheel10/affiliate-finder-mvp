'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Check, ChevronDown, Sparkles, Globe, Plus, X, Search, MessageSquare, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export const OnboardingScreen = () => {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Step 1 Data
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState('');
  const [brand, setBrand] = useState('');
  
  // Step 2 Data
  const [targetCountry, setTargetCountry] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  
  // Step 3 Data
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');

  // Step 4 Data
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');

  // Step 5 Data
  const [affiliateTypes, setAffiliateTypes] = useState<string[]>([]);

  // UI States
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const roles = [
    'Brand Owner', 'Affiliate Manager', 'Agency Owner', 
    'Freelancer', 'Content Creator', 'Other'
  ];

  const countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France'];
  const languages = ['English', 'Spanish', 'German', 'French', 'Portuguese', 'Italian'];

  const handleContinue = async () => {
    if (step === 1) {
      if (!name || !role || !brand) return;
      setStep(2);
    } else if (step === 2) {
      if (!targetCountry || !targetLanguage) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else {
      // Final Submission - Mark Onboarding as Complete
      // This will trigger the AuthGuard to show the PricingScreen next
      setIsLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await updateProfile({
          name,
          role,
          brand,
          isOnboarded: true, // <--- This completes onboarding
          // In a real app, we'd save these too:
          // targetCountry,
          // targetLanguage,
          // competitors,
          // topics,
          // affiliateTypes
        });
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
          Thanks for joining AffiliateFinder.ai
        </p>
        <h1 className="text-xl md:text-2xl text-slate-900 font-medium tracking-tight">
          Let's <span className="text-[#0EA5E9] font-serif italic">get to know</span> each other
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
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all text-sm"
            placeholder="Enter your full name"
          />
        </div>

        {/* Role Dropdown */}
        <div className="space-y-1 relative">
          <label className="text-slate-900 font-medium ml-1 text-sm">What's your role</label>
          <button
            type="button"
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className={cn(
              "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-left flex items-center justify-between focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all text-sm",
              !role ? "text-slate-400" : "text-slate-800"
            )}
          >
            {role || "Select your role"}
            <ChevronDown className={cn("text-slate-400 transition-transform", isRoleDropdownOpen && "rotate-180")} size={16} />
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto">
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
                  {role === r && <Check size={14} className="text-[#0EA5E9]" />}
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
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all text-sm"
            placeholder="e.g. spectrumailabs.com"
          />
          <p className="text-slate-500 text-xs leading-relaxed px-1 pt-0.5">
            For agencies, this should be your client's website, not your own.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-1.5 mb-3">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white shadow-md shadow-blue-600/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">Affiliate<span className="text-blue-600">Finder.ai</span></span>
        </div>
        
        <h1 className="text-lg md:text-xl text-slate-900 font-medium tracking-tight mb-1">
          Nice to meet you, {name.split(' ')[0].toLowerCase()}!
        </h1>
        <p className="text-slate-500 text-xs">
          Let's personalize your results in under a minute.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 1 ? "bg-blue-300" : "bg-slate-100",
              i === 1 && "bg-[#0EA5E9]"
            )} 
           />
        ))}
      </div>

      <div className="mb-4">
         <span className="text-slate-400 text-xs">Question 1</span>
      </div>

      {/* Question Block */}
      <div className="space-y-4">
        <div className="flex gap-2.5 items-start">
          <div className="w-7 h-7 rounded-full bg-[#FDE68A]/30 flex items-center justify-center shrink-0 text-[#D97706]">
             <Globe size={14} />
          </div>
          <p className="text-slate-900 font-medium text-sm leading-relaxed pt-0.5">
            What's your main country and language you're targeting affiliate for? (Don't worry, you can add more later)
          </p>
        </div>

        {/* Country Dropdown */}
        <div className="space-y-1 relative">
          <label className="text-slate-700 text-xs font-semibold ml-1">Target Country</label>
          <button
            type="button"
            onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
            className={cn(
              "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-left flex items-center justify-between focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all text-sm",
              !targetCountry ? "text-slate-900" : "text-slate-900"
            )}
          >
            {targetCountry || "Select your target country..."}
            <ChevronDown className={cn("text-slate-400 transition-transform", isCountryDropdownOpen && "rotate-180")} size={14} />
          </button>
           {isCountryDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto">
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
                  {targetCountry === c && <Check size={14} className="text-[#0EA5E9]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language Dropdown */}
        <div className="space-y-1 relative">
          <label className="text-slate-700 text-xs font-semibold ml-1">Target Language</label>
          <button
            type="button"
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className={cn(
              "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-left flex items-center justify-between focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all text-sm",
              !targetLanguage ? "text-slate-400" : "text-slate-900"
            )}
          >
            {targetLanguage || "Select your target language..."}
            <ChevronDown className={cn("text-slate-400 transition-transform", isLangDropdownOpen && "rotate-180")} size={14} />
          </button>
           {isLangDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto">
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
                  {targetLanguage === l && <Check size={14} className="text-[#0EA5E9]" />}
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
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-1.5 mb-3">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white shadow-md shadow-blue-600/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">Affiliate<span className="text-blue-600">Finder.ai</span></span>
        </div>
        
        <h1 className="text-lg md:text-xl text-slate-900 font-medium tracking-tight mb-1">
          Nice to meet you, {name.split(' ')[0].toLowerCase()}!
        </h1>
        <p className="text-slate-500 text-xs">
          Let's personalize your results in under a minute.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 2 ? "bg-blue-300" : "bg-slate-100",
              i === 2 && "bg-[#0EA5E9]"
            )} 
           />
        ))}
      </div>

      <div className="mb-4">
         <span className="text-slate-400 text-xs">Question 2</span>
      </div>

      {/* Question Block */}
      <div className="space-y-4">
        <div className="flex gap-2.5 items-start">
           <div className="w-7 h-7 rounded-full bg-[#FDE68A]/30 flex items-center justify-center shrink-0 text-[#D97706]">
             <Sparkles size={14} />
          </div>
          <div className="space-y-0.5">
            <p className="text-slate-900 font-medium text-sm leading-relaxed pt-0.5">
              Add your top 5 competitors here
            </p>
            <p className="text-slate-500 text-xs leading-relaxed">
              We'll find all their current affiliates for you - the more competitors you add, the more affiliate we can find!
            </p>
          </div>
        </div>

        {/* Competitor Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input 
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCompetitor())}
              placeholder="Example: theordinary.com..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all placeholder:text-slate-300"
            />
             <button 
              type="button"
              onClick={addCustomCompetitor}
              disabled={!competitorInput.trim() || competitors.length >= 5}
              className="w-9 h-9 rounded-full bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-xs text-slate-400 ml-2">
            {competitors.length} of 5 competitors added
          </p>
        </div>

        {/* Selected & Suggested Grid */}
        <div className="space-y-3">
          <p className="text-slate-900 font-medium text-xs">Here's some we've found for you!</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
            {/* Render Selected First */}
            {competitors.map(comp => {
              const suggestion = SUGGESTED_COMPETITORS.find(s => s.domain === comp);
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => toggleCompetitor(comp)}
                  className="group relative flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-left hover:border-blue-300 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                    {suggestion ? (
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
                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
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
                  className="group flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-left hover:border-slate-300 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
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
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-1.5 mb-3">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white shadow-md shadow-blue-600/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">Affiliate<span className="text-blue-600">Finder.ai</span></span>
        </div>
        
        <h1 className="text-lg md:text-xl text-slate-900 font-medium tracking-tight mb-1">
          Nice to meet you, {name.split(' ')[0].toLowerCase()}!
        </h1>
        <p className="text-slate-500 text-xs">
          Let's personalize your results in under a minute.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 3 ? "bg-blue-300" : "bg-slate-100",
              i === 3 && "bg-[#0EA5E9]"
            )} 
           />
        ))}
      </div>

      <div className="mb-4">
         <span className="text-slate-400 text-xs">Question 3</span>
      </div>

      {/* Question Block */}
      <div className="space-y-4">
        <div className="flex gap-2.5 items-start">
           <div className="w-7 h-7 rounded-full bg-[#FDE68A]/30 flex items-center justify-center shrink-0 text-[#D97706]">
             <MessageSquare size={14} />
          </div>
          <div className="space-y-0.5">
            <p className="text-slate-900 font-medium text-sm leading-relaxed pt-0.5">
              What are your main topics?
            </p>
            <p className="text-slate-500 text-xs leading-relaxed">
              We'll find all the affiliates and influencers creating content on your main topics so you can reach out and partner with them.
            </p>
          </div>
        </div>

        {/* Topic Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTopic())}
              placeholder="Example: best CRMs, best marine collagen, forex brokers..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all placeholder:text-slate-300"
            />
             <button 
              type="button"
              onClick={addCustomTopic}
              disabled={!topicInput.trim() || topics.length >= 10}
              className="w-9 h-9 rounded-full bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-xs text-slate-400 ml-2">
            {topics.length} of 10 topics added
          </p>
        </div>

        {/* Selected & Suggested List */}
        <div className="space-y-3">
          <p className="text-slate-900 font-medium text-xs">Here's some we've found for you!</p>
          
          <div className="flex flex-wrap gap-1.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
            {/* Render Selected First */}
            {topics.map(topic => (
               <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all text-left"
                >
                  {topic}
                   <div className="w-3.5 h-3.5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
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
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-1.5 mb-3">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white shadow-md shadow-blue-600/10">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">Affiliate<span className="text-blue-600">Finder.ai</span></span>
        </div>
        
        <h1 className="text-lg md:text-xl text-slate-900 font-medium tracking-tight mb-1">
          Nice to meet you, {name.split(' ')[0].toLowerCase()}!
        </h1>
        <p className="text-slate-500 text-xs">
          Let's personalize your results in under a minute.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
           <div 
            key={i} 
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-500",
              i <= 4 ? "bg-blue-300" : "bg-slate-100",
              i === 4 && "bg-[#0EA5E9]"
            )} 
           />
        ))}
      </div>

      <div className="mb-4">
         <span className="text-slate-400 text-xs">Question 4</span>
      </div>

      {/* Question Block */}
      <div className="space-y-4">
        <div className="flex gap-2.5 items-start">
           <div className="w-7 h-7 rounded-full bg-[#FDE68A]/30 flex items-center justify-center shrink-0 text-[#D97706]">
             <MousePointerClick size={14} />
          </div>
          <div className="space-y-0.5">
            <p className="text-slate-900 font-medium text-sm leading-relaxed pt-0.5">
              Which types of affiliates are you most looking to recruit?
            </p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Select several
            </p>
          </div>
        </div>

        {/* Affiliate Types Grid */}
        <div className="grid grid-cols-2 gap-2">
          {AFFILIATE_TYPES.map((type) => {
            const isSelected = affiliateTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleAffiliateType(type)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left group",
                  isSelected 
                    ? "bg-white border-[#0EA5E9] shadow-sm ring-1 ring-[#0EA5E9] text-slate-900" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                  isSelected 
                    ? "bg-[#0EA5E9] border-[#0EA5E9] text-white" 
                    : "border-slate-300 group-hover:border-[#0EA5E9]"
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F0F2F5] font-sans py-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-sm p-6 mx-4 relative overflow-hidden max-h-[90vh] flex flex-col">
        
        <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="flex-1 flex flex-col overflow-hidden">
           <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
             {step === 1 && renderStep1()}
             {step === 2 && renderStep2()}
             {step === 3 && renderStep3()}
             {step === 4 && renderStep4()}
             {step === 5 && renderStep5()}
           </div>

           {/* Submit Button */}
          <div className="pt-5 mt-auto shrink-0">
            <button
              type="submit"
              disabled={
                (step === 1 && (!name || !role || !brand)) ||
                (step === 2 && (!targetCountry || !targetLanguage)) || 
                isLoading
              }
              className={cn(
                "py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 min-w-[120px]",
                step === 1 
                   ? (!name || !role || !brand ? "bg-slate-100 text-slate-400 cursor-not-allowed w-full py-3 rounded-full" : "bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] w-full py-3 rounded-full")
                   : (!targetCountry || !targetLanguage || isLoading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0]")
              )}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                 step === 5 ? "Let's get started" : (step === 1 ? "Continue" : "Next")
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
