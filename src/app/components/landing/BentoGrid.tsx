'use client';

/**
 * =============================================================================
 * BENTO GRID & BENTO CARD - NEO-BRUTALIST
 * =============================================================================
 * 
 * Last Updated: January 13th, 2026
 * 
 * These components create a bento-style grid layout for feature cards on the
 * landing page.
 * 
 * CHANGELOG:
 * - January 13th, 2026: Removed description/subtext from BentoCard
 *   - Removed description paragraph element
 *   - Title now sits alone at the bottom of the card
 *   - Simplified content layout (removed space-y-2)
 *   - Shifted graphic layer down by 20% (top-[20%])
 * 
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Sharp edges on cards (removed rounded-3xl)
 *   - Bold borders (border-2 border-black)
 *   - Neo-brutalist offset shadow
 *   - Sharp hover effect with shadow reduction
 *   - Updated typography (font-black)
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

  return (
    <motion.div
      className={cn(
        // NEO-BRUTALIST: Sharp edges, bold border (January 9th, 2026)
        "relative overflow-hidden bg-white border-2 border-black p-6",
        "flex flex-col justify-between h-full",
        "cursor-pointer",
        className
      )}
      initial={{ scale: 1, y: 0, x: 0 }}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
        x: -4,
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 25 
      }}
      style={{
        // NEO-BRUTALIST: Offset shadow (January 9th, 2026)
        boxShadow: isHovered 
          ? "2px 2px 0px 0px #000000" 
          : "6px 6px 0px 0px #000000",
        zIndex: isHovered ? 20 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Graphic Layer - shifted down 20% (January 13th, 2026) */}
      {graphic && (
        <div className="absolute top-[10%] left-0 right-0 bottom-0 z-0 opacity-100 pointer-events-none transition-opacity duration-500">
          {isValidElement(graphic) 
            // @ts-ignore
            ? cloneElement(graphic, { isHovered }) 
            : graphic}
        </div>
      )}

      {/* Content - NEO-BRUTALIST (Updated January 13th, 2026) */}
      {/* Removed description/subtext - title now sits alone at bottom */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <div className="mt-auto">
          <h3 className="text-lg font-black text-[#111827] leading-tight tracking-tight">
            {title}
          </h3>
        </div>
        
        {children && (
          <div className="mt-4 pt-4 border-t-2 border-gray-200 pointer-events-auto">
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
