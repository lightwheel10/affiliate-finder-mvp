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
    <div className="absolute inset-0 overflow-hidden bg-slate-50/30">
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Kanban Board Container - Stretched full width */}
      <div className="absolute inset-x-0 top-0 bottom-0 px-3 sm:px-4 pb-4 flex gap-1 sm:gap-0.5">

         {/* Col 1 */}
         <div className="flex-1 flex flex-col gap-2 pt-4">
            <div className="h-1 w-10 sm:w-12 bg-slate-200 rounded-full mb-1" />
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
         <div className="flex-1 flex flex-col gap-2 pt-4 border-l border-dashed border-slate-200 pl-2 sm:pl-3">
            <div className="h-1 w-10 sm:w-12 bg-blue-200 rounded-full mb-1" />
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
         <div className="flex-1 flex flex-col gap-2 pt-4 border-l border-dashed border-slate-200 pl-2 sm:pl-3 opacity-60">
            <div className="h-1 w-10 sm:w-12 bg-green-200 rounded-full mb-1" />
            
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
    "bg-white p-2 sm:p-2.5 rounded-lg border shadow-sm space-y-2 w-full",
    active ? "shadow-md" : "border-slate-100",
    highlight ? "border-blue-200 ring-2 ring-blue-50" : "",
    complete ? "border-green-200 bg-green-50/30" : ""
  )}>
    <div className="flex items-center gap-1.5 sm:gap-2">
        <div className={cn("w-5 h-5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[8px] font-bold shrink-0",
            highlight ? "bg-blue-100 text-blue-600" :
            complete ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
        )}>
            {complete ? "✓" : "JD"}
        </div>
        <div className="h-1.5 w-8 sm:w-12 bg-slate-100 rounded-full flex-1 max-w-[3rem]" />
    </div>
  </div>
);
