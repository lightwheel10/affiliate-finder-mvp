'use client';

/**
 * =============================================================================
 * DISCOVERY GRAPHIC - NEO-BRUTALIST
 * =============================================================================
 * 
 * Displays an animated affiliate discovery visualization for the BentoGrid
 * feature section. Shows real affiliate data with hover states that reveal
 * match scores.
 * 
 * CHANGELOG:
 * - January 10th, 2026: i18n Migration - Remaining Components
 *   - Added useLanguage hook for translations
 *   - Translated "Scanning...", "Indexing", "followers" labels
 * 
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Sharp edges on all cards (removed rounded-xl, rounded-full, rounded)
 *   - Bold borders (border-2)
 *   - Updated color from #D4E815 to #ffbf23 (brand yellow)
 *   - Sharp status indicator and badges
 * 
 * - January 5th, 2026: Replaced skeleton placeholders with actual affiliate data
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * 
 * =============================================================================
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();

  return (
    // Removed overflow-hidden to allow INDEXING badge to extend into top space (January 13th, 2026)
    <div className="absolute inset-0 bg-white">
      {/* Abstract Grid Background - NEO-BRUTALIST (January 9th, 2026) */}
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#ffbf23 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Scanner Beam - NEO-BRUTALIST (January 9th, 2026) */}
      <motion.div
        className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#ffbf23] to-transparent z-20"
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
      
      {/* Search Status Indicator - NEO-BRUTALIST (January 9th, 2026) */}
      {/* Positioned at -8% to account for 10% graphic offset in BentoCard (January 13th, 2026) */}
      <div className="absolute -top-[8%] right-5 flex items-center gap-2 px-2 py-1 bg-white border-2 border-black z-30">
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
                <RotateCw size={10} className="text-[#ffbf23]" />
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
        <span className="text-[9px] font-black text-[#111827] uppercase tracking-wider">
          {isHovered ? t.landingGraphics.discovery.scanning : t.landingGraphics.discovery.indexing}
        </span>
      </div>

      {/* Content Container */}
      <div className="absolute inset-x-0 top-2 bottom-0 p-5 flex flex-col gap-2.5 mask-image-gradient-wide">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90 z-10 pointer-events-none" />
        
        {candidates.map((candidate, index) => (
          <ProfileRow 
            key={candidate.id} 
            index={index} 
            isHovered={isHovered}
            candidate={candidate}
            followersLabel={t.landingGraphics.discovery.followers}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * ProfileRow Component - NEO-BRUTALIST (Updated January 9th, 2026)
 * i18n Migration: January 10th, 2026 - Added followersLabel prop
 * 
 * Renders an individual affiliate row with avatar, name, niche, platform, and match score.
 * Displays real data in both hover and non-hover states.
 * 
 * Design changes:
 * - Sharp edges on cards (removed rounded-xl)
 * - Sharp avatars (removed rounded-full)
 * - Sharp badges (removed rounded)
 * - Updated color from #D4E815 to #ffbf23
 */
interface ProfileRowProps {
  index: number;
  isHovered: boolean;
  candidate: typeof candidates[0];
  followersLabel: string;
}

const ProfileRow = ({ index, isHovered, candidate, followersLabel }: ProfileRowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={cn(
        // NEO-BRUTALIST: Sharp edges (January 9th, 2026)
        "relative flex items-center gap-3 p-3 border-2 bg-white transition-all duration-300",
        isHovered ? "border-[#ffbf23] translate-x-1" : "border-gray-200"
      )}
    >
      {/* Avatar with initials - NEO-BRUTALIST (January 9th, 2026) */}
      <div className={cn(
        "w-8 h-8 flex items-center justify-center transition-colors duration-300 shrink-0 text-[10px] font-black border",
        isHovered ? "bg-[#ffbf23]/20 text-[#1A1D21] border-[#ffbf23]" : "bg-slate-100 text-slate-500 border-gray-200"
      )}>
        {/* Extract initials from name */}
        {candidate.name.split(' ').map(n => n[0]).join('')}
      </div>

      {/* Affiliate Info - Real Data */}
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* Affiliate Name */}
          <span className={cn(
            "text-[11px] font-bold truncate transition-colors duration-300",
            isHovered ? "text-[#111827]" : "text-slate-600"
          )}>
            {candidate.name}
          </span>
          {/* Platform Badge - NEO-BRUTALIST (January 9th, 2026) */}
          <span className={cn(
            "text-[8px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 border",
            isHovered ? "bg-[#ffbf23]/10 text-[#1A1D21] border-[#ffbf23]" : "text-slate-400 bg-slate-50 border-gray-200"
          )}>
            {candidate.platform}
          </span>
        </div>
        {/* Niche & Followers - followers only visible on hover (January 13th, 2026) */}
        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium">
          <span>{candidate.niche}</span>
          {isHovered && (
            <>
              <span>•</span>
              <span className="text-[#1A1D21] font-bold transition-colors duration-300">
                {candidate.followers} {followersLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Match Score Badge - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center gap-1 shrink-0 pl-2">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 + (index * 0.1) }}
        >
          <div className={cn(
            "px-2 py-0.5 text-[10px] font-black border-2 transition-all duration-300",
            isHovered 
              ? "bg-[#ffbf23]/20 text-[#1A1D21] border-[#ffbf23]" 
              : "bg-slate-50 text-slate-500 border-gray-200"
          )}>
            {/* Always show score, highlight on hover */}
            {candidate.score}%
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
