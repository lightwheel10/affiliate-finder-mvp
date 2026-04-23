'use client';

/**
 * =============================================================================
 * DISCOVERY GRAPHIC — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Animated affiliate discovery visualization for the main BentoCard in the
 * landing feature section. Shows real affiliate rows that highlight on hover.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened visual language per landing refresh brief.
 *   Rows are now rounded-lg with hairline #e6ebf1 borders (was border-2
 *   black). Avatars are rounded-full circles. Status pill is rounded-full.
 *   Score badge is a rounded pill. Animation logic (scanner beam, hover
 *   timing, reveal delays) is UNCHANGED.
 *
 * - January 10th, 2026: i18n Migration — Added useLanguage() hook.
 *
 * - January 9th, 2026: Neo-brutalist pass (superseded April 23rd, 2026).
 *
 * - January 5th, 2026: Replaced skeleton placeholders with real data.
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

  // January 22nd, 2026: Added dark mode support
  return (
    // Removed overflow-hidden to allow INDEXING badge to extend into top space (January 13th, 2026) - Dark mode: January 22nd, 2026
    <div className="absolute inset-0 bg-white dark:bg-[#111]">
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
      
      {/* Search Status Indicator — rounded pill with soft border (April 23rd, 2026) */}
      {/* Positioned at -8% to account for 10% graphic offset in BentoCard (January 13th, 2026) */}
      <div className="absolute -top-[8%] right-5 flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#111] rounded-full border border-[#e6ebf1] dark:border-gray-700 shadow-[0_2px_6px_-1px_rgba(16,24,40,0.06)] z-30">
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
                 <Loader2 size={10} className="text-[#8898aa]" />
            </motion.div>
          </motion.div>
        )}
        <span className="text-[9px] font-semibold text-[#0f172a] dark:text-white uppercase tracking-[0.14em]">
          {isHovered ? t.landingGraphics.discovery.scanning : t.landingGraphics.discovery.indexing}
        </span>
      </div>

      {/* Content Container - Dark mode: January 22nd, 2026 */}
      <div className="absolute inset-x-0 top-2 bottom-0 p-5 flex flex-col gap-2.5 mask-image-gradient-wide">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90 dark:to-[#111]/90 z-10 pointer-events-none" />
        
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

// April 23rd, 2026: Soft rounded rows, rounded-full avatars, pill score badge.
const ProfileRow = ({ index, isHovered, candidate, followersLabel }: ProfileRowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-[#1a1a1a] transition-all duration-300",
        isHovered
          ? "border-[#ffbf23]/60 shadow-[0_4px_12px_-4px_rgba(255,191,35,0.35)] translate-x-1"
          : "border-[#e6ebf1] dark:border-gray-700"
      )}
    >
      {/* Avatar with initials — rounded-full (April 23rd, 2026) */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shrink-0 text-[10px] font-bold",
        isHovered
          ? "bg-[#ffbf23]/20 text-[#0f172a] dark:text-white ring-2 ring-[#ffbf23]/40"
          : "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 ring-1 ring-[#e6ebf1] dark:ring-gray-700"
      )}>
        {candidate.name.split(' ').map(n => n[0]).join('')}
      </div>

      {/* Affiliate Info */}
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-[11px] font-semibold truncate transition-colors duration-300",
            isHovered ? "text-[#0f172a] dark:text-white" : "text-[#425466] dark:text-gray-300"
          )}>
            {candidate.name}
          </span>
          {/* Platform Badge — rounded pill (April 23rd, 2026) */}
          <span className={cn(
            "text-[8px] font-semibold uppercase tracking-[0.1em] shrink-0 px-2 py-0.5 rounded-full border",
            isHovered
              ? "bg-[#ffbf23]/10 text-[#0f172a] dark:text-white border-[#ffbf23]/50"
              : "text-[#8898aa] dark:text-gray-500 bg-[#f6f9fc] dark:bg-gray-800 border-[#e6ebf1] dark:border-gray-700"
          )}>
            {candidate.platform}
          </span>
        </div>
        {/* Niche & Followers — followers only visible on hover (January 13th, 2026) */}
        <div className="flex items-center gap-2 text-[9px] text-[#8898aa] dark:text-gray-500 font-medium">
          <span>{candidate.niche}</span>
          {isHovered && (
            <>
              <span>•</span>
              <span className="text-[#0f172a] dark:text-white font-semibold transition-colors duration-300">
                {candidate.followers} {followersLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Match Score Badge — rounded pill with soft ring (April 23rd, 2026) */}
      <div className="flex items-center gap-1 shrink-0 pl-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 + (index * 0.1) }}
        >
          <div className={cn(
            "px-2 py-0.5 text-[10px] font-bold rounded-full transition-all duration-300",
            isHovered
              ? "bg-[#ffbf23] text-[#0f172a] shadow-[0_0_0_3px_rgba(255,191,35,0.18)]"
              : "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 ring-1 ring-[#e6ebf1] dark:ring-gray-700"
          )}>
            {candidate.score}%
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
