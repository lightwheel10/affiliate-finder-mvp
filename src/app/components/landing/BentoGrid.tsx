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
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window !== 'undefined') {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    return false;
  });

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-slate-100 p-4 sm:p-5 md:p-6",
        "flex flex-col justify-between h-full",
        !isTouchDevice && "cursor-pointer",
        className
      )}
      initial={{ scale: 1, y: 0 }}
      whileHover={!isTouchDevice ? {
        scale: 1.03,
        y: -8,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)"
      } : {}}
      transition={{
        type: "spring",
        stiffness: 250,
        damping: 25
      }}
      style={{
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)",
        zIndex: isHovered ? 20 : 1,
      }}
      onMouseEnter={() => !isTouchDevice && setIsHovered(true)}
      onMouseLeave={() => !isTouchDevice && setIsHovered(false)}
    >
      {/* Background Graphic Layer */}
      {graphic && (
        <div className="absolute inset-0 z-0 opacity-100 pointer-events-none transition-opacity duration-500">
          {isValidElement(graphic)
            // @ts-expect-error - Adding isHovered prop to cloned element
            ? cloneElement(graphic, { isHovered: !isTouchDevice && isHovered })
            : graphic}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <div className="mt-auto space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-3 font-medium">
            {description}
          </p>
        </div>

        {children && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-50 pointer-events-auto">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const BentoGrid = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto auto-rows-[minmax(180px,auto)] sm:auto-rows-[minmax(200px,auto)] md:auto-rows-[minmax(210px,auto)]", className)}>
      {children}
    </div>
  );
};
