'use client';

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
  description,
  className,
  children,
  graphic,
}: BentoCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-white border border-slate-100 p-6",
        "flex flex-col justify-between h-full",
        "cursor-pointer",
        className
      )}
      initial={{ scale: 1, y: 0 }}
      whileHover={{ 
        scale: 1.03, 
        y: -8,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)"
      }}
      transition={{ 
        type: "spring", 
        stiffness: 250, 
        damping: 25 
      }}
      style={{
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)",
        zIndex: isHovered ? 20 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Graphic Layer */}
      {graphic && (
        <div className="absolute inset-0 z-0 opacity-100 pointer-events-none transition-opacity duration-500">
          {isValidElement(graphic) 
            // @ts-ignore
            ? cloneElement(graphic, { isHovered }) 
            : graphic}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <div className="mt-auto space-y-2">
          <h3 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 font-medium">
            {description}
          </p>
        </div>
        
        {children && (
          <div className="mt-4 pt-4 border-t border-slate-50 pointer-events-auto">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const BentoGrid = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto auto-rows-[minmax(210px,auto)]", className)}>
      {children}
    </div>
  );
};
