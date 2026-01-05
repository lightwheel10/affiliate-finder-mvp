'use client';

/**
 * DiscoveryGraphic Component
 * 
 * Displays an animated affiliate discovery visualization for the BentoGrid feature section.
 * Shows real affiliate data with hover states that reveal match scores.
 * 
 * Updated: January 5th, 2026 - Replaced skeleton placeholders with actual affiliate data
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscoveryGraphicProps {
  isHovered?: boolean;
}

/**
 * Sample affiliate candidates data
 * Represents discovered affiliates from competitor analysis
 */
const candidates = [
  { id: 1, name: "Sarah Mitchell", niche: "Beauty & Skincare", score: 98, platform: "YouTube", followers: "245K" },
  { id: 2, name: "Marcus Chen", niche: "Tech Reviews", score: 95, platform: "TikTok", followers: "1.2M" },
  { id: 3, name: "Emily Rodriguez", niche: "Lifestyle", score: 92, platform: "Instagram", followers: "89K" },
];

export const DiscoveryGraphic = ({ isHovered = false }: DiscoveryGraphicProps) => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* Abstract Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#D4E815 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Scanner Beam */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4E815] to-transparent z-20 blur-[1px]"
        animate={{
          top: ['15%', '75%'],
          opacity: [0, 1, 1, 0]
        }}
        transition={{
          duration: isHovered ? 1.5 : 3,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Search Status Indicator */}
      <div className="absolute top-2 right-5 flex items-center gap-2 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-[#E5E7EB] z-30">
        {isHovered ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
                <RotateCw size={10} className="text-[#D4E815]" />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
                 <Loader2 size={10} className="text-slate-400" />
            </motion.div>
          </motion.div>
        )}
        <span className="text-[9px] font-semibold text-[#111827] uppercase tracking-wider">
          {isHovered ? 'Scanning...' : 'Indexing'}
        </span>
      </div>

      {/* Content Container - Spanning full width properly */}
      <div className="absolute inset-x-0 top-2 bottom-0 p-5 flex flex-col gap-2.5 mask-image-gradient-wide">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90 z-10 pointer-events-none" />
        
        {candidates.map((candidate, index) => (
          <ProfileRow 
            key={candidate.id} 
            index={index} 
            isHovered={isHovered}
            candidate={candidate}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * ProfileRow Component
 * 
 * Renders an individual affiliate row with avatar, name, niche, platform, and match score.
 * Displays real data in both hover and non-hover states.
 * 
 * Updated: January 5th, 2026 - Shows actual affiliate names and metrics instead of skeleton placeholders
 */
const ProfileRow = ({ index, isHovered, candidate }: { index: number; isHovered: boolean; candidate: typeof candidates[0] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm transition-all duration-300",
        isHovered ? "border-[#D4E815]/50 shadow-md translate-x-1" : "border-[#E5E7EB]"
      )}
    >
      {/* Avatar with initials */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shrink-0 text-[10px] font-bold",
        isHovered ? "bg-[#D4E815]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500"
      )}>
        {/* Extract initials from name */}
        {candidate.name.split(' ').map(n => n[0]).join('')}
      </div>

      {/* Affiliate Info - Real Data */}
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* Affiliate Name */}
          <span className={cn(
            "text-[11px] font-semibold truncate transition-colors duration-300",
            isHovered ? "text-[#111827]" : "text-slate-600"
          )}>
            {candidate.name}
          </span>
          {/* Platform Badge */}
          <span className={cn(
            "text-[8px] font-medium uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded",
            isHovered ? "bg-[#D4E815]/10 text-[#1A1D21]" : "text-slate-400 bg-slate-50"
          )}>
            {candidate.platform}
          </span>
        </div>
        {/* Niche & Followers */}
        <div className="flex items-center gap-2 text-[9px] text-slate-400">
          <span>{candidate.niche}</span>
          <span>•</span>
          <span className={cn(
            "transition-colors duration-300",
            isHovered ? "text-[#1A1D21] font-medium" : ""
          )}>
            {candidate.followers} followers
          </span>
        </div>
      </div>

      {/* Match Score Badge */}
      <div className="flex items-center gap-1 shrink-0 pl-2">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 + (index * 0.1) }}
        >
          <div className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold border transition-all duration-300",
            isHovered 
              ? "bg-[#D4E815]/20 text-[#1A1D21] border-[#D4E815]/40" 
              : "bg-slate-50 text-slate-500 border-slate-100"
          )}>
            {/* Always show score, highlight on hover */}
            {candidate.score}%
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
