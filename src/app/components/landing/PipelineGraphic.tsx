'use client';

/**
 * =============================================================================
 * PIPELINE GRAPHIC — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Animated CRM pipeline/kanban visualization used inside a BentoCard. Shows
 * affiliates moving through "New → Outreach → Done" recruitment stages.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened visual language per landing refresh brief.
 *   Kanban cards now use rounded-md with a hairline border + soft shadow
 *   instead of border-2 black. Avatars are rounded-full. Column labels use
 *   softer tracking. Stage transition animation timing UNCHANGED.
 *
 * - January 10th, 2026: i18n migration (useLanguage hook).
 * - January 9th, 2026: Neo-brutalist pass (superseded).
 * - January 5th, 2026: Simplified animation with fixed card positions.
 *
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PipelineGraphicProps {
  isHovered?: boolean;
}

/**
 * Sample affiliates for the pipeline demo
 */
const affiliates = {
  // New column cards
  newCard1: { name: "Alex T.", niche: "Tech" },
  newCard2: { name: "Maria S.", niche: "Fashion" },
  // Outreach column cards
  outreachCard1: { name: "Ryan C.", niche: "Fitness" },
  outreachCard2: { name: "Sophie W.", niche: "Beauty" },
};

export const PipelineGraphic = ({ isHovered = false }: PipelineGraphicProps) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();

  // Stage 0: Initial state
  // Stage 1: outreachCard1 fades out from Outreach, appears in Done
  // Stage 2: newCard2 fades out from New, appears in Outreach
  // Then reset to stage 0
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let t1: NodeJS.Timeout, t2: NodeJS.Timeout, t3: NodeJS.Timeout;
    
    if (isHovered) {
      // Step 1: Move Card from Outreach → Done
      t1 = setTimeout(() => setStage(1), 500);
      // Step 2: Move Card from New → Outreach  
      t2 = setTimeout(() => setStage(2), 1200);
      // Step 3: Reset back to initial state
      t3 = setTimeout(() => setStage(0), 2500);
      
      return () => { 
        clearTimeout(t1); 
        clearTimeout(t2); 
        clearTimeout(t3); 
      };
    } else {
      setStage(0);
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

      {/* Kanban Board Container - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="absolute inset-x-0 top-0 bottom-0 px-3 pb-2 flex">
         
         {/* Column 1: New (April 23rd, 2026: softer label + soft hairline divider) */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 pr-1">
            <span className="text-[7px] font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-[0.14em]">{t.landingGraphics.pipeline.new}</span>

            {/* Card 1 - always visible */}
            <KanbanCard affiliate={affiliates.newCard1} />

            {/* Card 2 - visible at stage 0 and 1, moves to Outreach at stage 2 */}
            <motion.div
              animate={{
                opacity: stage === 2 ? 0 : 1,
                scale: stage === 2 ? 0.95 : 1
              }}
              transition={{ duration: 0.3 }}
            >
              <KanbanCard affiliate={affiliates.newCard2} />
            </motion.div>
         </div>

         {/* Column 2: Outreach */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 border-l border-dashed border-[#e6ebf1] dark:border-gray-700 pl-2 pr-1">
            <span className="text-[7px] font-semibold text-[#ffbf23] uppercase tracking-[0.14em]">{t.landingGraphics.pipeline.outreach}</span>

            {/* Slot 1: Fixed container - swaps between Ryan C. and Maria S. */}
            <div className="relative">
              <motion.div
                animate={{ opacity: stage >= 1 ? 0 : 1 }}
                transition={{ duration: 0.25 }}
              >
                <KanbanCard highlight affiliate={affiliates.outreachCard1} />
              </motion.div>

              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: stage === 2 ? 1 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <KanbanCard highlight affiliate={affiliates.newCard2} />
              </motion.div>
            </div>

            {/* Slot 2: Sophie W. - always visible, never moves */}
            <KanbanCard highlight affiliate={affiliates.outreachCard2} />
         </div>

         {/* Column 3: Done */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 border-l border-dashed border-[#e6ebf1] dark:border-gray-700 pl-2">
            <span className="text-[7px] font-semibold text-[#0f172a] dark:text-white uppercase tracking-[0.14em]">{t.landingGraphics.pipeline.done}</span>
            
            {/* Card from Outreach - appears at stage 1+ */}
            <motion.div
              animate={{ 
                opacity: stage >= 1 ? 1 : 0,
                scale: stage >= 1 ? 1 : 0.9
              }}
              transition={{ duration: 0.3, delay: stage >= 1 ? 0.1 : 0 }}
              style={{ display: stage >= 1 ? 'block' : 'none' }}
            >
              <KanbanCard complete affiliate={affiliates.outreachCard1} />
            </motion.div>
         </div>

      </div>
    </div>
  );
};

/**
 * KanbanCard Component - NEO-BRUTALIST (Updated January 9th, 2026)
 * 
 * Renders a single affiliate card in the pipeline visualization.
 * Shows affiliate avatar, name, and niche with different states.
 * 
 * Design changes:
 * - Sharp edges (removed rounded-lg, rounded-full)
 * - Bold borders (border-2)
 * - Updated color from #D4E815 to #ffbf23
 */
interface KanbanCardProps {
  active?: boolean;
  highlight?: boolean;
  complete?: boolean;
  affiliate?: { name: string; niche: string };
}

// April 23rd, 2026: Softened to rounded-md + hairline border + soft shadow.
const KanbanCard = ({ active, highlight, complete, affiliate }: KanbanCardProps) => {
  const displayAffiliate = affiliate || { name: "New Lead", niche: "Pending" };
  const initials = displayAffiliate.name.split(' ').map(n => n[0]).join('');

  return (
    <div className={cn(
      "bg-white dark:bg-[#1a1a1a] p-2 rounded-md border w-full transition-all duration-300 shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]",
      active ? "border-[#0f172a] dark:border-white" : "border-[#e6ebf1] dark:border-gray-700",
      highlight ? "border-[#ffbf23]/60 shadow-[0_2px_8px_-2px_rgba(255,191,35,0.25)]" : "",
      complete ? "border-[#ffbf23]/60 bg-[#ffbf23]/10" : ""
    )}>
      <div className="flex items-center gap-1.5">
        {/* Avatar — rounded-full (April 23rd, 2026) */}
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0",
          complete ? "bg-[#ffbf23] text-[#0f172a] ring-2 ring-[#ffbf23]/30" :
          highlight ? "bg-[#ffbf23]/25 text-[#0f172a] dark:text-white ring-1 ring-[#ffbf23]/50" :
          "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 ring-1 ring-[#e6ebf1] dark:ring-gray-700"
        )}>
          {complete ? "✓" : initials}
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-[8px] font-semibold truncate block",
            complete ? "text-[#0f172a] dark:text-white" : highlight ? "text-[#0f172a] dark:text-white" : "text-[#425466] dark:text-gray-300"
          )}>
            {displayAffiliate.name}
          </span>
          <span className="text-[6px] text-[#8898aa] dark:text-gray-500 truncate block font-medium">
            {displayAffiliate.niche}
          </span>
        </div>
      </div>
    </div>
  );
};
