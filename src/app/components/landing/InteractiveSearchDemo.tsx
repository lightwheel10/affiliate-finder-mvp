'use client';

import React, { useState, useEffect } from 'react';
import { Search, Mail, Check, Globe, Youtube, Instagram, ArrowRight, Sparkles, Loader2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'IDLE' | 'TYPING' | 'SEARCHING' | 'ANALYZING' | 'COMPLETE';
type Tab = 'All' | 'Web' | 'YouTube' | 'Instagram' | 'Reddit';

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
    platform: 'Reddit',
    title: 'r/SkincareAddicts',
    subtitle: 'Community • 2.1M Members',
    eng: 'High',
    email: null,
    avatarGradient: 'from-orange-500 to-red-500',
    initials: 'SA'
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

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden backdrop-blur-sm transform transition-all duration-500 hover:shadow-2xl">
        {/* Browser Header - Hidden on very small screens */}
        <div className="hidden sm:flex h-8 md:h-10 bg-slate-50/80 border-b border-slate-100 items-center px-3 md:px-4 gap-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-red-400/80"></div>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-amber-400/80"></div>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-400/80"></div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-3/5 h-5 md:h-6 bg-white rounded-md border border-slate-200/80 flex items-center px-2 gap-2 text-[9px] md:text-[10px] text-slate-400 font-medium shadow-sm">
              <Search size={9} className="md:w-[10px] md:h-[10px]" />
              <span className="truncate">affiliatefinder.ai/scout</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-5 md:p-6 h-[360px] sm:h-[400px] md:h-[440px] flex flex-col relative">
          
          {/* Search Input Area */}
          <div className="relative mb-4 sm:mb-6 z-10">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <AnimatePresence mode="wait">
                {step === 'SEARCHING' || step === 'ANALYZING' ? (
                   <motion.div
                     key="loader"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.8 }}
                   >
                     <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 animate-spin" />
                   </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input
              disabled
              value={text}
              className="block w-full pl-10 sm:pl-11 pr-16 sm:pr-20 py-2.5 sm:py-3.5 bg-slate-50 border-slate-200 rounded-lg sm:rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-xs sm:text-sm shadow-sm"
              placeholder="Enter a niche or keyword..."
            />
            {step === 'TYPING' && (
              <motion.div
                layoutId="cursor"
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 sm:h-5 bg-blue-500"
                style={{ left: `${40 + (text.length * 7)}px` }}
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              />
            )}
            <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2">
               <button className={`px-2.5 sm:px-3 py-1.5 rounded-md sm:rounded-lg text-xs font-semibold transition-all duration-300 ${text.length > 5 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-200 text-slate-400'}`}>
                 Scout
               </button>
            </div>
          </div>

          {/* Status Bar / Tabs */}
          <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-slate-100 pb-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
             {(['All', 'Web', 'YouTube', 'Instagram', 'Reddit'] as Tab[]).map((tab) => (
               <div
                 key={tab}
                 className={`relative text-[11px] sm:text-xs font-medium pb-2 cursor-default transition-colors whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-400'}`}
               >
                 {tab}
                 {activeTab === tab && (
                   <motion.div
                     layoutId="activeTab"
                     className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                   />
                 )}
               </div>
             ))}

             {/* Status Indicators */}
             <div className="ml-auto flex items-center gap-2 shrink-0">
               <AnimatePresence mode="wait">
                 {step === 'SEARCHING' && (
                    <motion.div
                      key="scanning"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-[10px] sm:text-xs text-blue-600 font-medium flex items-center gap-1"
                    >
                      <Sparkles size={10} className="sm:w-3 sm:h-3" />
                      <span className="hidden sm:inline">Scanning...</span>
                    </motion.div>
                 )}
                 {step === 'ANALYZING' && (
                    <motion.div
                      key="analyzing"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-[10px] sm:text-xs text-orange-600 font-medium flex items-center gap-1"
                    >
                      <Loader2 size={10} className="animate-spin sm:w-3 sm:h-3" />
                      <span className="hidden sm:inline">Analyzing...</span>
                    </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>

          {/* Results List */}
          <div className="flex-1 space-y-2 sm:space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            <AnimatePresence mode="popLayout">
              {/* Empty State */}
              {(step === 'IDLE' || step === 'TYPING') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pt-12"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Search className="text-slate-300" size={18} />
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm px-4">Enter a niche to find affiliates</p>
                </motion.div>
              )}

              {/* Loading Skeletons - Only show when searching */}
              {step === 'SEARCHING' && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="space-y-2 sm:space-y-3"
                 >
                   {[1, 2, 3].map((i) => (
                     <div key={i} className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 bg-white shadow-sm">
                       <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                       <div className="flex-1 space-y-2">
                         <div className="h-3 sm:h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
                         <div className="h-2.5 sm:h-3 w-1/4 bg-slate-50 rounded animate-pulse" />
                       </div>
                     </div>
                   ))}
                 </motion.div>
              )}

              {/* Real Results */}
              {visibleResults.map((result) => (
                  <motion.div
                    layout
                    key={result.id}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="group relative bg-white active:bg-slate-50/50 border border-slate-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 flex items-center gap-3 sm:gap-4 transition-all shadow-sm active:shadow-md active:border-blue-100 touch-manipulation"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${result.avatarGradient} flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-sm`}>
                        {result.initials}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-white rounded-full p-0.5 shadow-sm z-10">
                        {result.platform === 'Instagram' && <Instagram size={9} className="text-pink-600 sm:w-[10px] sm:h-[10px]" />}
                        {result.platform === 'YouTube' && <Youtube size={9} className="text-red-600 sm:w-[10px] sm:h-[10px]" />}
                        {result.platform === 'Web' && <Globe size={9} className="text-blue-600 sm:w-[10px] sm:h-[10px]" />}
                        {result.platform === 'Reddit' && <MessageCircle size={9} className="text-orange-600 sm:w-[10px] sm:h-[10px]" />}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                        <h4 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{result.title}</h4>
                        {result.eng && (
                          <span className="shrink-0 text-[9px] sm:text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                            {result.eng}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate">{result.subtitle}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                       {/* Email Status - Hidden on very small screens */}
                       <motion.div
                         initial={{ width: 0, opacity: 0 }}
                         animate={{ width: "auto", opacity: 1 }}
                         className="overflow-hidden hidden xs:block"
                       >
                         {result.email ? (
                           <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100 whitespace-nowrap">
                             <Mail size={10} className="sm:w-3 sm:h-3" />
                             <span className="text-[9px] sm:text-[10px] font-medium hidden sm:inline">Found</span>
                           </div>
                         ) : (
                            <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 bg-slate-50 text-slate-400 rounded-md border border-slate-100 whitespace-nowrap">
                              <Search size={10} className="sm:w-3 sm:h-3" />
                              <span className="text-[9px] sm:text-[10px] font-medium hidden sm:inline">No Email</span>
                            </div>
                         )}
                       </motion.div>

                       <button className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 active:text-blue-600 active:bg-blue-50 rounded-lg transition-colors touch-manipulation">
                         <ArrowRight size={14} />
                       </button>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>

          {/* Footer Stats (Only show when done) */}
          <AnimatePresence>
            {step === 'COMPLETE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-auto pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400"
              >
                 <div className="flex gap-2 sm:gap-3">
                   <span>
                     <strong className="text-slate-700">{visibleResults.length}</strong> <span className="hidden xs:inline">Results</span>
                   </span>
                   <span className="hidden sm:inline">0.8s Search Time</span>
                 </div>
                 <div className="flex items-center gap-1 text-green-600 font-medium">
                   <Check size={9} className="sm:w-[10px] sm:h-[10px]" />
                   <span className="hidden xs:inline">Analysis</span> Complete
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};
