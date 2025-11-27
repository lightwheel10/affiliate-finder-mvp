'use client';

import React, { useState, cloneElement, isValidElement } from 'react';
import { Motion, spring } from 'react-motion';
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
    <Motion
      defaultStyle={{ 
        scale: 1, 
        shadowOpacity: 0.05, 
        y: 0 
      }}
      style={{
        scale: spring(isHovered ? 1.03 : 1, { stiffness: 250, damping: 25 }),
        shadowOpacity: spring(isHovered ? 0.2 : 0.05, { stiffness: 250, damping: 25 }),
        y: spring(isHovered ? -8 : 0, { stiffness: 250, damping: 25 }),
      }}
    >
      {({ scale, shadowOpacity, y }: { scale: number; shadowOpacity: number; y: number }) => (
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl bg-white border border-slate-100 p-6",
            "flex flex-col justify-between h-full",
            "cursor-pointer",
            className
          )}
          style={{
            transform: `perspective(1000px) scale(${scale}) translateY(${y}px)`,
            boxShadow: `0 20px 40px -10px rgba(0,0,0,${shadowOpacity})`,
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
        </div>
      )}
    </Motion>
  );
};

export const BentoGrid = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto auto-rows-[minmax(210px,auto)]", className)}>
      {children}
    </div>
  );
};
