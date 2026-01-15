'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Stat cards updated to bold borders, hard shadows, and high-contrast text.
// Polish pass (tighter hierarchy + spacing) - January 15th, 2026

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'primary';
}

const variantStyles = {
  default: {
    icon: 'bg-white text-black border-2 border-black',
  },
  success: {
    icon: 'bg-white text-black border-2 border-black',
  },
  warning: {
    icon: 'bg-[#D4E815] text-black border-2 border-black',
  },
  primary: {
    icon: 'bg-[#D4E815] text-black border-2 border-black',
  },
};

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default' 
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className="bg-white border-4 border-black p-5 shadow-[3px_3px_0px_0px_#111827]">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2', styles.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn(
            'text-xs font-bold uppercase px-2 py-1 border-2 border-black',
            trend.value >= 0 
              ? 'bg-[#D4E815] text-black' 
              : 'bg-white text-black'
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </div>
        )}
      </div>
      
      <div>
        <p className="text-2xl font-black text-black mb-0.5">
          {typeof value === 'number' 
            ? value.toLocaleString() 
            : value}
        </p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-black/70">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-black/60 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
