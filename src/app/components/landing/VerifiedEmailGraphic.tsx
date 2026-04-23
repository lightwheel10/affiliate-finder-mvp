'use client';

/**
 * =============================================================================
 * VERIFIED EMAIL GRAPHIC — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Animated email verification visualization used in a BentoCard. Shows a
 * sample affiliate contact running through 2 verification steps on hover.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened visual language per landing refresh brief.
 *   Card is rounded-xl with a soft drop shadow (yellow tint on hover) —
 *   previously a sharp border-2 black box with an offset shadow. Avatar
 *   becomes rounded-full. Verification grid separators use a soft hairline.
 *   Animation state + step timing UNCHANGED.
 *
 * - January 10th, 2026: i18n migration (useLanguage hook).
 * - January 9th, 2026: Neo-brutalist pass (superseded).
 * - January 5th, 2026: Real affiliate data (replaces skeleton placeholders).
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

      {/* Main Card — rounded-xl with soft shadow (April 23rd, 2026).
          Was: sharp border-2 black with offset 4px black shadow (yellow on
          hover). Now: soft drop shadow baseline, yellow-tinted shadow lift
          on hover. Reduced bottom margin kept from Jan 13, 2026. */}
      <div className="absolute inset-x-6 top-0 bottom-16 flex flex-col items-center justify-center">
        <motion.div
          className="relative w-full max-w-[240px] bg-white dark:bg-[#1a1a1a] rounded-xl ring-1 ring-[#e6ebf1] dark:ring-gray-700 overflow-hidden"
          animate={isHovered
            ? { y: -4, boxShadow: "0 16px 40px -12px rgba(255,191,35,0.4)" }
            : { y: 0, boxShadow: "0 6px 16px -6px rgba(16,24,40,0.10)" }
          }
        >
            {/* Affiliate Contact Header — soft divider (April 23rd, 2026) */}
            <div className="flex items-center p-3 gap-3 border-b border-[#e6ebf1] dark:border-gray-700">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors duration-300",
                  isHovered
                    ? "bg-[#ffbf23]/20 text-[#0f172a] dark:text-white ring-2 ring-[#ffbf23]/40"
                    : "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 ring-1 ring-[#e6ebf1] dark:ring-gray-700"
                )}>
                    {sampleAffiliate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                    <div className={cn(
                      "text-[11px] font-semibold truncate transition-colors duration-300",
                      isHovered ? "text-[#0f172a] dark:text-white" : "text-[#425466] dark:text-gray-300"
                    )}>
                      {sampleAffiliate.name}
                    </div>
                    <div className="text-[9px] text-[#8898aa] dark:text-gray-500 truncate flex items-center gap-1 font-medium">
                      <Mail size={8} />
                      {sampleAffiliate.email}
                    </div>
                </div>
            </div>

            {/* Verification Grid — soft hairline separators (April 23rd, 2026).
                Simplified to domain + smtp (January 13th, 2026). */}
            <div className="grid grid-cols-2 gap-px bg-[#e6ebf1] dark:bg-gray-700">
                {verificationSteps.map((item, i) => (
                    <div key={item.id} className="bg-white dark:bg-[#1a1a1a] p-2 flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-[#8898aa] dark:text-gray-400 uppercase tracking-wider">{item.label}</span>
                        <div className="w-3 h-3 flex items-center justify-center">
                            {isHovered && step > i ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <Check size={10} className="text-emerald-500" strokeWidth={3} />
                                </motion.div>
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e6ebf1] dark:bg-gray-600" />
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
