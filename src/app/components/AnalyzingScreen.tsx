/**
 * =============================================================================
 * AnalyzingScreen Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Square elements throughout
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * PURPOSE:
 * This component displays an animated loading screen while we analyze the user's
 * brand website using Firecrawl + OpenAI. It's shown between Step 1 (brand info)
 * and Step 2 (target market) of the onboarding flow.
 * 
 * USER EXPERIENCE:
 * The screen shows 3 animated steps that transition sequentially:
 * 1. "Analyzing your website..." - While Firecrawl scrapes the site
 * 2. "Understanding your products..." - While OpenAI processes content
 * 3. "Finding your competitors..." - While we validate competitor domains
 * 
 * =============================================================================
 */

'use client';

import React from 'react';
import { Loader2, Check, Globe, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AnalyzingScreenProps {
  currentStep: number;
  brandName?: string;
  error?: string | null;
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
// COMPONENT - NEO-BRUTALIST (Updated January 8th, 2026)
// =============================================================================

export function AnalyzingScreen({ 
  currentStep, 
  brandName,
  error,
  onSkip,
}: AnalyzingScreenProps) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header - NEO-BRUTALIST */}
      <div className="text-center mb-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <div className="w-8 h-8 bg-black border-2 border-black flex items-center justify-center text-[#ffbf23] shadow-[2px_2px_0px_0px_#ffbf23]">
            <Sparkles size={16} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-lg tracking-tight text-gray-900 dark:text-white uppercase">
            CrewCast<span className="text-black dark:text-white">Studio</span>
          </span>
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1 uppercase tracking-wide">
          {error ? 'Analysis Complete' : 'Analyzing Your Brand'}
        </h2>
        
        {/* Subtitle with brand name */}
        {brandName && !error && (
          <p className="text-gray-500 text-sm font-medium">
            Getting insights for <span className="font-bold text-gray-700 dark:text-gray-300">{brandName}</span>
          </p>
        )}
      </div>

      {/* Error State - NEO-BRUTALIST */}
      {error ? (
        <div className="space-y-4">
          {/* Error Message Box */}
          <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 p-4 text-center">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-bold mb-1">
              We couldn&apos;t find suggestions automatically
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              {error}
            </p>
          </div>
          
          {/* Skip Button - NEO-BRUTALIST */}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full py-3 font-black text-sm bg-[#ffbf23] text-black uppercase tracking-wide border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Continue & Enter Manually
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Progress Steps - NEO-BRUTALIST */}
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
                    "flex items-center gap-3 p-3 transition-all duration-500 border-2",
                    isActive && "bg-[#ffbf23]/20 border-[#ffbf23]",
                    isCompleted && "bg-green-100 dark:bg-green-900/30 border-green-500",
                    isPending && "opacity-50 border-gray-200 dark:border-gray-700"
                  )}
                >
                  {/* Step Icon/Status - NEO-BRUTALIST square */}
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center shrink-0 transition-all duration-500 border-2",
                    isCompleted && "bg-green-500 text-white border-black",
                    isActive && "bg-black text-[#ffbf23] border-black",
                    isPending && "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600"
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
                      "font-bold text-sm transition-colors",
                      isCompleted && "text-green-700 dark:text-green-400",
                      isActive && "text-black dark:text-white",
                      isPending && "text-gray-400"
                    )}>
                      {step.label}
                      {isActive && <span className="animate-pulse">...</span>}
                    </p>
                    <p className={cn(
                      "text-xs transition-colors",
                      isCompleted && "text-green-600/70 dark:text-green-500/70",
                      isActive && "text-gray-500",
                      isPending && "text-gray-300 dark:text-gray-600"
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

          {/* Bottom Progress Bar - NEO-BRUTALIST */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
              <div 
                className="h-full bg-[#ffbf23] transition-all duration-700 ease-out"
                style={{ 
                  width: `${Math.min(((currentStep - 1) / ANALYSIS_STEPS.length) * 100 + 15, 100)}%` 
                }}
              />
            </div>
            <p className="text-center text-xs text-gray-400 font-medium">
              This usually takes 10-15 seconds
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyzingScreen;
