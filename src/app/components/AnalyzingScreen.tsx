/**
 * AnalyzingScreen Component
 * Created: January 3rd, 2026
 * 
 * =============================================================================
 * PURPOSE
 * =============================================================================
 * This component displays an animated loading screen while we analyze the user's
 * brand website using Firecrawl + OpenAI. It's shown between Step 1 (brand info)
 * and Step 2 (target market) of the onboarding flow.
 * 
 * =============================================================================
 * USER EXPERIENCE
 * =============================================================================
 * The screen shows 3 animated steps that transition sequentially:
 * 1. "Analyzing your website..." - While Firecrawl scrapes the site
 * 2. "Understanding your products..." - While OpenAI processes content
 * 3. "Finding your competitors..." - While we validate competitor domains
 * 
 * Each step shows:
 * - Pending state: Gray circle
 * - In-progress state: Spinning loader with accent color
 * - Completed state: Green checkmark
 * 
 * =============================================================================
 * TIMING
 * =============================================================================
 * The actual API call runs in the background. This component receives the current
 * step (1, 2, or 3) as a prop and animates accordingly. The parent component
 * controls the step progression based on actual API progress.
 * 
 * Typical timing:
 * - Step 1 (Scraping): 2-4 seconds
 * - Step 2 (AI Analysis): 3-5 seconds
 * - Step 3 (Validation): 2-3 seconds
 * - Total: ~7-12 seconds
 * 
 * =============================================================================
 * STYLING
 * =============================================================================
 * Matches the onboarding design system:
 * - Primary accent: #D4E815 (lime green)
 * - Dark color: #1A1D21
 * - Card style: White with subtle shadow
 * - Animations: Smooth transitions with framer-motion style
 */

'use client';

import React from 'react';
import { Loader2, Check, Globe, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AnalyzingScreenProps {
  /** 
   * Current analysis step (1-3)
   * 1 = Analyzing website (Firecrawl scraping)
   * 2 = Understanding products (OpenAI processing)
   * 3 = Finding competitors (Domain validation)
   */
  currentStep: number;
  
  /** Brand name/domain being analyzed (for display) */
  brandName?: string;
  
  /** Error message if analysis failed */
  error?: string | null;
  
  /** Callback when user wants to skip/proceed manually after error */
  onSkip?: () => void;
}

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

const ANALYSIS_STEPS = [
  {
    id: 1,
    label: 'Analyzing your website',
    description: 'Reading your content and structure',
    icon: Globe,
  },
  {
    id: 2,
    label: 'Understanding your products',
    description: 'Identifying what you offer',
    icon: Sparkles,
  },
  {
    id: 3,
    label: 'Finding your competitors',
    description: 'Discovering similar businesses',
    icon: Users,
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AnalyzingScreen({ 
  currentStep, 
  brandName,
  error,
  onSkip,
}: AnalyzingScreenProps) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center mb-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <div className="w-6 h-6 bg-[#1A1D21] rounded-lg flex items-center justify-center text-[#D4E815] shadow-md">
            <Sparkles size={14} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            CrewCast<span className="text-[#1A1D21]">Studio</span>
          </span>
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          {error ? 'Analysis Complete' : 'Analyzing Your Brand'}
        </h2>
        
        {/* Subtitle with brand name */}
        {brandName && !error && (
          <p className="text-slate-500 text-sm">
            Getting insights for <span className="font-medium text-slate-700">{brandName}</span>
          </p>
        )}
      </div>

      {/* Error State */}
      {error ? (
        <div className="space-y-4">
          {/* Error Message Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-amber-800 text-sm font-medium mb-1">
              We couldn&apos;t find suggestions automatically
            </p>
            <p className="text-amber-600 text-xs">
              {error}
            </p>
          </div>
          
          {/* Skip Button */}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full py-3 rounded-full font-semibold text-sm bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] transition-all shadow-sm hover:shadow-md"
            >
              Continue & Enter Manually
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Progress Steps */}
          <div className="space-y-3 mb-6">
            {ANALYSIS_STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              const isPending = currentStep < step.id;
              const Icon = step.icon;
              
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all duration-500",
                    isActive && "bg-[#D4E815]/10 border border-[#D4E815]/30",
                    isCompleted && "bg-green-50/50",
                    isPending && "opacity-50"
                  )}
                >
                  {/* Step Icon/Status */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-500",
                    isCompleted && "bg-green-500 text-white",
                    isActive && "bg-[#1A1D21] text-[#D4E815]",
                    isPending && "bg-slate-100 text-slate-400"
                  )}>
                    {isCompleted ? (
                      <Check size={18} strokeWidth={3} className="animate-in zoom-in duration-300" />
                    ) : isActive ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Icon size={18} />
                    )}
                  </div>
                  
                  {/* Step Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium text-sm transition-colors",
                      isCompleted && "text-green-700",
                      isActive && "text-[#1A1D21]",
                      isPending && "text-slate-400"
                    )}>
                      {step.label}
                      {isActive && <span className="animate-pulse">...</span>}
                    </p>
                    <p className={cn(
                      "text-xs transition-colors",
                      isCompleted && "text-green-600/70",
                      isActive && "text-slate-500",
                      isPending && "text-slate-300"
                    )}>
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Completed checkmark on the right */}
                  {isCompleted && (
                    <div className="text-green-500 animate-in fade-in slide-in-from-right-2 duration-300">
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#D4E815] to-[#a8bc11] rounded-full transition-all duration-700 ease-out"
                style={{ 
                  width: `${Math.min(((currentStep - 1) / ANALYSIS_STEPS.length) * 100 + 15, 100)}%` 
                }}
              />
            </div>
            <p className="text-center text-xs text-slate-400">
              This usually takes 10-15 seconds
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default AnalyzingScreen;

