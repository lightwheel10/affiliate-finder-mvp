'use client';

/**
 * =============================================================================
 * SCAN COUNTDOWN COMPONENT - January 13th, 2026
 * =============================================================================
 * 
 * MAJOR UPDATE: Transformed from placeholder to real countdown
 * 
 * This component displays the auto-scan countdown timer in the dashboard header.
 * It shows different states based on user's subscription and credit status:
 * 
 * STATES:
 * 1. LOCKED (trialing/unpaid):
 *    - Shows blurred timer with lock icon
 *    - Clicking opens PricingModal to upgrade
 *    - Displayed when: status = 'trialing' OR hasAutoScanAccess = false
 * 
 * 2. NO_CREDITS (paid but no credits):
 *    - Shows "No credits" message
 *    - Clicking opens PricingModal to upgrade for more credits
 *    - Displayed when: hasAutoScanAccess = true AND topicSearches.remaining = 0
 * 
 * 3. ACTIVE (paid with credits):
 *    - Shows real countdown: "6d 23h 45m"
 *    - Updates every minute (no need for second precision)
 *    - Displayed when: hasAutoScanAccess = true AND topicSearches.remaining > 0
 * 
 * 4. SCANNING (scan in progress):
 *    - Shows "Scanning..." when countdown reaches 0 or is negative
 *    - The cron job runs hourly, so there may be a delay
 * 
 * DESIGN: Neo-brutalist style matching the dashboard
 * - Brand yellow (#ffbf23) for highlights
 * - Font-mono for timer display
 * - Simple, industrial styling
 * 
 * =============================================================================
 */

import { useState, useEffect } from 'react';
import { Lock, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { PricingModal } from './PricingModal';
import { useNeonUser } from '../hooks/useNeonUser';
import { useSubscription } from '../hooks/useSubscription';
import { useCredits } from '../hooks/useCredits';
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// TYPES
// =============================================================================

type ScanState = 'loading' | 'locked' | 'no_credits' | 'active' | 'scanning';

// =============================================================================
// COMPONENT
// =============================================================================

export function ScanCountdown() {
  const { t } = useLanguage();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // ==========================================================================
  // DATA HOOKS
  // ==========================================================================
  const { userId } = useNeonUser();
  const { 
    subscription, 
    refetch: refetchSubscription,
    isLoading: subscriptionLoading,
    hasAutoScanAccess,
    nextScanAt,
    timeUntilNextScan,
  } = useSubscription(userId);
  
  const { 
    credits, 
    isLoading: creditsLoading,
    isEnabled: creditsEnabled,
  } = useCredits();

  
  // ==========================================================================
  // LIVE COUNTDOWN STATE
  // We use local state for the countdown that updates every minute
  // ==========================================================================
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    isPast: boolean;
  } | null>(null);
  
  // Update countdown every minute
  useEffect(() => {
    if (!nextScanAt) {
      setCountdown(null);
      return;
    }
    
    const calculateCountdown = () => {
      const now = new Date();
      const diffMs = nextScanAt.getTime() - now.getTime();
      const isPast = diffMs <= 0;
      const absDiffMs = Math.abs(diffMs);
      
      const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      setCountdown({ days, hours, minutes, isPast });
    };
    
    // Calculate immediately
    calculateCountdown();
    
    // Update every minute
    const interval = setInterval(calculateCountdown, 60000);
    
    return () => clearInterval(interval);
  }, [nextScanAt]);
  
  // ==========================================================================
  // DETERMINE CURRENT STATE
  // ==========================================================================
  const getScanState = (): ScanState => {
    // Still loading data
    if (subscriptionLoading || creditsLoading) {
      return 'loading';
    }
    
    // Not paid (trialing or no subscription)
    if (!hasAutoScanAccess) {
      return 'locked';
    }
    
    // Paid but scan is overdue (cron will pick it up soon)
    if (countdown?.isPast) {
      return 'scanning';
    }
    
    // Paid but no credits (only check if credits feature is enabled)
    if (creditsEnabled && credits) {
      const topicCredits = credits.topicSearches;
      if (!topicCredits.unlimited && topicCredits.remaining <= 0) {
        return 'no_credits';
      }
    }
    
    // Paid with credits - show countdown
    return 'active';
  };
  
  const scanState = getScanState();
  
  // ==========================================================================
  // FORMAT COUNTDOWN FOR DISPLAY
  // Updated: January 14th, 2026 - Now shows days, hours, AND minutes
  // ==========================================================================
  const formatCountdown = (): string => {
    if (!countdown) return '--';
    
    const { days, hours, minutes } = countdown;
    
    // Always show days, hours, and minutes for complete visibility
    // Examples: "6d 23h 45m", "0d 5h 30m", "0d 0h 15m"
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    
    // If less than 1 day, show hours and minutes
    // Examples: "5h 30m", "0h 15m"
    return `${hours}h ${minutes}m`;
  };
  
  // ==========================================================================
  // RENDER BASED ON STATE
  // ==========================================================================
  
  // Loading state
  if (scanState === 'loading') {
    return (
      <span className="font-mono text-xs text-neutral-400 animate-pulse">
        --:--
      </span>
    );
  }
  
  // Locked state (trialing/unpaid)
  if (scanState === 'locked') {
    return (
      <>
        <span 
          className="relative cursor-pointer group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsPricingOpen(true)}
        title={t.scanCountdown.upgradeToUnlock}
        >
          {/* Blurred timer with lock overlay */}
          <span className="relative inline-flex items-center">
            {/* Blurred placeholder numbers */}
            <span className="blur-[2px] opacity-40 select-none font-mono text-xs">
              6d 23h
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
          onSuccess={refetchSubscription}
        />
      </>
    );
  }
  
  // No credits state
  if (scanState === 'no_credits') {
    return (
      <>
        <span 
          className="cursor-pointer group flex items-center gap-1"
        onClick={() => setIsPricingOpen(true)}
        title={t.scanCountdown.noCreditsTooltip}
      >
        <AlertCircle size={10} className="text-orange-400" />
        <span className="font-mono text-xs text-orange-400 group-hover:text-orange-300 transition-colors">
          {t.scanCountdown.noCredits}
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
          onSuccess={refetchSubscription}
        />
      </>
    );
  }
  
  // Scanning state (countdown reached 0, waiting for cron)
  if (scanState === 'scanning') {
    return (
      <span 
        className="flex items-center gap-1"
        title={t.scanCountdown.scanningTooltip}
      >
        <RefreshCw size={10} className="text-[#ffbf23] animate-spin" />
        <span className="font-mono text-xs text-[#ffbf23]">
          {t.scanCountdown.scanning}
        </span>
      </span>
    );
  }
  
  // Active state - show real countdown
  return (
    <span 
      className="font-mono text-xs text-neutral-200"
      title={nextScanAt ? `${t.scanCountdown.nextScanAt}: ${nextScanAt.toLocaleString()}` : undefined}
    >
      {formatCountdown()}
    </span>
  );
}
