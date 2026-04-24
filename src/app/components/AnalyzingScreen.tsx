/**
 * =============================================================================
 * AnalyzingScreen Component — SMOOVER REFRESH
 * =============================================================================
 *
 * Updated: April 24th, 2026
 *
 * CURRENT DESIGN LANGUAGE ("smoover"):
 * - Hairline #e6ebf1 borders; rounded-xl cards + rounded-md icon tiles.
 * - Soft drop shadows; shadow-yellow-glow-sm on the yellow CTA.
 * - Archivo display title + text-gradient-brand wordmark.
 * - Vivid green / amber status colours preserved for completed / error.
 * - Dark-mode support preserved.
 *
 * PURPOSE:
 * This component displays an animated loading screen while we analyze the
 * user's brand website using Firecrawl + OpenAI. It is shown AFTER Step 2
 * (target country + language) of the onboarding flow — the analysis uses
 * the country + language fields to localise the AI-generated competitor
 * and topic suggestions. (Earlier versions of this component ran between
 * Step 1 and Step 2; the trigger was moved in the January 17th, 2026 change
 * — see `fetchAISuggestions` in OnboardingScreen.tsx.)
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
import { useLanguage } from '@/contexts/LanguageContext';

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
// Moved inside component to access translations (January 9th, 2026)
// =============================================================================

// Icon configuration (kept separate as icons don't need translation)
const STEP_ICONS = [Globe, Sparkles, Users];

// =============================================================================
// COMPONENT - NEO-BRUTALIST (Updated January 8th, 2026)
// Translated (January 9th, 2026)
// =============================================================================

export function AnalyzingScreen({ 
  currentStep, 
  brandName,
  error,
  onSkip,
}: AnalyzingScreenProps) {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  
  // Analysis steps with translated strings (January 9th, 2026)
  const ANALYSIS_STEPS = [
    {
      id: 1,
      label: t.onboarding.analyzing.steps.step1Label,
      description: t.onboarding.analyzing.steps.step1Desc,
      icon: Globe,
    },
    {
      id: 2,
      label: t.onboarding.analyzing.steps.step2Label,
      description: t.onboarding.analyzing.steps.step2Desc,
      icon: Sparkles,
    },
    {
      id: 3,
      label: t.onboarding.analyzing.steps.step3Label,
      description: t.onboarding.analyzing.steps.step3Desc,
      icon: Users,
    },
  ];
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header — smoover refresh (April 24th, 2026). Logo tile softened to rounded-md + hairline. Wordmark uses font-display + text-gradient-brand on "One". Title drops uppercase for Archivo display. */}
      <div className="text-center mb-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <img src="/logo.svg" alt="Afforce One" className="w-8 h-8 rounded-md border border-[#e6ebf1] dark:border-gray-700" />
          <span className="font-display font-bold text-lg tracking-tight text-[#0f172a] dark:text-white">
            Afforce <span className="text-gradient-brand">One</span>
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-display font-bold text-[#0f172a] dark:text-white mb-1 tracking-tight">
          {error ? t.onboarding.analyzing.titleError : t.onboarding.analyzing.title}
        </h2>

        {/* Subtitle with brand name */}
        {brandName && !error && (
          <p className="text-[#8898aa] dark:text-gray-400 text-sm font-medium">
            {t.onboarding.analyzing.gettingInsightsFor} <span className="font-semibold text-[#0f172a] dark:text-white">{brandName}</span>
          </p>
        )}
      </div>

      {/* Error State — smoover refresh (April 24th, 2026). Amber callout becomes hairline + rounded-xl; vivid amber kept as the signal colour. Skip CTA matches the sign-in / onboarding Continue button pattern (rounded-full + shadow-yellow-glow-sm). */}
      {error ? (
        <div className="space-y-4">
          {/* Error Message Box */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-500 rounded-xl p-4 text-center">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-semibold mb-1">
              {t.onboarding.analyzing.errorTitle}
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              {error}
            </p>
          </div>

          {/* Skip Button */}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full py-3 font-bold text-sm bg-[#ffbf23] text-[#1A1D21] uppercase tracking-wide rounded-full hover:bg-[#e5ac20] shadow-yellow-glow-sm hover:shadow-yellow-glow hover:-translate-y-px transition-all"
            >
              {t.onboarding.analyzing.continueManually}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Progress Steps — smoover refresh (April 24th, 2026). Step cards adopt hairline border + rounded-xl; icon tiles become rounded-md. Vivid green (completed) + yellow (active) signal colours preserved. Text palette migrates to smoover tokens. */}
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
                    "flex items-center gap-3 p-3 transition-all duration-500 border rounded-xl",
                    isActive && "bg-[#ffbf23]/10 border-[#ffbf23]",
                    isCompleted && "bg-green-50 dark:bg-green-900/30 border-green-500",
                    isPending && "opacity-60 border-[#e6ebf1] dark:border-gray-700"
                  )}
                >
                  {/* Step Icon/Status — softened tile */}
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center shrink-0 transition-all duration-500 rounded-md",
                    isCompleted && "bg-green-500 text-white",
                    isActive && "bg-[#1A1D21] dark:bg-[#0f0f0f] text-[#ffbf23] shadow-yellow-glow-sm",
                    isPending && "bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] border border-[#e6ebf1] dark:border-gray-700"
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
                      "font-semibold text-sm transition-colors",
                      isCompleted && "text-green-700 dark:text-green-400",
                      isActive && "text-[#0f172a] dark:text-white",
                      isPending && "text-[#8898aa]"
                    )}>
                      {step.label}
                      {isActive && <span className="animate-pulse">...</span>}
                    </p>
                    <p className={cn(
                      "text-xs transition-colors",
                      isCompleted && "text-green-600/70 dark:text-green-500/70",
                      isActive && "text-[#425466] dark:text-gray-400",
                      isPending && "text-[#8898aa] dark:text-gray-500"
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

          {/* Bottom Progress Bar — smoover refresh (April 24th, 2026). Rounded-full track on a hairline rail. */}
          <div className="space-y-2">
            <div className="h-2 bg-[#e6ebf1] dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ffbf23] rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(((currentStep - 1) / ANALYSIS_STEPS.length) * 100 + 15, 100)}%`
                }}
              />
            </div>
            <p className="text-center text-xs text-[#8898aa] font-medium">
              {t.onboarding.analyzing.timeEstimate}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyzingScreen;
