'use client';

/**
 * =============================================================================
 * INTERACTIVE SEARCH DEMO — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Last Updated: April 23rd, 2026
 *
 * Animated hero visual. Types a query, shows loading states, and reveals
 * affiliate results one by one, then cycles through tab filters.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened visual language per landing refresh brief.
 *   Browser frame is rounded-2xl with a soft drop shadow (yellow tint on
 *   hover) — replaces the sharp border-2 black frame + offset shadow. All
 *   inner cards (input, result rows, skeletons, empty state, email badges)
 *   use rounded corners + hairline #e6ebf1 borders. Active-tab underline
 *   uses the yellow→amber gradient. Avatars are rounded-full circles.
 *
 *   ANIMATION LOGIC UNCHANGED — useEffect state machine, AnimatePresence
 *   reveals, and tab cycling are all preserved byte-for-byte. Only class
 *   names / shadow tokens were edited.
 *
 * - January 9th, 2026: Neo-brutalist pass + i18n support (superseded).
 *
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Search, Mail, Check, Globe, Youtube, Instagram, ArrowRight, Loader2, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

type Step = 'IDLE' | 'TYPING' | 'SEARCHING' | 'ANALYZING' | 'COMPLETE';
type Tab = 'All' | 'Web' | 'YouTube' | 'Instagram' | 'TikTok';

const DEMO_RESULTS = [
  {
    id: 1,
    platform: 'Instagram',
    title: 'Jessica Daily',
    subtitle: 'Lifestyle • 125k Followers',
    eng: '9.2%',
    email: 'jessica@daily-creators.com',
    avatarGradient: 'from-orange-400 to-pink-500',
    initials: 'JD'
  },
  {
    id: 2,
    platform: 'YouTube',
    title: 'Eco Living Tips',
    subtitle: 'Sustainability • 45k Subs',
    eng: '5.4%',
    email: 'collab@ecoliving.com',
    avatarGradient: 'from-red-500 to-red-600',
    initials: 'EL'
  },
  {
    id: 3,
    platform: 'Web',
    title: 'The Organic Way',
    subtitle: 'organicway.com • 85k Visits',
    eng: null,
    email: 'hello@organicway.com',
    avatarGradient: 'from-blue-500 to-blue-600',
    initials: 'OW'
  },
  {
    id: 4,
    platform: 'TikTok',
    title: '@skincare_queen',
    subtitle: 'Beauty • 1.2M Followers',
    eng: '12.5%',
    email: 'skincare@creators.co',
    avatarGradient: 'from-pink-500 to-cyan-400',
    initials: 'SQ'
  },
  {
    id: 5,
    platform: 'Instagram',
    title: 'Glow By Sarah',
    subtitle: 'Beauty • 210k Followers',
    eng: '4.8%',
    email: 'sarah.glow@agency.com',
    avatarGradient: 'from-purple-500 to-pink-500',
    initials: 'GS'
  }
];

export const InteractiveSearchDemo = () => {
  const [step, setStep] = useState<Step>('IDLE');
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [analyzedIds, setAnalyzedIds] = useState<number[]>([]);
  
  // i18n translations (January 9th, 2026)
  const { t } = useLanguage();
  
  // We want to demonstrate filtering, so let's just show everything when "COMPLETE"
  // and filter by tab visually.
  
  const fullText = "organic skincare influencers";

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const runSequence = async () => {
      // 1. Start Typing
      if (step === 'IDLE') {
        timer = setTimeout(() => setStep('TYPING'), 1000);
      }

      // 2. Typing Effect
      if (step === 'TYPING') {
        if (text.length < fullText.length) {
          timer = setTimeout(() => {
            setText(fullText.slice(0, text.length + 1));
          }, 40); // Faster typing
        } else {
          timer = setTimeout(() => setStep('SEARCHING'), 400);
        }
      }

      // 3. Searching (Loading State)
      if (step === 'SEARCHING') {
        timer = setTimeout(() => setStep('ANALYZING'), 1200);
      }

      // 4. Analyzing (Reveal items one by one)
      if (step === 'ANALYZING') {
        if (analyzedIds.length < DEMO_RESULTS.length) {
          timer = setTimeout(() => {
            setAnalyzedIds(prev => [...prev, DEMO_RESULTS[prev.length].id]);
          }, 400); // Faster reveals
        } else {
          timer = setTimeout(() => setStep('COMPLETE'), 800);
        }
      }
      
      // 5. Demonstrate Tab Switching (Auto)
      if (step === 'COMPLETE') {
         // Wait a bit on 'All', then switch
         if (activeTab === 'All') {
            timer = setTimeout(() => setActiveTab('Instagram'), 2500);
         } else if (activeTab === 'Instagram') {
            timer = setTimeout(() => setActiveTab('YouTube'), 2500);
         } else if (activeTab === 'YouTube') {
            timer = setTimeout(() => {
               // Reset everything
               setStep('IDLE');
               setText("");
               setAnalyzedIds([]);
               setActiveTab('All');
            }, 3000);
         }
      }
    };

    runSequence();
    return () => clearTimeout(timer);
  }, [step, text, analyzedIds, activeTab]);

  // Filter results based on active tab
  const visibleResults = DEMO_RESULTS.filter(r => 
    activeTab === 'All' || r.platform === activeTab
  ).filter(r => analyzedIds.includes(r.id));

  // April 23rd, 2026: Browser mock is now rounded-2xl with a soft drop
  // shadow. Yellow glow intensifies on hover (replaces offset brutalist
  // shadow). Animation logic below is identical to pre-refresh.
  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Main Container — rounded-2xl + soft shadow (April 23rd, 2026) */}
      <div className="bg-white dark:bg-[#111] rounded-2xl ring-1 ring-[#e6ebf1] dark:ring-gray-800 shadow-[0_25px_60px_-15px_rgba(16,24,40,0.15),0_10px_25px_-10px_rgba(16,24,40,0.08)] hover:shadow-[0_30px_70px_-15px_rgba(255,191,35,0.3),0_12px_28px_-10px_rgba(16,24,40,0.1)] overflow-hidden backdrop-blur-sm transform transition-all duration-500 hover:-translate-y-1">
        {/* Browser Header — soft divider + rounded URL bar (April 23rd, 2026) */}
        <div className="h-10 bg-[#f6f9fc] dark:bg-[#1a1a1a] border-b border-[#e6ebf1] dark:border-gray-800 flex items-center px-4 gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-3/5 h-6 bg-white dark:bg-[#222] rounded-md border border-[#e6ebf1] dark:border-gray-700 flex items-center px-2 gap-2 text-[10px] text-[#8898aa] dark:text-gray-400 font-medium">
              <Search size={10} />
              <span>afforceone.com/scout</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 h-[440px] flex flex-col relative">

          {/* Search Input Area — rounded-xl (April 23rd, 2026) */}
          <div className="relative mb-6 z-10">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <AnimatePresence mode="wait">
                {step === 'SEARCHING' || step === 'ANALYZING' ? (
                   <motion.div
                     key="loader"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.8 }}
                   >
                     <Loader2 className="h-5 w-5 text-[#ffbf23] animate-spin" />
                   </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Search className="h-5 w-5 text-[#8898aa] dark:text-gray-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Input container — rounded-xl with soft fill (April 23rd, 2026) */}
            <div className="relative w-full pl-11 pr-4 py-3.5 bg-[#f3f5f8] dark:bg-[#1a1a1a] rounded-xl ring-1 ring-[#e6ebf1] dark:ring-gray-700 min-h-[48px] flex items-center">
              <span className="font-semibold text-sm text-[#0f172a] dark:text-white whitespace-pre">
                {text}
                {step === 'TYPING' && (
                  <motion.span
                    className="inline-block w-[2px] h-5 bg-[#ffbf23] ml-[1px] align-middle"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                )}
              </span>
              {!text && step !== 'TYPING' && (
                <span className="text-[#8898aa] dark:text-gray-500 font-medium text-sm">{t.landing.demo.searchPlaceholder}</span>
              )}
            </div>
            {/* Scout Button — rounded-full with soft yellow glow (April 23rd, 2026) */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
               <button className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full transition-all duration-300 ${
                 text.length > 5
                   ? 'bg-[#ffbf23] text-[#0f172a] shadow-[0_4px_12px_-2px_rgba(255,191,35,0.5)]'
                   : 'bg-[#f6f9fc] dark:bg-gray-700 text-[#8898aa] dark:text-gray-500 ring-1 ring-[#e6ebf1] dark:ring-gray-600'
               }`}>
                 {t.landing.demo.scoutButton}
               </button>
            </div>
          </div>

          {/* Status Bar / Tabs — soft divider + gradient underline (April 23rd, 2026) */}
          <div className="flex items-center gap-4 mb-6 border-b border-[#e6ebf1] dark:border-gray-800 pb-2 overflow-hidden">
             {(['All', 'Web', 'YouTube', 'Instagram', 'TikTok'] as Tab[]).map((tab) => (
               <div
                 key={tab}
                 className={`relative text-xs font-semibold pb-2 cursor-default transition-colors uppercase tracking-wide ${activeTab === tab ? 'text-[#0f172a] dark:text-white' : 'text-[#8898aa] dark:text-gray-500'}`}
               >
                 {tab}
                 {activeTab === tab && (
                   <motion.div
                     layoutId="activeTab"
                     className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#ffbf23] to-[#e5ac20]"
                   />
                 )}
               </div>
             ))}

             {/* Status Indicators */}
             <div className="ml-auto flex items-center gap-2">
               <AnimatePresence mode="wait">
                 {step === 'SEARCHING' && (
                    <motion.div
                      key="scanning"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-xs text-[#0f172a] dark:text-white font-semibold flex items-center gap-1.5"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ffbf23] shadow-[0_0_0_3px_rgba(255,191,35,0.2)]"></div>
                      {t.landing.demo.scanning}
                    </motion.div>
                 )}
                 {step === 'ANALYZING' && (
                    <motion.div
                      key="analyzing"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-xs text-[#425466] dark:text-gray-300 font-semibold flex items-center gap-1.5"
                    >
                      <Loader2 size={12} className="animate-spin text-[#ffbf23]" />
                      {t.landing.demo.analyzing}
                    </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>

          {/* Results List */}
          <div className="flex-1 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            <AnimatePresence mode="popLayout">
              {/* Empty State — rounded + soft (April 23rd, 2026) */}
              {(step === 'IDLE' || step === 'TYPING') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pt-12"
                >
                  <div className="w-12 h-12 rounded-full bg-[#f6f9fc] dark:bg-gray-800 ring-1 ring-[#e6ebf1] dark:ring-gray-700 flex items-center justify-center mb-3">
                    <Search className="text-[#8898aa] dark:text-gray-600" size={20} />
                  </div>
                  <p className="text-[#8898aa] dark:text-gray-500 text-sm font-medium">{t.landing.demo.emptyState}</p>
                </motion.div>
              )}

              {/* Loading Skeletons — rounded (April 23rd, 2026) */}
              {step === 'SEARCHING' && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="space-y-3"
                 >
                   {[1, 2, 3].map((i) => (
                     <div key={i} className="flex items-center gap-4 p-3 rounded-xl ring-1 ring-[#e6ebf1] dark:ring-gray-700 bg-white dark:bg-[#1a1a1a]">
                       <div className="w-10 h-10 rounded-full bg-[#f6f9fc] dark:bg-gray-800 animate-pulse" />
                       <div className="flex-1 space-y-2">
                         <div className="h-4 w-1/3 rounded bg-[#f6f9fc] dark:bg-gray-800 animate-pulse" />
                         <div className="h-3 w-1/4 rounded bg-[#f6f9fc]/60 dark:bg-gray-700 animate-pulse" />
                       </div>
                     </div>
                   ))}
                 </motion.div>
              )}

              {/* Real Results — rounded cards + soft shadow on hover (April 23rd, 2026) */}
              {visibleResults.map((result) => (
                  <motion.div
                    layout
                    key={result.id}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="group relative bg-white dark:bg-[#1a1a1a] hover:bg-[#ffbf23]/5 dark:hover:bg-[#ffbf23]/10 rounded-xl ring-1 ring-[#e6ebf1] dark:ring-gray-700 hover:ring-[#ffbf23]/50 p-3 flex items-center gap-4 transition-all hover:shadow-[0_8px_20px_-6px_rgba(255,191,35,0.25)]"
                  >
                    {/* Avatar — rounded-full (April 23rd, 2026) */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${result.avatarGradient} flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800`}>
                        {result.initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#222] rounded-full ring-1 ring-[#e6ebf1] dark:ring-gray-700 p-0.5 z-10">
                        {result.platform === 'Instagram' && <Instagram size={10} className="text-pink-600" />}
                        {result.platform === 'YouTube' && <Youtube size={10} className="text-red-600" />}
                        {result.platform === 'Web' && <Globe size={10} className="text-blue-600" />}
                        {result.platform === 'TikTok' && <Music size={10} className="text-pink-500" />}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-semibold text-[#0f172a] dark:text-white text-sm truncate">{result.title}</h4>
                        {result.eng && (
                          <span className="shrink-0 text-[10px] font-semibold text-[#0f172a] dark:text-white bg-[#ffbf23]/15 px-1.5 py-0.5 rounded-full ring-1 ring-[#ffbf23]/40">
                            {result.eng} Eng.
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8898aa] dark:text-gray-400 truncate">{result.subtitle}</p>
                    </div>

                    {/* Actions — rounded pills (April 23rd, 2026) */}
                    <div className="flex items-center gap-2 shrink-0">
                       <motion.div
                         initial={{ width: 0, opacity: 0 }}
                         animate={{ width: "auto", opacity: 1 }}
                         className="overflow-hidden"
                       >
                         {result.email ? (
                           <div className="flex items-center gap-1.5 px-2 py-1 bg-[#ffbf23]/15 text-[#0f172a] rounded-full ring-1 ring-[#ffbf23]/50 whitespace-nowrap">
                             <Mail size={12} />
                             <span className="text-[10px] font-semibold">{t.landing.demo.emailFound}</span>
                           </div>
                         ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-500 rounded-full ring-1 ring-[#e6ebf1] dark:ring-gray-700 whitespace-nowrap">
                              <Search size={12} />
                              <span className="text-[10px] font-semibold">{t.landing.demo.noEmail}</span>
                            </div>
                         )}
                       </motion.div>

                       <button className="p-2 rounded-full text-[#8898aa] dark:text-gray-600 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#ffbf23]/15 transition-colors">
                         <ArrowRight size={14} />
                       </button>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>

          {/* Footer Stats — soft (April 23rd, 2026) */}
          <AnimatePresence>
            {step === 'COMPLETE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-auto pt-3 border-t border-[#e6ebf1] dark:border-gray-800 flex items-center justify-between text-[10px] text-[#8898aa] dark:text-gray-500"
              >
                 <div className="flex gap-3 font-medium">
                   <span>
                     <strong className="text-[#0f172a] dark:text-white font-semibold">{visibleResults.length}</strong> {t.landing.demo.resultsVisible}
                   </span>
                   <span>{t.landing.demo.searchTime}</span>
                 </div>
                 <div className="flex items-center gap-1 text-[#0f172a] dark:text-white font-semibold uppercase tracking-wide">
                   <Check size={10} className="text-[#ffbf23]" />
                   {t.landing.demo.analysisComplete}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};
