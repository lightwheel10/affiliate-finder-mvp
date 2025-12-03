'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PipelineGraphicProps {
  isHovered?: boolean;
}

export const PipelineGraphic = ({ isHovered = false }: PipelineGraphicProps) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (isHovered) {
        const t1 = setTimeout(() => setStage(1), 400); // Move to progress
        const t2 = setTimeout(() => setStage(2), 1200); // Move to done
        return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
        setStage(0);
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

      {/* Kanban Board Container - Stretched full width */}
      <div className="absolute inset-x-0 top-0 bottom-0 px-4 pb-4 flex gap-0.5">
         
         {/* Col 1 */}
         <div className="flex-1 flex flex-col gap-2 pt-4">
            <div className="h-1 w-12 bg-slate-200 rounded-full mb-1" />
            <KanbanCard />
            <KanbanCard />
            
            <AnimatePresence>
                {stage === 0 && (
                    <motion.div 
                        layoutId="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <KanbanCard active />
                    </motion.div>
                )}
            </AnimatePresence>
         </div>

         {/* Col 2 */}
         <div className="flex-1 flex flex-col gap-2 pt-4 border-l border-dashed border-[#E5E7EB] pl-3">
            <div className="h-1 w-12 bg-[#D4E815]/50 rounded-full mb-1" />
            <KanbanCard />
            
            <AnimatePresence>
                {stage === 1 && (
                    <motion.div 
                        layoutId="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                         <KanbanCard active highlight />
                    </motion.div>
                )}
            </AnimatePresence>
         </div>

         {/* Col 3 */}
         <div className="flex-1 flex flex-col gap-2 pt-4 border-l border-dashed border-[#E5E7EB] pl-3 opacity-60">
            <div className="h-1 w-12 bg-[#D4E815] rounded-full mb-1" />
            
            <AnimatePresence>
                {stage === 2 && (
                    <motion.div 
                        layoutId="card"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                         <KanbanCard active complete />
                    </motion.div>
                )}
            </AnimatePresence>
         </div>

      </div>
    </div>
  );
};

const KanbanCard = ({ active, highlight, complete }: { active?: boolean, highlight?: boolean, complete?: boolean }) => (
  <div className={cn(
    "bg-white p-2.5 rounded-lg border shadow-sm space-y-2 w-full",
    active ? "shadow-md" : "border-[#E5E7EB]",
    highlight ? "border-[#D4E815]/50 ring-2 ring-[#D4E815]/20" : "",
    complete ? "border-[#D4E815] bg-[#D4E815]/10" : ""
  )}>
    <div className="flex items-center gap-2">
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold", 
            highlight ? "bg-[#D4E815]/30 text-[#1A1D21]" : 
            complete ? "bg-[#D4E815] text-[#1A1D21]" : "bg-slate-100 text-slate-500"
        )}>
            {complete ? "✓" : "JD"}
        </div>
        <div className="h-1.5 w-12 bg-slate-100 rounded-full" />
    </div>
  </div>
);
