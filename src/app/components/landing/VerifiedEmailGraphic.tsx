'use client';

/**
 * VerifiedEmailGraphic Component
 * 
 * Displays an animated email verification visualization for the BentoGrid feature section.
 * Shows a sample affiliate contact being verified with real email data.
 * 
 * Updated: January 5th, 2026 - Replaced skeleton placeholders with actual affiliate email data
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, ShieldCheck, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

/**
 * Email verification steps that animate on hover
 */
const verificationSteps = [
  { id: 1, label: "Syntax", status: "verified", delay: 100 },
  { id: 2, label: "Domain", status: "verified", delay: 300 },
  { id: 3, label: "MX", status: "verified", delay: 500 },
  { id: 4, label: "SMTP", status: "verified", delay: 700 },
];

export const VerifiedEmailGraphic = ({ isHovered = false }: VerifiedEmailGraphicProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isHovered) {
      setStep(0);
      const interval = setInterval(() => {
        setStep(s => (s < 4 ? s + 1 : s));
      }, 200);
      return () => clearInterval(interval);
    } else {
      setStep(0);
    }
  }, [isHovered]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#D4E815 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Main Card */}
      <div className="absolute inset-x-6 top-2 bottom-26 flex flex-col items-center justify-center">
        <motion.div
          className="relative w-full max-w-[240px] bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden"
          animate={isHovered ? { y: -4, boxShadow: "0 10px 30px -10px rgba(212, 232, 21, 0.25)" } : { y: 0 }}
        >
            {/* Affiliate Contact Header - Shows real email data */}
            {/* Updated: January 5th, 2026 - Display actual affiliate name and email */}
            <div className="flex items-center p-3 gap-3 border-b border-slate-50">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors duration-300",
                  isHovered ? "bg-[#D4E815]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500"
                )}>
                    {/* Avatar with initials */}
                    {sampleAffiliate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Affiliate Name */}
                    <div className={cn(
                      "text-[11px] font-semibold truncate transition-colors duration-300",
                      isHovered ? "text-[#111827]" : "text-slate-600"
                    )}>
                      {sampleAffiliate.name}
                    </div>
                    {/* Email Address */}
                    <div className="text-[9px] text-slate-400 truncate flex items-center gap-1">
                      <Mail size={8} />
                      {sampleAffiliate.email}
                    </div>
                </div>
            </div>
            
            {/* Verification Grid */}
            <div className="grid grid-cols-2 gap-px bg-slate-100">
                {verificationSteps.map((item, i) => (
                    <div key={item.id} className="bg-white p-2 flex items-center justify-between">
                        <span className="text-[9px] font-medium text-slate-500">{item.label}</span>
                        <div className="w-3 h-3 flex items-center justify-center">
                            {isHovered && step > i ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <Check size={10} className="text-green-500" strokeWidth={3} />
                                </motion.div>
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Success Banner */}
            <div className={cn(
                "bg-[#D4E815]/20 p-2 flex items-center justify-center gap-1.5 transition-all duration-300",
                isHovered && step >= 4 ? "opacity-100" : "opacity-0 h-0 overflow-hidden p-0"
            )}>
                <ShieldCheck size={12} className="text-[#1A1D21]" />
                <span className="text-[10px] font-bold text-[#1A1D21]">Verified Deliverable</span>
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
