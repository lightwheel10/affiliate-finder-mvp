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
import { useLanguage } from '@/contexts/LanguageContext';

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

// -----------------------------------------------------------------------------
// MIN-WIDTH CONSTANTS (January 13th, 2026)
// 
// Fixed min-widths for each credit type to prevent layout shift between
// skeleton and loaded states. Both CreditSkeleton and CreditBadge use these
// same values for their neo variant containers.
// 
// Values are based on typical content widths:
// - Search: "Search | 10/10" + optional "Topic" suffix
// - Email:  "Email | 150/150"
// - AI:     "AI | 200/200"
// -----------------------------------------------------------------------------
const NEO_MIN_WIDTHS = {
  search: 'min-w-[95px]',
  email: 'min-w-[100px]',
  ai: 'min-w-[75px]',
} as const;

type CreditType = 'search' | 'email' | 'ai';

interface CreditSkeletonProps {
  variant?: 'default' | 'neo';
  /** Credit type determines min-width for zero layout shift (January 13th, 2026) */
  type?: CreditType;
}

function CreditSkeleton({ variant = 'default', type = 'email' }: CreditSkeletonProps) {
  if (variant === 'neo') {
    // =========================================================================
    // NEO-BRUTALIST SKELETON (Fixed January 13th, 2026)
    // 
    // Uses min-width to guarantee zero layout shift between skeleton and
    // loaded states. The min-width matches the corresponding CreditBadge.
    // =========================================================================
    const minWidthClass = NEO_MIN_WIDTHS[type];
    
    return (
      <div className={`${minWidthClass} px-3 py-1.5 border-2 border-black dark:border-gray-600 rounded-md bg-white dark:bg-black text-xs font-bold`}>
        <span className="bg-gray-200 dark:bg-gray-700 text-transparent rounded animate-pulse">Label</span> <span className="text-gray-400">|</span> <span className="bg-gray-200 dark:bg-gray-700 text-transparent rounded animate-pulse">00/00</span>
      </div>
    );
  }
  
  // Default variant skeleton - matches default CreditBadge structure
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
  /** Optional suffix for neo variant (e.g., "Topic") - Added January 9th, 2026 for i18n */
  neoSuffix?: string;
  /** Credit type for min-width matching (January 13th, 2026) */
  creditType?: CreditType;
}

function CreditBadge({ icon, value, label, shortLabel, isPrimary = false, variant = 'default', neoSuffix, creditType = 'email' }: CreditBadgeProps) {
  // ==========================================================================
  // NEW DESIGN - Neo-brutalist variant (January 6th, 2026)
  // Updated for i18n (January 9th, 2026) - neoSuffix replaces hardcoded 'Topic'
  // Fixed January 13th, 2026: Added min-width to match skeleton for zero shift
  // Matches DashboardDemo.tsx EXACTLY:
  // <div className="px-3 py-1.5 border-2 border-brandBlack dark:border-gray-600 rounded-md bg-white dark:bg-black">
  //     Search <span className="text-gray-400">|</span> 10/10 Topic
  // </div>
  // ==========================================================================
  if (variant === 'neo') {
    const minWidthClass = NEO_MIN_WIDTHS[creditType];
    return (
      <div className={`${minWidthClass} px-3 py-1.5 border-2 border-black dark:border-gray-600 rounded-md bg-white dark:bg-black text-xs font-bold`}>
        {shortLabel || label.split(' ')[0]} <span className="text-gray-400">|</span> {value} {neoSuffix && <span className="hidden xl:inline text-gray-500 font-normal">{neoSuffix}</span>}
      </div>
    );
  }
  
  // ==========================================================================
  // DEFAULT VARIANT - Updated January 16, 2026
  // Changed from #D4E815 (lime) to #ffbf23 (brand yellow) for consistency
  // ==========================================================================
  if (isPrimary) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23]/10 border border-[#ffbf23]/30 rounded-lg">
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
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
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
  // Translated (January 9th, 2026)
  // ==========================================================================
  if (!isEnabled) {
    return (
      <>
        {showTopicSearches && (
          <CreditBadge
            icon={<Search size={12} className={primaryIconClass} />}
            value={FALLBACK_CREDITS.topicSearches}
            label={t.dashboard.credits.topicSearches}
            shortLabel={t.dashboard.credits.topicSearchesShort}
            isPrimary
            variant={variant}
            neoSuffix={t.dashboard.credits.topic}
            creditType="search"
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.email}
          label={t.dashboard.credits.emailCredits}
          shortLabel={t.dashboard.credits.emailCreditsShort}
          variant={variant}
          creditType="email"
        />
        <CreditBadge
          icon={<Sparkles size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.ai}
          label={t.dashboard.credits.aiCredits}
          shortLabel={t.dashboard.credits.aiCreditsShort}
          variant={variant}
          creditType="ai"
        />
      </>
    );
  }

  // ==========================================================================
  // CASE 2: Loading
  // Show skeleton placeholders with matching min-widths (January 13th, 2026)
  // ==========================================================================
  if (isLoading) {
    return (
      <>
        {showTopicSearches && <CreditSkeleton variant={variant} type="search" />}
        <CreditSkeleton variant={variant} type="email" />
        <CreditSkeleton variant={variant} type="ai" />
      </>
    );
  }

  // ==========================================================================
  // CASE 3: Error or no credits yet
  // Graceful degradation - show fallback values
  // This prevents broken UI if API fails
  // Translated (January 9th, 2026)
  // ==========================================================================
  if (error || hasNoCredits || !credits) {
    return (
      <>
        {showTopicSearches && (
          <CreditBadge
            icon={<Search size={12} className={primaryIconClass} />}
            value={FALLBACK_CREDITS.topicSearches}
            label={t.dashboard.credits.topicSearches}
            shortLabel={t.dashboard.credits.topicSearchesShort}
            isPrimary
            variant={variant}
            neoSuffix={t.dashboard.credits.topic}
            creditType="search"
          />
        )}
        <CreditBadge
          icon={<Mail size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.email}
          label={t.dashboard.credits.emailCredits}
          shortLabel={t.dashboard.credits.emailCreditsShort}
          variant={variant}
          creditType="email"
        />
        <CreditBadge
          icon={<Sparkles size={12} className={iconClass} />}
          value={FALLBACK_CREDITS.ai}
          label={t.dashboard.credits.aiCredits}
          shortLabel={t.dashboard.credits.aiCreditsShort}
          variant={variant}
          creditType="ai"
        />
      </>
    );
  }

  // ==========================================================================
  // CASE 4: Success - show real credits (remaining includes subscription + top-up)
  // When topup > 0, append "+N" to indicate top-up balance (February 2026)
  // ==========================================================================
  const withTopupHint = (display: string, topup: number | undefined) =>
    topup && topup > 0 ? `${display} +${topup}` : display;
  const topicSearchDisplay = withTopupHint(formatCreditDisplay(credits.topicSearches), credits.topicSearches.topup);
  const emailDisplay = withTopupHint(formatCreditDisplay(credits.email), credits.email.topup);
  const aiDisplay = withTopupHint(formatCreditDisplay(credits.ai), credits.ai.topup);

  return (
    <>
      {showTopicSearches && (
        <CreditBadge
          icon={<Search size={12} className={primaryIconClass} />}
          value={topicSearchDisplay}
          label={t.dashboard.credits.topicSearches}
          shortLabel={t.dashboard.credits.topicSearchesShort}
          isPrimary
          variant={variant}
          neoSuffix={t.dashboard.credits.topic}
          creditType="search"
        />
      )}
      <CreditBadge
        icon={<Mail size={12} className={iconClass} />}
        value={emailDisplay}
        label={t.dashboard.credits.emailCredits}
        shortLabel={t.dashboard.credits.emailCreditsShort}
        variant={variant}
        creditType="email"
      />
      <CreditBadge
        icon={<Sparkles size={12} className={iconClass} />}
        value={aiDisplay}
        label={t.dashboard.credits.aiCredits}
        shortLabel={t.dashboard.credits.aiCreditsShort}
        variant={variant}
        creditType="ai"
      />
    </>
  );
}
