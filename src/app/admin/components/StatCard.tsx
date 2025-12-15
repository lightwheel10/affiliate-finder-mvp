'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    icon: 'bg-slate-500/10 text-slate-400',
  },
  success: {
    icon: 'bg-green-500/10 text-green-400',
  },
  warning: {
    icon: 'bg-yellow-500/10 text-yellow-400',
  },
  primary: {
    icon: 'bg-[#D4E815]/10 text-[#D4E815]',
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
    <div className="bg-[#23272B] rounded-xl border border-[#2E3338] p-5 hover:border-[#3E4348] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', styles.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn(
            'text-xs font-medium px-2 py-1 rounded-md',
            trend.value >= 0 
              ? 'bg-green-500/10 text-green-400' 
              : 'bg-red-500/10 text-red-400'
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </div>
        )}
      </div>
      
      <div>
        <p className="text-2xl font-bold text-white mb-0.5">
          {typeof value === 'number' 
            ? value.toLocaleString() 
            : value}
        </p>
        <p className="text-sm text-slate-400">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
