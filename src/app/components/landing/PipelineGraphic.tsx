'use client';

/**
 * =============================================================================
 * PIPELINE GRAPHIC - NEO-BRUTALIST
 * =============================================================================
 * 
 * Displays an animated CRM pipeline/kanban visualization for the BentoGrid
 * feature section. Shows affiliates moving through recruitment stages.
 * 
 * CHANGELOG:
 * - January 10th, 2026: i18n Migration - Remaining Components
 *   - Added useLanguage hook for translations
 *   - Translated column labels: "New", "Outreach", "Done"
 * 
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Sharp edges on cards (removed rounded-lg, rounded-full)
 *   - Bold borders (border-2)
 *   - Updated color from #D4E815 to #ffbf23 (brand yellow)
 *   - Sharp column labels
 * 
 * - January 5th, 2026: Simplified animation with fixed card positions
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
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

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
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
         
         {/* Column 1: New - 2 cards initially */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 pr-1">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">{t.landingGraphics.pipeline.new}</span>
            
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

         {/* Column 2: Outreach - NEO-BRUTALIST (January 9th, 2026) */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 border-l-2 border-dashed border-gray-300 pl-2 pr-1">
            <span className="text-[7px] font-black text-[#ffbf23] uppercase tracking-wider">{t.landingGraphics.pipeline.outreach}</span>
            
            {/* Slot 1: Fixed container - swaps between Ryan C. and Maria S. */}
            <div className="relative">
              {/* Ryan C. - visible at stage 0, maintains slot height */}
              <motion.div
                animate={{ opacity: stage >= 1 ? 0 : 1 }}
                transition={{ duration: 0.25 }}
              >
                <KanbanCard highlight affiliate={affiliates.outreachCard1} />
              </motion.div>
              
              {/* Maria S. - absolutely positioned on top, fades in at stage 2 */}
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

         {/* Column 3: Done - NEO-BRUTALIST (January 9th, 2026) */}
         <div className="w-1/3 shrink-0 grow-0 flex flex-col gap-1.5 pt-2 border-l-2 border-dashed border-gray-300 pl-2">
            <span className="text-[7px] font-black text-[#1A1D21] uppercase tracking-wider">{t.landingGraphics.pipeline.done}</span>
            
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

const KanbanCard = ({ active, highlight, complete, affiliate }: KanbanCardProps) => {
  // Default affiliate if none provided (for static placeholder cards)
  const displayAffiliate = affiliate || { name: "New Lead", niche: "Pending" };
  // Extract initials from name
  const initials = displayAffiliate.name.split(' ').map(n => n[0]).join('');
  
  return (
    // NEO-BRUTALIST: Sharp edges, bold borders (January 9th, 2026)
    <div className={cn(
      "bg-white p-2 border-2 w-full transition-all duration-300",
      active ? "border-black" : "border-gray-200",
      highlight ? "border-[#ffbf23]" : "",
      complete ? "border-[#ffbf23] bg-[#ffbf23]/10" : ""
    )}>
      <div className="flex items-center gap-1.5">
        {/* Avatar - NEO-BRUTALIST (January 9th, 2026) */}
        <div className={cn(
          "w-5 h-5 flex items-center justify-center text-[7px] font-black shrink-0 border", 
          highlight ? "bg-[#ffbf23]/30 text-[#1A1D21] border-[#ffbf23]" : 
          complete ? "bg-[#ffbf23] text-[#1A1D21] border-[#ffbf23]" : "bg-slate-100 text-slate-500 border-gray-200"
        )}>
          {complete ? "✓" : initials}
        </div>
        {/* Affiliate Name & Niche */}
        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-[8px] font-bold truncate block",
            complete ? "text-[#1A1D21]" : highlight ? "text-[#111827]" : "text-slate-600"
          )}>
            {displayAffiliate.name}
          </span>
          <span className="text-[6px] text-slate-400 truncate block font-medium">
            {displayAffiliate.niche}
          </span>
        </div>
      </div>
    </div>
  );
};
