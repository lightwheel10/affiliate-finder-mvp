import React from 'react';
import { MoreHorizontal, Check, Plus, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardProps {
  title: string;
  link: string;
  domain: string;
  snippet: string;
  children?: React.ReactNode;
  className?: string;
  onSave?: () => void;
  onDismiss?: () => void;
  isSaved?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  link, 
  domain, 
  snippet, 
  children, 
  className,
  onSave,
  onDismiss,
  isSaved
}) => {
  return (
    <div className={cn(
      "group flex flex-col bg-white border border-slate-200/60 rounded-xl transition-all duration-200 hover:shadow-md hover:border-slate-300 relative",
      className
    )}>
      {/* Actions (visible on hover) */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
         <button 
          onClick={onDismiss}
          className="p-1.5 rounded-lg bg-white/90 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 shadow-sm backdrop-blur-sm transition-colors"
          title="Dismiss"
        >
          <Trash2 size={12} />
        </button>
        <button 
          onClick={onSave}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border shadow-sm backdrop-blur-sm transition-all flex items-center gap-1 font-semibold text-[11px]",
            isSaved 
              ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
              : "bg-white/90 text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 border-slate-200"
          )}
        >
          {isSaved ? (
            <>
              <Check size={12} className="stroke-[3]" /> Saved
            </>
          ) : (
            <>
              <Plus size={12} className="stroke-[3]" /> Save
            </>
          )}
        </button>
      </div>

      <div className="p-4 flex-1">
        <div className="flex justify-between items-start gap-3 mb-2.5">
          <div className="space-y-1.5 pr-10 w-full">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <div className="p-0.5 bg-slate-50 rounded border border-slate-100">
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                  alt="" 
                  className="w-3 h-3 opacity-80"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
              <span>{domain}</span>
            </div>
            <h3 className="font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-1 text-[15px]">
              <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-blue-200 underline-offset-2">
                {title}
              </a>
            </h3>
          </div>
        </div>
        
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
          {snippet}
        </p>
      </div>
      
      {children && (
        <div className="px-4 pb-3 space-y-2.5">
          {children}
        </div>
      )}
      
      {/* Footer Actions */}
      <div className="px-4 py-2.5 border-t border-slate-50 flex items-center justify-between bg-slate-50/30 min-h-[40px]">
        <button className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors group/btn">
          <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover/btn:border-blue-200 group-hover/btn:text-blue-600 shadow-sm">
             <UserPlus size={10} />
          </div>
          Find Contacts
        </button>
        <button className="text-slate-300 hover:text-slate-600 transition-colors">
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  );
};
