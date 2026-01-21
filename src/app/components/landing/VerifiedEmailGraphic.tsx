'use client';

/**
 * =============================================================================
 * VERIFIED EMAIL GRAPHIC - NEO-BRUTALIST
 * =============================================================================
 * 
 * Displays an animated email verification visualization for the BentoGrid
 * feature section. Shows a sample affiliate contact being verified.
 * 
 * CHANGELOG:
 * - January 10th, 2026: i18n Migration - Remaining Components
 *   - Added useLanguage hook for translations
 *   - Translated verification step labels and "Verified Deliverable" text
 * 
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Sharp edges on card and avatar (removed rounded-xl, rounded-full)
 *   - Bold borders (border-2)
 *   - Updated color from #D4E815 to #ffbf23 (brand yellow)
 *   - Sharp success banner
 * 
 * - January 5th, 2026: Replaced skeleton placeholders with actual affiliate data
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * 
 * =============================================================================
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Mail, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface VerifiedEmailGraphicProps {
  isHovered?: boolean;
}

/**
 * Sample affiliate contact for email verification demo
 */
const sampleAffiliate = {
  name: "Jessica Parker",
  email: "jessica@beautyinfluence.co",
  platform: "Instagram",
  followers: "156K"
};

export const VerifiedEmailGraphic = ({ isHovered = false }: VerifiedEmailGraphicProps) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  // Verification steps that animate on hover (January 10th, 2026 - now uses translations)
  // Simplified to only domain and smtp (January 13th, 2026)
  const verificationSteps = [
    { id: 1, label: t.landingGraphics.verifiedEmail.domain, status: "verified", delay: 200 },
    { id: 2, label: t.landingGraphics.verifiedEmail.smtp, status: "verified", delay: 500 },
  ];

  useEffect(() => {
    if (isHovered) {
      setStep(0);
      const interval = setInterval(() => {
        // Updated to 2 steps (January 13th, 2026)
        setStep(s => (s < 2 ? s + 1 : s));
      }, 250);
      return () => clearInterval(interval);
    } else {
      setStep(0);
    }
  }, [isHovered]);

  // January 22nd, 2026: Added dark mode support
  return (
    <div className="absolute inset-0 overflow-hidden bg-white dark:bg-[#111]">
      {/* Background Pattern - NEO-BRUTALIST (January 9th, 2026) */}
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#ffbf23 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Main Card - NEO-BRUTALIST (January 9th, 2026) */}
      {/* Reduced bottom margin to show full card with 10% top offset (January 13th, 2026) */}
      <div className="absolute inset-x-6 top-0 bottom-16 flex flex-col items-center justify-center">
        <motion.div
          className="relative w-full max-w-[240px] bg-white dark:bg-[#1a1a1a] border-2 border-black dark:border-white overflow-hidden"
          animate={isHovered ? { y: -4, x: -4, boxShadow: "4px 4px 0px 0px #ffbf23" } : { y: 0, x: 0, boxShadow: "4px 4px 0px 0px #000000" }}
        >
            {/* Affiliate Contact Header - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
            <div className="flex items-center p-3 gap-3 border-b-2 border-gray-200 dark:border-gray-700">
                <div className={cn(
                  "w-8 h-8 flex items-center justify-center shrink-0 text-[10px] font-black transition-colors duration-300 border",
                  isHovered ? "bg-[#ffbf23]/20 text-[#1A1D21] dark:text-white border-[#ffbf23]" : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                )}>
                    {/* Avatar with initials */}
                    {sampleAffiliate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Affiliate Name - Dark mode: January 22nd, 2026 */}
                    <div className={cn(
                      "text-[11px] font-bold truncate transition-colors duration-300",
                      isHovered ? "text-[#111827] dark:text-white" : "text-slate-600 dark:text-gray-300"
                    )}>
                      {sampleAffiliate.name}
                    </div>
                    {/* Email Address - Dark mode: January 22nd, 2026 */}
                    <div className="text-[9px] text-slate-400 dark:text-gray-500 truncate flex items-center gap-1 font-medium">
                      <Mail size={8} />
                      {sampleAffiliate.email}
                    </div>
                </div>
            </div>
            
            {/* Verification Grid - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
            {/* Simplified to domain and smtp only (January 13th, 2026) */}
            <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700">
                {verificationSteps.map((item, i) => (
                    <div key={item.id} className="bg-white dark:bg-[#1a1a1a] p-2 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase">{item.label}</span>
                        <div className="w-3 h-3 flex items-center justify-center">
                            {isHovered && step > i ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <Check size={10} className="text-green-500" strokeWidth={3} />
                                </motion.div>
                            ) : (
                                <div className="w-1.5 h-1.5 bg-slate-200 dark:bg-gray-600" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>

        {/* Cursor Interaction */}
        <motion.div 
            className="absolute z-20 pointer-events-none text-slate-900 drop-shadow-md"
            initial={{ x: 100, y: 100, opacity: 0 }}
            animate={isHovered ? { x: 60, y: 40, opacity: 1 } : { x: 100, y: 100, opacity: 0 }}
            transition={{ duration: 0.5, ease: "backOut" }}
        >
            <MousePointer2 size={24} fill="currentColor" className="text-slate-900" />
        </motion.div>
      </div>
    </div>
  );
};
