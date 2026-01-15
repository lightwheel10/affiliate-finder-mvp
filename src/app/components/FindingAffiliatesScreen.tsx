/**
 * =============================================================================
 * FindingAffiliatesScreen Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Created: January 15th, 2026
 * Updated: January 15th, 2026 - Simplified to just "Thank you, preparing dashboard"
 * 
 * PURPOSE:
 * This component displays a simple loading screen after payment succeeds.
 * It shows while we pre-fetch affiliate results in the background.
 * 
 * DESIGN DECISION (January 15th, 2026):
 * Client requested a SIMPLE screen with just:
 * - "Thank You!"
 * - "Preparing your dashboard..."
 * - Simple animated loader
 * 
 * No complex step-by-step progress - just a clean, simple thank you message.
 * 
 * =============================================================================
 */

'use client';

import React from 'react';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// TYPES - January 15th, 2026
// =============================================================================

interface FindingAffiliatesScreenProps {
  /** Number of topics being searched (optional, not displayed anymore) */
  topicsCount?: number;
  /** Brand name (optional, not displayed anymore) */
  brandName?: string;
}

// =============================================================================
// COMPONENT - January 15th, 2026 (Simplified)
// =============================================================================

export function FindingAffiliatesScreen({ 
  topicsCount,
  brandName,
}: FindingAffiliatesScreenProps) {
  const { t } = useLanguage();

  return (
    <div className="animate-in fade-in duration-500 text-center">
      {/* Success Checkmark with Animation */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          {/* Pulsing background */}
          <div className="absolute inset-0 w-20 h-20 bg-green-500/20 animate-ping" />
          
          {/* Main checkmark circle */}
          <div className="relative w-20 h-20 bg-green-500 border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000000]">
            <CheckCircle2 size={40} className="text-white" strokeWidth={3} />
          </div>
        </div>
      </div>

      {/* Thank You Title */}
      <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
        {t.findingAffiliates.thankYou}
      </h2>

      {/* Preparing Dashboard Message */}
      <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-8">
        {t.findingAffiliates.preparingDashboard}
      </p>

      {/* Simple Loader */}
      <div className="flex justify-center items-center gap-3">
        <div className="w-10 h-10 bg-[#ffbf23] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000000]">
          <Loader2 size={20} className="text-black animate-spin" />
        </div>
        <span className="text-sm text-gray-500 font-medium">
          {t.findingAffiliates.pleaseWait}
        </span>
      </div>
    </div>
  );
}

export default FindingAffiliatesScreen;
