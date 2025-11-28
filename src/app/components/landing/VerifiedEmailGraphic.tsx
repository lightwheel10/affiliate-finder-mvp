'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, ShieldCheck, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedEmailGraphicProps {
  isHovered?: boolean;
}

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
    <div className="absolute inset-0 overflow-hidden bg-slate-50/30">
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Main Card */}
      <div className="absolute inset-x-6 top-2 bottom-26 flex flex-col items-center justify-center">
        <motion.div
          className="relative w-full max-w-[240px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          animate={isHovered ? { y: -4, boxShadow: "0 10px 30px -10px rgba(168, 85, 247, 0.15)" } : { y: 0 }}
        >
            <div className="flex items-center p-3 gap-3 border-b border-slate-50">
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
                    <Mail size={14} />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-2 w-20 bg-slate-100 rounded-full" />
                    <div className="h-1.5 w-12 bg-slate-50 rounded-full" />
                </div>
            </div>
            
            {/* Verification Grid */}
            <div className="grid grid-cols-2 gap-px bg-slate-100">
                {verificationSteps.map((item, i) => (
                    <div key={item.id} className="bg-white p-2 flex items-center justify-between">
                        <span className="text-[11px] sm:text-[10px] font-medium text-slate-500">{item.label}</span>
                        <div className="w-4 h-4 sm:w-3 sm:h-3 flex items-center justify-center">
                            {isHovered && step > i ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <Check size={11} className="text-green-500 sm:w-[10px] sm:h-[10px]" strokeWidth={3} />
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
                "bg-green-50 p-2 flex items-center justify-center gap-1.5 transition-all duration-300",
                isHovered && step >= 4 ? "opacity-100" : "opacity-0 h-0 overflow-hidden p-0"
            )}>
                <ShieldCheck size={13} className="text-green-600 sm:w-3 sm:h-3" />
                <span className="text-[11px] sm:text-[10px] font-bold text-green-700">Verified Deliverable</span>
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
