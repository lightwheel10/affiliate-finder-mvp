'use client';

import { useState } from 'react';
import { Clock, Lock, Sparkles } from 'lucide-react';
import { PricingModal } from './PricingModal';
import { useNeonUser } from '../hooks/useNeonUser';
import { useSubscription } from '../hooks/useSubscription';

export function ScanCountdown() {
  const [isHovered, setIsHovered] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  
  // Get user and subscription data for PricingModal
  const { userId } = useNeonUser();
  const { subscription, refetch } = useSubscription();

  return (
    <>
    <div 
      className="relative bg-[#1A1D21] rounded-lg px-3 py-1.5 text-white overflow-hidden cursor-pointer group transition-all duration-300 hover:ring-1 hover:ring-[#D4E815]/40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsPricingOpen(true)}
    >
      {/* Background pattern */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
      
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
      
      <div className="relative z-10 flex items-center gap-2.5">
        {/* Icon */}
        <div className="p-1 rounded-md backdrop-blur-sm bg-[#D4E815]/20">
          <Clock size={10} className="text-[#D4E815]" />
        </div>
        
        {/* Label */}
        <span className="text-[9px] font-bold tracking-wide uppercase text-white/90 whitespace-nowrap">Next Scan</span>
        
        {/* Separator */}
        <div className="h-4 w-[1px] bg-white/20"></div>
        
        {/* Numbers - Blurred with lock overlay */}
        <div className="relative flex items-center gap-1.5">
          {/* Blurred placeholder numbers */}
          <div className="flex items-center gap-1.5 blur-[3px] opacity-50 select-none">
            <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
              07
            </span>
            <span className="text-[10px] text-white/60 font-bold">:</span>
            <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
              12
            </span>
            <span className="text-[10px] text-white/60 font-bold">:</span>
            <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
              45
            </span>
            <span className="text-[10px] text-white/60 font-bold">:</span>
            <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
              23
            </span>
          </div>
          
          {/* Lock overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex items-center gap-1.5 transition-all duration-300 ${isHovered ? 'scale-105' : ''}`}>
              <Lock size={10} className="text-[#D4E815]" />
              <span className="text-[9px] font-bold text-[#D4E815] uppercase tracking-wider">
                {isHovered ? 'Upgrade' : 'Pro'}
              </span>
              {isHovered && <Sparkles size={10} className="text-[#D4E815] animate-pulse" />}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Pricing Modal */}
    <PricingModal
      isOpen={isPricingOpen}
      onClose={() => setIsPricingOpen(false)}
      userId={userId}
      currentPlan={subscription?.plan || null}
      currentBillingInterval={subscription?.billingInterval || null}
      isTrialing={subscription?.isTrialing || false}
      onSuccess={refetch}
    />
    </>
  );
}
