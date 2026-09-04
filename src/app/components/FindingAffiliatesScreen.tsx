/**
 * =============================================================================
 * FindingAffiliatesScreen Component — SMOOVER REFRESH
 * =============================================================================
 *
 * Created: January 15th, 2026
 * Updated: January 21st, 2026 - Enhanced with progress bar and step checklist
 * Updated: April 24th, 2026 — smoover visual refresh (rounded tiles, hairline
 *          borders, shadow-yellow-glow-sm on the yellow spinner tile, rounded-
 *          full progress bar). Vivid green completion colour + yellow-on-black
 *          icon tile preserved.
 *
 * PURPOSE:
 * This component displays an animated loading screen after payment succeeds.
 * It shows while we pre-fetch affiliate results in the background.
 *
 * DESIGN (January 21st, 2026):
 * Client requested enhanced progress indication with:
 * - VISIBLE CHECKLIST of all steps (not just cycling text)
 * - Current step highlighted, completed steps checked off
 * - Animated progress bar (0% -> 95%, then 100% on completion)
 * - Elapsed time display
 *
 * TECHNICAL NOTES:
 * - Progress is "fake" - we animate 0% -> 95% over ~540 seconds (Feb 2 2026)
 * - Progress bar NEVER reaches 100% until API returns (isComplete=true)
 * - Steps advance every ~90 seconds (6 steps over ~540 seconds)
 * - When API completes, all steps show as complete
 *
 * =============================================================================
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, Circle, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES - January 21st, 2026
// =============================================================================

interface FindingAffiliatesScreenProps {
  /** When true, API has completed and we should show 100% + completion message */
  isComplete: boolean;
  error?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  onContinue?: () => void;
}

// =============================================================================
// CONSTANTS - January 21st, 2026
// February 2, 2026: Updated timings to reflect 8-10 minute search duration
// =============================================================================

/** 
 * Maximum progress percentage before API completes.
 * We animate from 0% to this value over the estimated time.
 * Progress will NEVER exceed this until isComplete=true.
 */
const MAX_PROGRESS_BEFORE_COMPLETE = 95;

/**
 * Estimated total search time in seconds.
 * February 2, 2026: Increased from 120s to 540s (9 minutes) for enrichment.
 */
const ESTIMATED_TOTAL_SECONDS = 540;

/**
 * How often to check and update progress (milliseconds).
 */
const PROGRESS_UPDATE_INTERVAL = 100;

/**
 * Base interval for advancing to next step (seconds).
 * February 2, 2026: Increased from 20s to 90s (6 steps × 90s = 540s)
 */
const STEP_ADVANCE_INTERVAL = 90;

// =============================================================================
// COMPONENT - January 21st, 2026 (Enhanced with Checklist)
// =============================================================================

export function FindingAffiliatesScreen({
  isComplete,
  error = false,
  isRetrying = false,
  onRetry,
  onContinue,
}: FindingAffiliatesScreenProps) {
  const { t } = useLanguage();
  
  // Progress state: 0-100
  const [progress, setProgress] = useState(0);
  
  // Current step index (0-5, where 5 is "Complete!")
  const [currentStep, setCurrentStep] = useState(0);
  
  // Elapsed time in seconds
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Track when we started for accurate timing
  const startTimeRef = useRef<number | null>(null);
  
  // Step messages from translations (excluding "Complete!" which is last)
  const allSteps = t.findingAffiliates.steps;
  const workingSteps = allSteps.slice(0, -1); // All except "Complete!"
  const totalWorkingSteps = workingSteps.length;

  // ===========================================================================
  // PROGRESS ANIMATION EFFECT
  // ===========================================================================
  useEffect(() => {
    if (isComplete) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsedMs = now - startTimeRef.current;
      const elapsed = Math.floor(elapsedMs / 1000);
      
      setElapsedSeconds(elapsed);
      
      const progressPercent = Math.min(
        (elapsedMs / (ESTIMATED_TOTAL_SECONDS * 1000)) * MAX_PROGRESS_BEFORE_COMPLETE,
        MAX_PROGRESS_BEFORE_COMPLETE
      );
      setProgress(progressPercent);

      const stepIndex = Math.min(
        Math.floor(elapsed / STEP_ADVANCE_INTERVAL),
        totalWorkingSteps - 1
      );
      setCurrentStep(stepIndex);
    }, PROGRESS_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isComplete, totalWorkingSteps]);

  // ===========================================================================
  // FORMAT ELAPSED TIME
  // ===========================================================================
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedProgress = isComplete ? 100 : progress;
  const displayedStep = isComplete ? totalWorkingSteps : currentStep;

  if (error) {
    return (
      <div className="animate-in fade-in duration-500 text-center py-6">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center">
            <AlertCircle size={32} className="text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="text-lg font-display font-bold text-[#0f172a] dark:text-white mb-2 tracking-tight">
          {t.findingAffiliates.errorTitle}
        </h2>
        <p className="max-w-sm mx-auto text-sm leading-6 text-[#425466] dark:text-gray-300 mb-5">
          {t.findingAffiliates.errorMessage}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying || !onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2.5 text-sm font-semibold text-[#1A1D21] shadow-yellow-glow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {t.findingAffiliates.retry}
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={isRetrying || !onContinue}
            className="inline-flex items-center justify-center rounded-full border border-[#e6ebf1] dark:border-gray-700 px-5 py-2.5 text-sm font-semibold text-[#425466] dark:text-gray-200 transition hover:bg-[#f6f9fc] dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.findingAffiliates.continueToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="animate-in fade-in duration-500 text-center py-6">
      {/* Icon — smoover refresh (April 24th, 2026). Tiles gain rounded-2xl; yellow spinner tile uses shadow-yellow-glow-sm + soft-lg for green. Pulse/ping background kept. */}
      <div className="flex justify-center mb-5">
        <div className="relative">
          {isComplete ? (
            <>
              {/* Pulsing background for celebration */}
              <div className="absolute inset-0 w-16 h-16 bg-green-500/20 rounded-2xl animate-ping" />

              {/* Success checkmark */}
              <div className="relative w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-soft-lg">
                <CheckCircle2 size={32} className="text-white" strokeWidth={3} />
              </div>
            </>
          ) : (
            <>
              {/* Pulsing background */}
              <div className="absolute inset-0 w-16 h-16 bg-[#ffbf23]/20 rounded-2xl animate-pulse" />

              {/* Spinning loader */}
              <div className="relative w-16 h-16 bg-[#ffbf23] rounded-2xl flex items-center justify-center shadow-yellow-glow-sm">
                <Loader2 size={32} className="text-[#1A1D21] animate-spin" strokeWidth={3} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Title — Archivo display, mixed-case */}
      <h2 className={cn(
        "text-lg font-display font-bold text-[#0f172a] dark:text-white mb-1 tracking-tight",
        isComplete && "text-green-600 dark:text-green-400"
      )}>
        {isComplete ? t.findingAffiliates.complete : 'Finding Your Affiliates'}
      </h2>

      {/* Elapsed Time */}
      <p className="text-[#8898aa] dark:text-gray-400 text-sm font-mono mb-4">
        {formatTime(elapsedSeconds)} {t.findingAffiliates.elapsed || 'elapsed'}
      </p>

      {/* =================================================================
        STEP CHECKLIST - January 21st, 2026
        
        Shows ALL steps at once with visual indicators:
        - ✓ Green checkmark = completed step
        - → Yellow arrow = current step (in progress)
        - ○ Gray circle = pending step
        ================================================================= */}
      <div className="max-w-xs mx-auto mb-5 text-left space-y-1.5">
        {workingSteps.map((stepText, index) => {
          const isCompleted = index < displayedStep || isComplete;
          const isCurrent = index === displayedStep && !isComplete;
          const isPending = index > displayedStep && !isComplete;

          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all duration-300",
                isCompleted && "text-green-600 dark:text-green-400",
                isCurrent && "text-[#0f172a] dark:text-white bg-[#ffbf23]/10 rounded-lg border-l-2 border-[#ffbf23]",
                isPending && "text-[#8898aa] dark:text-gray-500"
              )}
            >
              {/* Step indicator icon */}
              <span className="shrink-0 w-4 flex justify-center">
                {isCompleted ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : isCurrent ? (
                  <ArrowRight size={14} className="text-[#ffbf23] animate-pulse" />
                ) : (
                  <Circle size={14} className="text-[#8898aa] dark:text-gray-600" />
                )}
              </span>

              {/* Step text */}
              <span className={cn(
                isCurrent && "font-semibold"
              )}>
                {stepText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar — smoover refresh (April 24th, 2026). Rounded-full pill on a hairline #e6ebf1 track (was a brutalist rectangle with border-2 black). Slightly reduced height (h-5 -> h-4) to keep proportions right with rounded ends. */}
      <div className="max-w-xs mx-auto mb-3">
        <div className="h-4 bg-[#e6ebf1] dark:bg-gray-800 rounded-full relative overflow-hidden">
          {/* Progress bar fill */}
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              isComplete
                ? "bg-green-500"
                : "bg-[#ffbf23]"
            )}
            style={{ width: `${displayedProgress}%` }}
          />

          {/* Percentage text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-[#1A1D21] dark:text-white mix-blend-difference">
              {Math.round(displayedProgress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Estimated Time Note (only when not complete) */}
      {!isComplete && (
        <p className="text-[#8898aa] dark:text-gray-500 text-[10px]">
          {t.findingAffiliates.estimatedTime}
        </p>
      )}
    </div>
  );
}

export default FindingAffiliatesScreen;
