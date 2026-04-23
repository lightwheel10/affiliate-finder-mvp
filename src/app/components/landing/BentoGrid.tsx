'use client';

/**
 * =============================================================================
 * BENTO GRID & BENTO CARD — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Last Updated: April 23rd, 2026
 *
 * Bento-style grid layout for feature cards on the landing page.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened per landing refresh brief.
 *   Was: sharp border-2 black, offset brutalist shadow (6px 6px 0 #000),
 *   font-black title. Now: rounded-2xl, hairline #e6ebf1 ring, soft drop
 *   shadow that deepens on hover, Archivo display title. Hover no longer
 *   translates/scales as aggressively — just a subtle 4px lift.
 *
 * - January 13th, 2026: Removed description/subtext from BentoCard
 *   (title now sits alone at bottom; graphic shifted down 20%).
 *
 * - January 9th, 2026: Neo-brutalist pass (superseded).
 *
 * =============================================================================
 */

import React, { useState, cloneElement, isValidElement } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BentoCardProps {
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
  graphic?: React.ReactNode;
  fade?: 'bottom' | 'right' | 'none';
}

export const BentoCard = ({
  title,
  // description prop kept for backwards compatibility but no longer rendered (January 13th, 2026)
  description: _description,
  className,
  children,
  graphic,
}: BentoCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // April 23rd, 2026: Softened to rounded-2xl + soft shadow + Archivo title.
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden bg-white dark:bg-[#111] rounded-2xl ring-1 ring-[#e6ebf1] dark:ring-gray-800 p-6",
        "flex flex-col justify-between h-full",
        "cursor-pointer",
        className
      )}
      initial={{ scale: 1, y: 0, x: 0 }}
      whileHover={{
        y: -4,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 22
      }}
      style={{
        // April 23rd, 2026: Soft drop shadow replaces neo-brutalist offset.
        // Deepens on hover with a slight yellow tint cue.
        boxShadow: isHovered
          ? "0 20px 40px -12px rgba(16, 24, 40, 0.14), 0 0 0 1px rgba(255, 191, 35, 0.25)"
          : "0 4px 12px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.04)",
        zIndex: isHovered ? 20 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Graphic Layer — shifted down 10% (January 13th, 2026) */}
      {graphic && (
        <div className="absolute top-[10%] left-0 right-0 bottom-0 z-0 opacity-100 pointer-events-none transition-opacity duration-500">
          {isValidElement(graphic)
            // @ts-ignore
            ? cloneElement(graphic, { isHovered })
            : graphic}
        </div>
      )}

      {/* Content — Archivo title + hairline divider (April 23rd, 2026).
          Description removed Jan 13, 2026 (title sits alone at bottom). */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <div className="mt-auto">
          <h3 className="font-display text-lg font-semibold text-[#0f172a] dark:text-white leading-tight tracking-[-0.01em]">
            {title}
          </h3>
        </div>

        {children && (
          <div className="mt-4 pt-4 border-t border-[#e6ebf1] dark:border-gray-800 pointer-events-auto">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const BentoGrid = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto auto-rows-[minmax(210px,auto)]", className)}>
      {children}
    </div>
  );
};
