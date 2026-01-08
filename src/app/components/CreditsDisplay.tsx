'use client';

/**
 * CreditsDisplay Component
 * 
 * Displays user's credit balances in the page header.
 * Used across all main pages (Find New, Discovered, Saved, Dashboard, Outreach).
 * 
 * DESIGN UPDATE (January 6th, 2026):
 * Added "neo" variant for neo-brutalist design from DashboardDemo.tsx
 * - variant="default" - Original design with rounded badges
 * - variant="neo" - Neo-brutalist with bold borders and industrial styling
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
// SKELETON COMPONENTS
// =============================================================================

function CreditSkeleton({ variant = 'default' }: { variant?: 'default' | 'neo' }) {
  if (variant === 'neo') {
    // NEW DESIGN - Neo-brutalist skeleton (January 6th, 2026)
    // Matches DashboardDemo.tsx styling exactly
    return (
      <div className="px-3 py-1.5 border-2 border-black dark:border-gray-600 rounded-md bg-white dark:bg-black animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          <span className="text-gray-300">|</span>
          <div className="w-12 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }
  
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
  /** Short label for compact display (e.g., "Search", "Email", "AI") */
  shortLabel?: string;
  isPrimary?: boolean;
  variant?: 'default' | 'neo';
}

function CreditBadge({ icon, value, label, shortLabel, isPrimary = false, variant = 'default' }: CreditBadgeProps) {
  // ==========================================================================
  // NEW DESIGN - Neo-brutalist variant (January 6th, 2026)
  // Matches DashboardDemo.tsx EXACTLY:
  // <div className="px-3 py-1.5 border-2 border-brandBlack dark:border-gray-600 rounded-md bg-white dark:bg-black">
  //     Search <span className="text-gray-400">|</span> 10/10 Topic
  // </div>
  // ==========================================================================
  if (variant === 'neo') {
    return (
      <div className="px-3 py-1.5 border-2 border-black dark:border-gray-600 rounded-md bg-white dark:bg-black text-xs font-bold">
        {shortLabel || label.split(' ')[0]} <span className="text-gray-400">|</span> {value} <span className="hidden xl:inline text-gray-500 font-normal">{label.includes('Search') ? 'Topic' : ''}</span>
      </div>
    );
  }
  
  // OLD DESIGN - Default variant
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
  /**
   * Visual variant for the credits display.
   * - "default" - Original design with rounded badges
   * - "neo" - Neo-brutalist design with bold borders (January 6th, 2026)
   */
  variant?: 'default' | 'neo';
}

export function CreditsDisplay({ showTopicSearches = true, variant = 'default' }: CreditsDisplayProps) {
  const { credits, isLoading, error, isEnabled, hasNoCredits } = useCredits();

  // Icon styles based on variant
  const iconClass = variant === 'neo' 
    ? 'text-gray-500' 
    : 'text-slate-600';
  const primaryIconClass = variant === 'neo' 
    ? 'text-[#ffbf23]' 
    : 'text-[#1A1D21]';

  // ==========================================================================
  // CASE 1: Feature flag is OFF
  // Show hardcoded fallback values (original behavior)
  // ==========================================================================
  if (!isEnabled) {
    return (
      <>
        {showTopicSearches && (
          <CreditBadge
            icon={<Search size={12} className={primaryIconClass} />}
            value={FALLBACK_CREDITS.topicSearches}
            label="Topic Searches"
            shortLabel="Search"
            isPrimary
            variant={variant}
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.email}
          label="Email Credits"
          shortLabel="Email"
          variant={variant}
        />
        <CreditBadge
          icon={<Sparkles size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.ai}
          label="AI Credits"
          shortLabel="AI"
          variant={variant}
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
        {showTopicSearches && <CreditSkeleton variant={variant} />}
        <CreditSkeleton variant={variant} />
        <CreditSkeleton variant={variant} />
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
            icon={<Search size={12} className={primaryIconClass} />}
            value={FALLBACK_CREDITS.topicSearches}
            label="Topic Searches"
            shortLabel="Search"
            isPrimary
            variant={variant}
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.email}
          label="Email Credits"
          shortLabel="Email"
          variant={variant}
        />
        <CreditBadge
          icon={<Sparkles size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.ai}
          label="AI Credits"
          shortLabel="AI"
          variant={variant}
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
          icon={<Search size={12} className={primaryIconClass} />}
          value={topicSearchDisplay}
          label="Topic Searches"
          shortLabel="Search"
          isPrimary
          variant={variant}
        />
      )}
      <CreditBadge
        icon={<Mail size={12} className={iconClass} />}
        value={emailDisplay}
        label="Email Credits"
        shortLabel="Email"
        variant={variant}
      />
      <CreditBadge
        icon={<Sparkles size={12} className={iconClass} />}
        value={aiDisplay}
        label="AI Credits"
        shortLabel="AI"
        variant={variant}
      />
    </>
  );
}
