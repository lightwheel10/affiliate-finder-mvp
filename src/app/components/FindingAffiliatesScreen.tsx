/**
 * =============================================================================
 * FindingAffiliatesScreen Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Created: January 15th, 2026
 * Updated: January 21st, 2026 - Enhanced with progress bar and step checklist
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
 * - Progress is "fake" - we animate 0% -> 95% over ~120 seconds
 * - Progress bar NEVER reaches 100% until API returns (isComplete=true)
 * - Steps advance every ~20 seconds (6 steps over ~120 seconds)
 * - When API completes, all steps show as complete
 * 
 * =============================================================================
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES - January 21st, 2026
// =============================================================================

interface FindingAffiliatesScreenProps {
  /** When true, API has completed and we should show 100% + completion message */
  isComplete: boolean;
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

export function FindingAffiliatesScreen({ isComplete }: FindingAffiliatesScreenProps) {
  const { t } = useLanguage();
  
  // Progress state: 0-100
  const [progress, setProgress] = useState(0);
  
  // Current step index (0-5, where 5 is "Complete!")
  const [currentStep, setCurrentStep] = useState(0);
  
  // Elapsed time in seconds
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Track when we started for accurate timing
  const startTimeRef = useRef(Date.now());
  
  // Track if we've already completed (to prevent re-animation)
  const hasCompletedRef = useRef(false);

  // Step messages from translations (excluding "Complete!" which is last)
  const allSteps = t.findingAffiliates.steps;
  const workingSteps = allSteps.slice(0, -1); // All except "Complete!"
  const totalWorkingSteps = workingSteps.length;

  // ===========================================================================
  // PROGRESS ANIMATION EFFECT
  // ===========================================================================
  useEffect(() => {
    // If already completed, don't restart animation
    if (hasCompletedRef.current) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTimeRef.current;
      const elapsed = Math.floor(elapsedMs / 1000);
      
      setElapsedSeconds(elapsed);
      
      // Calculate progress based on elapsed time
      if (!isComplete) {
        const progressPercent = Math.min(
          (elapsedMs / (ESTIMATED_TOTAL_SECONDS * 1000)) * MAX_PROGRESS_BEFORE_COMPLETE,
          MAX_PROGRESS_BEFORE_COMPLETE
        );
        setProgress(progressPercent);
        
        // Calculate which step we should be on based on elapsed time
        // Each step takes ~20 seconds, so step = floor(elapsed / 20)
        const stepIndex = Math.min(
          Math.floor(elapsed / STEP_ADVANCE_INTERVAL),
          totalWorkingSteps - 1
        );
        setCurrentStep(stepIndex);
      }
    }, PROGRESS_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isComplete, totalWorkingSteps]);

  // ===========================================================================
  // COMPLETION EFFECT
  // ===========================================================================
  useEffect(() => {
    if (isComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      
      // Jump to 100% and mark all steps complete
      setProgress(100);
      setCurrentStep(totalWorkingSteps); // Past all working steps = all complete
    }
  }, [isComplete, totalWorkingSteps]);

  // ===========================================================================
  // FORMAT ELAPSED TIME
  // ===========================================================================
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="animate-in fade-in duration-500 text-center py-6">
      {/* Icon - Checkmark when complete, Loader when searching */}
      <div className="flex justify-center mb-5">
        <div className="relative">
          {isComplete ? (
            <>
              {/* Pulsing background for celebration */}
              <div className="absolute inset-0 w-16 h-16 bg-green-500/20 animate-ping" />
              
              {/* Success checkmark */}
              <div className="relative w-16 h-16 bg-green-500 border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000000]">
                <CheckCircle2 size={32} className="text-white" strokeWidth={3} />
              </div>
            </>
          ) : (
            <>
              {/* Pulsing background */}
              <div className="absolute inset-0 w-16 h-16 bg-[#ffbf23]/20 animate-pulse" />
              
              {/* Spinning loader */}
              <div className="relative w-16 h-16 bg-[#ffbf23] border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000000]">
                <Loader2 size={32} className="text-black animate-spin" strokeWidth={3} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Title */}
      <h2 className={cn(
        "text-lg font-black text-gray-900 dark:text-white mb-1 uppercase tracking-wide",
        isComplete && "text-green-600 dark:text-green-400"
      )}>
        {isComplete ? t.findingAffiliates.complete : 'Finding Your Affiliates'}
      </h2>

      {/* Elapsed Time */}
      <p className="text-gray-500 dark:text-gray-400 text-sm font-mono mb-4">
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
          const isCompleted = index < currentStep || isComplete;
          const isCurrent = index === currentStep && !isComplete;
          const isPending = index > currentStep && !isComplete;
          
          return (
            <div 
              key={index}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all duration-300",
                isCompleted && "text-green-600 dark:text-green-400",
                isCurrent && "text-gray-900 dark:text-white bg-[#ffbf23]/20 border-l-2 border-[#ffbf23]",
                isPending && "text-gray-400 dark:text-gray-500"
              )}
            >
              {/* Step indicator icon */}
              <span className="shrink-0 w-4 flex justify-center">
                {isCompleted ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : isCurrent ? (
                  <ArrowRight size={14} className="text-[#ffbf23] animate-pulse" />
                ) : (
                  <Circle size={14} className="text-gray-300 dark:text-gray-600" />
                )}
              </span>
              
              {/* Step text */}
              <span className={cn(
                isCurrent && "font-bold"
              )}>
                {stepText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar Container */}
      <div className="max-w-xs mx-auto mb-3">
        {/* Progress bar background */}
        <div className="h-5 bg-gray-200 dark:bg-gray-800 border-2 border-black dark:border-gray-600 relative overflow-hidden">
          {/* Progress bar fill */}
          <div 
            className={cn(
              "h-full transition-all duration-300 ease-out",
              isComplete 
                ? "bg-green-500" 
                : "bg-[#ffbf23]"
            )}
            style={{ width: `${progress}%` }}
          />
          
          {/* Percentage text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-black dark:text-white mix-blend-difference">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Estimated Time Note (only when not complete) */}
      {!isComplete && (
        <p className="text-gray-400 dark:text-gray-500 text-[10px]">
          {t.findingAffiliates.estimatedTime}
        </p>
      )}
    </div>
  );
}

export default FindingAffiliatesScreen;
