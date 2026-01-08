'use client';

/**
 * =============================================================================
 * SCAN COUNTDOWN COMPONENT - Updated January 6th, 2026
 * =============================================================================
 * 
 * DESIGN UPDATE: Neo-brutalist style from DashboardDemo.tsx
 * - Uses brand yellow (#ffbf23) instead of lime green (#D4E815)
 * - Simple, industrial styling without complex gradients
 * - Font-mono for timer display
 * 
 * This component now renders just the time/PRO badge portion.
 * The container with "NEXT SCAN" label is in the parent page headers.
 * =============================================================================
 */

import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { PricingModal } from './PricingModal';
import { useNeonUser } from '../hooks/useNeonUser';
import { useSubscription } from '../hooks/useSubscription';

export function ScanCountdown() {
  const [isHovered, setIsHovered] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  
  // Get user and subscription data for PricingModal
  const { userId } = useNeonUser();
  const { subscription, refetch } = useSubscription(userId);

  return (
    <>
      {/* Neo-brutalist countdown - just the timer portion */}
      <span 
        className="relative cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsPricingOpen(true)}
      >
        {/* Blurred timer with lock overlay */}
        <span className="relative inline-flex items-center">
          {/* Blurred numbers */}
          <span className="blur-[2px] opacity-40 select-none font-mono text-xs">
            07:12:45
          </span>
          
          {/* Lock overlay */}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className={`flex items-center gap-1 transition-all duration-200 ${isHovered ? 'scale-110' : ''}`}>
              <Lock size={10} className="text-[#ffbf23]" />
              {isHovered && <Sparkles size={10} className="text-[#ffbf23] animate-pulse" />}
            </span>
          </span>
        </span>
      </span>
    
      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        userId={userId}
        currentPlan={subscription?.plan || null}
        currentBillingInterval={subscription?.billing_interval || null}
        isTrialing={subscription?.isTrialing || false}
        onSuccess={refetch}
      />
    </>
  );
}
