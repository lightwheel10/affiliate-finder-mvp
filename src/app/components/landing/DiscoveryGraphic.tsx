'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscoveryGraphicProps {
  isHovered?: boolean;
}

const candidates = [
  { id: 1, name: "Sarah Connor", niche: "Tech", score: 98, platform: "YouTube" },
  { id: 2, name: "John Smith", niche: "Finance", score: 95, platform: "TikTok" },
  { id: 3, name: "Jessica Doe", niche: "Lifestyle", score: 92, platform: "Instagram" },
];

export const DiscoveryGraphic = ({ isHovered = false }: DiscoveryGraphicProps) => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-50/30">
      {/* Abstract Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{ 
          backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', 
          backgroundSize: '16px 16px' 
        }} 
      />

      {/* Scanner Beam */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent z-20 blur-[1px]"
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
      <div className="absolute top-2 right-5 flex items-center gap-2 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200/60 z-30">
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
                <RotateCw size={10} className="text-blue-500" />
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
        <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">
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

const ProfileRow = ({ index, isHovered, candidate }: { index: number; isHovered: boolean; candidate: any }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm transition-all duration-300",
        isHovered ? "border-blue-200 shadow-md translate-x-1" : "border-slate-100"
      )}
    >
      {/* Avatar Placeholder */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shrink-0",
        isHovered ? "bg-blue-50 text-blue-500" : "bg-slate-50 text-slate-400"
      )}>
        <User size={14} strokeWidth={2.5} />
      </div>

      {/* Info Lines */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center justify-between">
             <div className="h-2 w-20 bg-slate-100 rounded-full" />
             <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider">{candidate.platform}</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-12 bg-slate-50 rounded-full" />
            <div className="h-1.5 w-8 bg-slate-50 rounded-full" />
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
                    ? "bg-green-50 text-green-600 border-green-200" 
                    : "bg-slate-50 text-slate-400 border-slate-100"
            )}>
                {isHovered ? `${candidate.score}%` : '--'}
            </div>
         </motion.div>
      </div>
    </motion.div>
  );
};
