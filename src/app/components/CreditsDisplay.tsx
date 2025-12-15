'use client';

/**
 * CreditsDisplay Component
 * 
 * Displays user's credit balances in the page header.
 * Used across all main pages (Find New, Discovered, Saved, Dashboard, Outreach).
 * 
 * BEHAVIOR:
 * - When feature flag OFF: Shows hardcoded fallback values
 * - When feature flag ON + loading: Shows skeleton placeholders
 * - When feature flag ON + error: Shows fallback values (graceful degradation)
 * - When feature flag ON + success: Shows real credit values
 * 
 * SECURITY:
 * - No sensitive data displayed
 * - Credit values are read-only display
 * - Actual enforcement happens in API layer
 * 
 * Created: December 2025
 */

import { Search, Mail, Sparkles } from 'lucide-react';
import { useCredits, formatCreditDisplay } from '../hooks/useCredits';

// =============================================================================
// FALLBACK VALUES
// These match the original hardcoded values for visual consistency
// =============================================================================

const FALLBACK_CREDITS = {
  topicSearches: '5/5',
  email: '150/150',
  ai: '200',
};

// =============================================================================
// SKELETON COMPONENT
// =============================================================================

function CreditSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg animate-pulse">
      <div className="w-3 h-3 bg-slate-200 rounded" />
      <div className="w-20 h-3.5 bg-slate-200 rounded" />
    </div>
  );
}

// =============================================================================
// CREDIT BADGE COMPONENTS
// =============================================================================

interface CreditBadgeProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  isPrimary?: boolean;
}

function CreditBadge({ icon, value, label, isPrimary = false }: CreditBadgeProps) {
  if (isPrimary) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-lg">
        {icon}
        <span className="font-semibold text-[#1A1D21]">{value} {label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
      {icon}
      <span className="font-semibold text-slate-800">{value} {label}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CreditsDisplayProps {
  /**
   * Whether to show Topic Searches credit.
   * Default: true
   * Set to false for pages that don't need topic search display (e.g., Dashboard)
   */
  showTopicSearches?: boolean;
}

export function CreditsDisplay({ showTopicSearches = true }: CreditsDisplayProps) {
  const { credits, isLoading, error, isEnabled, hasNoCredits } = useCredits();

  // ==========================================================================
  // CASE 1: Feature flag is OFF
  // Show hardcoded fallback values (original behavior)
  // ==========================================================================
  if (!isEnabled) {
    return (
      <>
        {showTopicSearches && (
          <CreditBadge
            icon={<Search size={12} className="text-[#1A1D21]" />}
            value={FALLBACK_CREDITS.topicSearches}
            label="Topic Searches"
            isPrimary
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className="text-slate-600" />}
          value={FALLBACK_CREDITS.email}
          label="Email Credits"
        />
        <CreditBadge
          icon={<Sparkles size={12} className="text-slate-600" />}
          value={FALLBACK_CREDITS.ai}
          label="AI Credits"
        />
      </>
    );
  }

  // ==========================================================================
  // CASE 2: Loading
  // Show skeleton placeholders
  // ==========================================================================
  if (isLoading) {
    return (
      <>
        {showTopicSearches && <CreditSkeleton />}
        <CreditSkeleton />
        <CreditSkeleton />
      </>
    );
  }

  // ==========================================================================
  // CASE 3: Error or no credits yet
  // Graceful degradation - show fallback values
  // This prevents broken UI if API fails
  // ==========================================================================
  if (error || hasNoCredits || !credits) {
    return (
      <>
        {showTopicSearches && (
          <CreditBadge
            icon={<Search size={12} className="text-[#1A1D21]" />}
            value={FALLBACK_CREDITS.topicSearches}
            label="Topic Searches"
            isPrimary
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className="text-slate-600" />}
          value={FALLBACK_CREDITS.email}
          label="Email Credits"
        />
        <CreditBadge
          icon={<Sparkles size={12} className="text-slate-600" />}
          value={FALLBACK_CREDITS.ai}
          label="AI Credits"
        />
      </>
    );
  }

  // ==========================================================================
  // CASE 4: Success - show real credits
  // ==========================================================================
  const topicSearchDisplay = formatCreditDisplay(credits.topicSearches);
  const emailDisplay = formatCreditDisplay(credits.email);
  const aiDisplay = credits.ai.unlimited 
    ? '∞' 
    : credits.ai.remaining.toString();

  return (
    <>
      {showTopicSearches && (
        <CreditBadge
          icon={<Search size={12} className="text-[#1A1D21]" />}
          value={topicSearchDisplay}
          label="Topic Searches"
          isPrimary
        />
      )}
      <CreditBadge
        icon={<Mail size={12} className="text-slate-600" />}
        value={emailDisplay}
        label="Email Credits"
      />
      <CreditBadge
        icon={<Sparkles size={12} className="text-slate-600" />}
        value={aiDisplay}
        label="AI Credits"
      />
    </>
  );
}
