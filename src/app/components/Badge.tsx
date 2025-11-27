import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'primary' | 'success' | 'neutral' | 'web' | 'reddit' | 'linkedin' | 'twitter' | 'instagram' | 'youtube';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

// Refined colors for a cleaner look
const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-blue-50 text-blue-700 border-blue-100 ring-blue-500/10",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-500/10",
  neutral: "bg-slate-50 text-slate-600 border-slate-100 ring-slate-500/10",
  web: "bg-slate-50 text-slate-700 border-slate-100 ring-slate-500/10",
  reddit: "bg-[#FF4500]/5 text-[#FF4500] border-[#FF4500]/10 ring-[#FF4500]/5",
  linkedin: "bg-[#0A66C2]/5 text-[#0A66C2] border-[#0A66C2]/10 ring-[#0A66C2]/5",
  twitter: "bg-sky-50 text-sky-700 border-sky-100 ring-sky-500/10",
  instagram: "bg-pink-50 text-pink-700 border-pink-100 ring-pink-500/10",
  youtube: "bg-red-50 text-red-700 border-red-100 ring-red-500/10",
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, icon, className }) => {
  // Normalize variant input (e.g. if lowercased from string)
  const normalizedVariant = variant.toLowerCase() as BadgeVariant;
  const style = variantStyles[normalizedVariant] || variantStyles.neutral;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ring-1 ring-inset uppercase tracking-wider",
      style,
      className
    )}>
      {icon && <span className="w-2.5 h-2.5 flex items-center justify-center -ml-0.5">{icon}</span>}
      {children}
    </span>
  );
};
