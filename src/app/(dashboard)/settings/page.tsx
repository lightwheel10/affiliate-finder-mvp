'use client';

/**
 * =============================================================================
 * SETTINGS PAGE — SMOOVER (complete)
 * =============================================================================
 *
 * Updated: April 25th, 2026 — full smoover migration finished.
 *
 * DESIGN STATUS:
 * --------------
 * Every surface is now smoover:
 *   - SHELL (header + left nav + right panel container) — PR #30.
 *   - ProfileSettings + BlockedDomainsSettings — PR #31.
 *   - SecuritySettings (tab + Password Modal body + Delete Account
 *     Modal body) — PR #32.
 *   - PlanSettings + BuyCreditsSettings — PR #33.
 *   - Cancel Plan Modal body (in this file) + AddCardModal body
 *     (components/AddCardModal.tsx) — this PR.
 *
 * Smoover language:
 *   - Hairline #e6ebf1 borders, rounded corners, soft drop shadows.
 *   - Smoover tokens: #0f172a (primary text), #425466 (body),
 *     #8898aa (muted), #e6ebf1 (hairline), #f6f9fc (soft bg),
 *     #ffbf23 (brand yellow), #fff4d1 (yellow nav-active tint).
 *   - Yellow primary CTAs: rounded-full + shadow-yellow-glow-sm +
 *     hover:bg-[#e5ac20] + hover:-translate-y-px + font-semibold.
 *   - Destructive primary (irreversible): rounded-full + bg-red-500 +
 *     shadow-soft-lg, no translate-y hover.
 *   - Status / banner pattern: rounded-xl + bg-*-50 + hairline border-*-500
 *     (vivid border kept as signal).
 *   - Eyebrow labels: font-semibold + text-[#8898aa] + uppercase +
 *     tracking-wider.
 *
 * ARCHITECTURE (January 3rd, 2026):
 * ---------------------------------
 * This page is now part of the (dashboard) route group. The layout handles:
 *   - AuthGuard (authentication + onboarding check)
 *   - ErrorBoundary (error handling)
 *   - Sidebar (navigation - persists across page navigation)
 *   - Main container with ml-64 margin
 *
 * This page only renders the content: header + main content area.
 *
 * =============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
// January 19th, 2026: Removed Stack Auth import
// import { useUser } from '@stackframe/stack';
// Now using useSupabaseUser hook which provides supabaseUser
import { PricingModal } from '../../components/PricingModal';
import { AddCardModal } from '../../components/AddCardModal';
import { Modal } from '../../components/Modal';
// January 19th, 2026: Migrated from useNeonUser to useSupabaseUser
import { useSupabaseUser } from '../../hooks/useSupabaseUser';
import { useSubscription } from '../../hooks/useSubscription';
import { CURRENCY_SYMBOL } from '@/lib/stripe-client';
import { 
  User, 
  CreditCard, 
  Shield, 
  Mail, 
  Zap,
  Clock,
  AlertTriangle,
  Calendar,
  Check,
  Loader2,
  Plus,
  XCircle,
  FileText,
  ExternalLink,
  Download,
  ChevronDown,  // January 13th, 2026: Added for country/language dropdowns
  Globe,        // January 13th, 2026: Added for country/language section
  Eye,          // January 13th, 2026: Added for password visibility toggle
  EyeOff,       // January 13th, 2026: Added for password visibility toggle
  Trash2,       // January 13th, 2026: Added for delete account
  Coins,        // February 2026: Added for Buy Credits tab
  Sparkles,     // February 2026: Added for AI credits
  Search,       // February 2026: Added for search credits
  ShoppingCart, // February 2026: Added for buy credits
  Ban           // February 2026: Added for Blocked Domains tab
} from 'lucide-react';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';
import { useBlockedDomains } from '../../hooks/useBlockedDomains';

type SettingsTab = 'profile' | 'plan' | 'buy_credits' | 'security' | 'blocked_domains';

// =============================================================================
// SETTINGS PAGE - January 3rd, 2026
// 
// Layout now handles: AuthGuard, ErrorBoundary, and Sidebar.
// This component only renders the header and main content area.
// =============================================================================
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { userId, user: neonUser, refetch: refetchNeonUser, supabaseUser } = useSupabaseUser();
  const { subscription, isLoading: subscriptionLoading, isTrialing, isPastDue, daysLeftInTrial, refetch: refetchSubscription, cancelSubscription, resumeSubscription } = useSubscription(userId);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [creditPurchaseSuccess, setCreditPurchaseSuccess] = useState(false);
  const [creditPurchaseCancelled, setCreditPurchaseCancelled] = useState(false);

  // Sync tab from URL and handle credit_purchase=success | cancelled
  useEffect(() => {
    if (!searchParams) return;
    const tab = searchParams.get('tab');
    if (tab === 'buy_credits') setActiveTab('buy_credits');
    const purchase = searchParams.get('credit_purchase');
    if (purchase === 'success') {
      setCreditPurchaseSuccess(true);
      setCreditPurchaseCancelled(false);
      setActiveTab('buy_credits');
      // February 2026: Fallback fulfillment -- call /api/credits/fulfill to process
      // any pending purchases in case the Stripe webhook hasn't fired yet.
      // This is safe because addTopupCredits is idempotent (won't double-add).
      if (userId) {
        fetch('/api/credits/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
          .then(r => r.json())
          .then(data => {
            console.log('[Settings] Fulfill response:', data);
            // Refresh credits after fulfillment attempt
            window.dispatchEvent(new CustomEvent('credits-updated'));
          })
          .catch(err => {
            console.error('[Settings] Fulfill failed:', err);
            // Still try to refresh credits (webhook may have handled it)
            window.dispatchEvent(new CustomEvent('credits-updated'));
          });
      } else {
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('credit_purchase');
      window.history.replaceState({}, '', url.toString());
    } else if (purchase === 'cancelled') {
      setCreditPurchaseCancelled(true);
      setCreditPurchaseSuccess(false);
      setActiveTab('buy_credits');
      const url = new URL(window.location.href);
      url.searchParams.delete('credit_purchase');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Tabs - Translated (January 9th, 2026)
  // February 2, 2026: Removed notifications tab - was non-functional placeholder UI
  const tabs = [
    { id: 'profile', label: t.dashboard.settings.tabs.profile.label, icon: <User size={16} />, description: t.dashboard.settings.tabs.profile.description },
    { id: 'plan', label: t.dashboard.settings.tabs.plan.label, icon: <CreditCard size={16} />, description: t.dashboard.settings.tabs.plan.description },
    { id: 'buy_credits', label: t.dashboard.settings.tabs.buyCredits.label, icon: <Coins size={16} />, description: t.dashboard.settings.tabs.buyCredits.description },
    { id: 'blocked_domains', label: t.dashboard.settings.tabs.blockedDomains.label, icon: <Ban size={16} />, description: t.dashboard.settings.tabs.blockedDomains.description },
    { id: 'security', label: t.dashboard.settings.tabs.security.label, icon: <Shield size={16} />, description: t.dashboard.settings.tabs.security.description },
  ];

  // ==========================================================================
  // RENDER
  //
  // HEADER — Smoover refresh (April 23rd, 2026 · Phase 2d)
  //   Hairline bottom border, Archivo display title, unified with the other
  //   four dashboard pages (find / discovered / saved / outreach).
  //
  // LEFT NAVIGATION — Smoover refresh (April 25th, 2026)
  //   Rounded-lg tabs with soft-yellow-tint active state (bg-[#fff4d1] +
  //   shadow-soft-sm). Matches Sidebar.tsx NavItem exactly — consistent nav
  //   language across the dashboard + settings.
  //
  // RIGHT PANEL — Smoover refresh (April 25th, 2026)
  //   Hairline #e6ebf1 border + rounded-2xl + shadow-soft-sm. Matches
  //   onboarding card shell + Message Viewer modal.
  //
  // TAB CONTENTS — Each of the 5 tab sub-components (ProfileSettings /
  //   PlanSettings / BuyCreditsSettings / BlockedDomainsSettings /
  //   SecuritySettings) will be migrated in subsequent PRs. The shell above
  //   now renders their (still-brutalist) contents inside a smoover frame.
  //
  // Note: The outer container with Sidebar is handled by the dashboard layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* Header — SMOOVER REFRESH (April 23rd, 2026 · Phase 2d): unified with other dashboard pages */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">{t.dashboard.settings.pageTitle}</h1>
        </div>
      </header>

        {/* Main Content — smoover refresh (April 25th, 2026). Left nav matches Sidebar.tsx NavItem pattern; right panel container matches onboarding card shell + Message Viewer modal. */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-8rem)]">

            {/* Left Panel — smoover refresh (April 25th, 2026). Tab buttons use soft-yellow-tint active state (bg-[#fff4d1]) matching Sidebar NavItem, not solid yellow (that treatment is reserved for primary CTAs). Indicator dot dropped — the tint is enough signal. */}
            <div className="w-full md:w-64 shrink-0">
              <div className="sticky top-24 space-y-1">
                <h3 className="px-3 text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider mb-3">{t.dashboard.settings.accountLabel}</h3>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-[#fff4d1] dark:bg-[#ffbf23]/10 text-[#0f172a] dark:text-[#ffbf23] font-semibold shadow-soft-sm"
                        : "text-[#425466] dark:text-gray-400 hover:bg-[#f6f9fc] dark:hover:bg-gray-900 hover:text-[#0f172a] dark:hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "shrink-0",
                      activeTab === tab.id ? "text-[#0f172a] dark:text-[#ffbf23]" : "text-[#8898aa] dark:text-gray-500"
                    )}>
                      {tab.icon}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel — smoover refresh (April 25th, 2026). Hairline #e6ebf1 border + rounded-2xl + shadow-soft-sm (matches onboarding card shell + Message Viewer modal). */}
            <div className="flex-1 min-w-0 bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-sm overflow-hidden">
              <div className="h-full overflow-y-auto p-6 lg:p-8">
                <div className="max-w-2xl">
                  {/* January 13th, 2026: Removed tab title and description as per user request */}
                  {activeTab === 'profile' && (
                    <ProfileSettings
                      supabaseUser={supabaseUser}  // January 19th, 2026: Supabase Auth user (for email)
                      userName={neonUser?.name || supabaseUser?.email?.split('@')[0] || 'User'}  // January 19th, 2026: From database
                      neonUserId={userId}
                      currentCountry={neonUser?.target_country}
                      currentLanguage={neonUser?.target_language}
                      onProfileUpdated={refetchNeonUser}
                    />
                  )}
                  {activeTab === 'plan' && (
                    <PlanSettings 
                      subscription={subscription}
                      isLoading={subscriptionLoading}
                      isTrialing={isTrialing}
                      isPastDue={isPastDue}
                      daysLeftInTrial={daysLeftInTrial}
                      onUpgrade={() => setIsPricingModalOpen(true)}
                      onAddCard={() => setIsAddCardModalOpen(true)}
                      onCancelPlan={() => setIsCancelModalOpen(true)}
                      userId={userId}
                    />
                  )}
                  {activeTab === 'buy_credits' && (
                    <BuyCreditsSettings
                      userId={userId}
                      isTrialing={isTrialing}
                      creditPurchaseSuccess={creditPurchaseSuccess}
                      creditPurchaseCancelled={creditPurchaseCancelled}
                      onDismissPurchaseSuccess={() => setCreditPurchaseSuccess(false)}
                      onDismissPurchaseCancelled={() => setCreditPurchaseCancelled(false)}
                    />
                  )}
                  {activeTab === 'blocked_domains' && <BlockedDomainsSettings />}
                  {activeTab === 'security' && <SecuritySettings user={supabaseUser} neonUserId={userId} />}  {/* January 19th, 2026: Changed from Stack user */}
                </div>
              </div>
            </div>

          </div>
        </div>
      
      {/* Pricing Modal - Pass subscription context for plan changes */}
      {/* Updated December 2025 to support in-app plan upgrades/downgrades */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        userId={userId}
        currentPlan={subscription?.plan || null}
        currentBillingInterval={subscription?.billing_interval || null}
        isTrialing={isTrialing}
        onSuccess={() => {
          // Refetch subscription data after successful plan change
          refetchSubscription();
        }}
      />

      {/* January 19th, 2026: Changed from user?.primaryEmail to supabaseUser?.email */}
      {userId && supabaseUser?.email && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          userId={userId}
          userEmail={supabaseUser.email}
          onSuccess={() => {
            refetchSubscription();
            setIsAddCardModalOpen(false);
          }}
        />
      )}

      {/* Cancel Plan Confirmation Modal — smoover refresh (April 25th, 2026).
          Modal shell already smoover (Modal.tsx Phase 2b).
          Resume mode: smoover muted body + Keep-Canceled secondary pill +
          Resume yellow primary CTA.
          Cancel mode: smoover red callout warning + Keep-Subscription
          secondary pill + Cancel destructive primary (matches Security
          Delete Account confirm: bg-red-500 + rounded-full + shadow-soft-lg
          + no translate-y hover — irreversible action). */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={subscription?.cancel_at_period_end ? t.dashboard.settings.plan.cancelModal.resumeTitle : t.dashboard.settings.plan.cancelModal.cancelTitle}
        width="max-w-md"
      >
        <div className="space-y-4">
          {subscription?.cancel_at_period_end ? (
            <>
              <p className="text-sm text-[#425466] dark:text-gray-400 leading-relaxed">
                {t.dashboard.settings.plan.cancelModal.resumeMessage}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-5 py-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-all"
                >
                  {t.dashboard.settings.plan.cancelModal.keepCanceled}
                </button>
                <button
                  onClick={async () => {
                    setIsCanceling(true);
                    await resumeSubscription();
                    await refetchSubscription();
                    setIsCanceling(false);
                    setIsCancelModalOpen(false);
                  }}
                  disabled={isCanceling}
                  className="px-5 py-2 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isCanceling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {t.dashboard.settings.plan.cancelModal.confirmResume}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">{t.dashboard.settings.plan.cancelModal.cancelWarning}</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {t.dashboard.settings.plan.cancelModal.cancelMessage}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#8898aa] dark:text-gray-500">
                {t.dashboard.settings.plan.subscriptionWillRemainActive}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-5 py-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-all"
                >
                  {t.dashboard.settings.plan.cancelModal.keepSubscription}
                </button>
                <button
                  onClick={async () => {
                    setIsCanceling(true);
                    await cancelSubscription();
                    await refetchSubscription();
                    setIsCanceling(false);
                    setIsCancelModalOpen(false);
                  }}
                  disabled={isCanceling}
                  className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-soft-lg hover:bg-red-600 hover:shadow-soft-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCanceling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  {t.dashboard.settings.plan.cancelModal.confirmCancel}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

// =============================================================================
// PROFILE SETTINGS — SMOOVER REFRESH (April 24th, 2026)
//
// Migrated from neo-brutalist to the smoover design language:
// - Eyebrow labels: text-xs font-semibold text-[#8898aa] uppercase tracking-wider
//   (no more font-black; muted label token).
// - Read-mode fields: bg-[#f6f9fc] + border border-[#e6ebf1] + rounded-lg
//   (hairline cards, soft bg, no offset borders).
// - Edit-mode inputs: bg-[#f6f9fc] + border border-[#ffbf23] + rounded-lg +
//   focus:ring-2 focus:ring-[#ffbf23]/20 (matches wizard / onboarding inputs).
// - Country + language dropdown menus: border border-[#e6ebf1] + rounded-xl +
//   shadow-soft-lg + hover:bg-[#ffbf23]/10 (no more black border + offset shadow).
// - Section divider: hairline border-t border-[#e6ebf1].
// - Cancel: rounded-full hairline secondary (white + hover:bg-[#f6f9fc]).
// - Save / Edit Profile: rounded-full + shadow-yellow-glow-sm +
//   hover:bg-[#e5ac20] + hover:-translate-y-px (same primary CTA as every
//   other smoover yellow button).
//
// January 13th, 2026:
// - Added editable name functionality
// - Added country and language dropdowns
//
// January 19th, 2026:
// - Migrated from Stack Auth to Supabase
// - Updates Supabase database (name, target_country, target_language)
// - No longer updates Stack Auth displayName (DB is source of truth)
// =============================================================================
interface ProfileSettingsProps {
  supabaseUser: any;  // January 19th, 2026: Supabase Auth user (for email)
  userName: string;   // January 19th, 2026: From database
  neonUserId: number | null;
  currentCountry?: string | null;   // January 13th, 2026: From Neon DB
  currentLanguage?: string | null;  // January 13th, 2026: From Neon DB
  onProfileUpdated?: () => void;
}

// =============================================================================
// COUNTRIES LIST - January 13th, 2026
// Same list as onboarding for consistency
// =============================================================================
const COUNTRIES = [
  { name: 'United States', code: 'us' },
  { name: 'United Kingdom', code: 'gb' },
  { name: 'Germany', code: 'de' },
  { name: 'Canada', code: 'ca' },
  { name: 'Australia', code: 'au' },
  { name: 'France', code: 'fr' },
  { name: 'Spain', code: 'es' },
  { name: 'Italy', code: 'it' },
  { name: 'Netherlands', code: 'nl' },
  { name: 'Switzerland', code: 'ch' },
  { name: 'Austria', code: 'at' },
  { name: 'Sweden', code: 'se' },
  { name: 'Norway', code: 'no' },
  { name: 'Denmark', code: 'dk' },
  { name: 'Poland', code: 'pl' },
  { name: 'Japan', code: 'jp' },
  { name: 'Singapore', code: 'sg' },
  { name: 'United Arab Emirates', code: 'ae' },
];

// =============================================================================
// LANGUAGES LIST - January 13th, 2026
// February 2, 2026: Updated to use flags instead of symbols (matching onboarding)
// - Replaced 'symbol' with 'code' for flag country codes
// - Added 'nameDE' for German translations
// - Uses flagcdn.com for flag images (same as countries dropdown)
// =============================================================================
const LANGUAGES = [
  // Major Western Languages
  { name: 'English', nameDE: 'Englisch', code: 'gb' },
  { name: 'Spanish', nameDE: 'Spanisch', code: 'es' },
  { name: 'German', nameDE: 'Deutsch', code: 'de' },
  { name: 'French', nameDE: 'Französisch', code: 'fr' },
  { name: 'Portuguese', nameDE: 'Portugiesisch', code: 'pt' },
  { name: 'Italian', nameDE: 'Italienisch', code: 'it' },
  { name: 'Dutch', nameDE: 'Niederländisch', code: 'nl' },
  // Nordic Languages
  { name: 'Swedish', nameDE: 'Schwedisch', code: 'se' },
  { name: 'Danish', nameDE: 'Dänisch', code: 'dk' },
  { name: 'Norwegian', nameDE: 'Norwegisch', code: 'no' },
  { name: 'Finnish', nameDE: 'Finnisch', code: 'fi' },
  // Central/Eastern European
  { name: 'Polish', nameDE: 'Polnisch', code: 'pl' },
  { name: 'Czech', nameDE: 'Tschechisch', code: 'cz' },
  // Asian Languages
  { name: 'Japanese', nameDE: 'Japanisch', code: 'jp' },
  { name: 'Korean', nameDE: 'Koreanisch', code: 'kr' },
  // Middle Eastern
  { name: 'Arabic', nameDE: 'Arabisch', code: 'sa' },
  { name: 'Hebrew', nameDE: 'Hebräisch', code: 'il' },
];

function ProfileSettings({ supabaseUser, userName, neonUserId, currentCountry, currentLanguage, onProfileUpdated }: ProfileSettingsProps) {
  // January 17, 2026: Added i18n support
  const { t } = useLanguage();
  
  // January 19th, 2026: Using props directly (userName from DB, email from Supabase)
  const userEmail = supabaseUser?.email || '';
  
  // Editing state (January 13th, 2026)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Country and Language state (January 13th, 2026)
  const [editCountry, setEditCountry] = useState(currentCountry || '');
  const [editLanguage, setEditLanguage] = useState(currentLanguage || '');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  
  // Refs for click-outside detection (January 13th, 2026)
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns (January 13th, 2026)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset form when editing starts or user data changes (January 13th, 2026)
  useEffect(() => {
    if (isEditing) {
      setEditName(userName);
      setEditCountry(currentCountry || '');
      setEditLanguage(currentLanguage || '');
    }
  }, [isEditing, userName, currentCountry, currentLanguage]);

  // Handle save - update Stack Auth and Neon DB (January 13th, 2026)
  // January 17, 2026: Updated with i18n translations
  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError(t.dashboard.settings.profile.nameCannotBeEmpty);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // January 19th, 2026: Removed Stack Auth update - database is now source of truth
      // Update Supabase DB (name, country, language)
      if (neonUserId) {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: neonUserId,
            name: editName.trim(),
            targetCountry: editCountry || null,
            targetLanguage: editLanguage || null,
          }),
        });

        if (!res.ok) {
          throw new Error(t.dashboard.settings.profile.failedToUpdateDatabase);
        }
      }

      // Success - exit edit mode and notify parent
      setIsEditing(false);
      onProfileUpdated?.();
    } catch (err) {
      console.error('Error updating profile:', err);
      setSaveError(t.dashboard.settings.profile.failedToSave);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel (January 13th, 2026)
  const handleCancel = () => {
    setIsEditing(false);
    setEditName(userName);
    setEditCountry(currentCountry || '');
    setEditLanguage(currentLanguage || '');
    setSaveError(null);
    setIsCountryOpen(false);
    setIsLanguageOpen(false);
  };

  // Get country code for flag (January 13th, 2026)
  const getCountryCode = (countryName: string) => {
    return COUNTRIES.find(c => c.name === countryName)?.code || '';
  };

  // February 2, 2026: Updated to use flag codes instead of symbols (matching onboarding)
  const getLanguageCode = (langName: string) => {
    return LANGUAGES.find(l => l.name === langName)?.code || '';
  };
  
  // Flag URL helper - same pattern as onboarding and countries dropdown
  const getFlagUrl = (code: string) => `https://flagcdn.com/w20/${code}.png`;
  
  return (
    <div className="space-y-6">
      {/* User Info - Name & Email — smoover refresh (April 25th, 2026).
          Labels become muted smoover eyebrows; edit-mode inputs keep yellow
          border as "you're editing" signal but gain rounded-lg + yellow focus
          ring; read-mode boxes adopt hairline + soft bg. */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.dashboard.settings.profile.fullName}</label>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-[#1a1a1a] border border-[#ffbf23] rounded-lg text-sm text-[#0f172a] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#ffbf23]/20"
              placeholder={t.dashboard.settings.profile.enterYourName}
              disabled={isSaving}
              autoFocus
            />
          ) : (
            <div className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-lg text-sm text-[#425466] dark:text-gray-300 font-medium">
              {userName}
            </div>
          )}
          {saveError && (
            <p className="text-xs text-red-500 font-medium">{saveError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.dashboard.settings.profile.emailAddress}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-[#8898aa]" size={16} />
            <div className="w-full pl-9 pr-3 py-2.5 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-lg text-sm text-[#425466] dark:text-gray-300 font-medium">
              {userEmail}
            </div>
          </div>
          <p className="text-xs text-[#8898aa]">{t.dashboard.settings.profile.emailCannotChange}</p>
        </div>
      </div>

      {/* Country & Language Section — smoover refresh (April 25th, 2026) */}
      <div className="pt-4 border-t border-[#e6ebf1] dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[#8898aa]" />
          <h4 className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.dashboard.settings.profile.targetMarket}</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country Dropdown — smoover refresh (April 25th, 2026). Matches onboarding Step 2 country dropdown pattern. */}
          <div className="space-y-1.5 relative" ref={countryDropdownRef}>
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.dashboard.settings.profile.country}</label>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryOpen(!isCountryOpen);
                    setIsLanguageOpen(false);
                  }}
                  disabled={isSaving}
                  className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-[#1a1a1a] border border-[#ffbf23] rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#ffbf23]/20 disabled:opacity-50"
                >
                  {editCountry ? (
                    <span className="flex items-center gap-2">
                      <img
                        src={`https://flagcdn.com/w20/${getCountryCode(editCountry)}.png`}
                        alt={editCountry}
                        className="w-5 h-4 object-cover border border-[#e6ebf1]"
                      />
                      <span className="text-[#0f172a] dark:text-white">{editCountry}</span>
                    </span>
                  ) : (
                    <span className="text-[#8898aa]">{t.dashboard.settings.profile.selectCountry}</span>
                  )}
                  <ChevronDown size={14} className={cn("text-[#8898aa] transition-transform", isCountryOpen && "rotate-180")} />
                </button>

                {/* Country Dropdown Menu */}
                {isCountryOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-700 rounded-xl shadow-soft-lg z-50 max-h-48 overflow-y-auto">
                    {COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setEditCountry(country.name);
                          setIsCountryOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                          editCountry === country.name ? "bg-[#ffbf23]/20" : "hover:bg-[#ffbf23]/10"
                        )}
                      >
                        <img
                          src={`https://flagcdn.com/w20/${country.code}.png`}
                          alt={country.name}
                          className="w-5 h-4 object-cover border border-[#e6ebf1]"
                        />
                        <span className="text-[#0f172a] dark:text-white">{country.name}</span>
                        {editCountry === country.name && <Check size={14} className="ml-auto text-[#ffbf23]" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-lg text-sm text-[#425466] dark:text-gray-300 font-medium flex items-center gap-2">
                {currentCountry ? (
                  <>
                    <img
                      src={`https://flagcdn.com/w20/${getCountryCode(currentCountry)}.png`}
                      alt={currentCountry}
                      className="w-5 h-4 object-cover border border-[#e6ebf1]"
                    />
                    <span>{currentCountry}</span>
                  </>
                ) : (
                  <span className="text-[#8898aa]">{t.dashboard.settings.profile.notSet}</span>
                )}
              </div>
            )}
          </div>

          {/* Language Dropdown — smoover refresh (April 25th, 2026). Same pattern as Country dropdown above. */}
          <div className="space-y-1.5 relative" ref={languageDropdownRef}>
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.dashboard.settings.profile.language}</label>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsLanguageOpen(!isLanguageOpen);
                    setIsCountryOpen(false);
                  }}
                  disabled={isSaving}
                  className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-[#1a1a1a] border border-[#ffbf23] rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#ffbf23]/20 disabled:opacity-50"
                >
                  {/* February 2, 2026: Updated to show flag instead of symbol */}
                  {editLanguage ? (
                    <span className="flex items-center gap-2">
                      <img
                        src={getFlagUrl(getLanguageCode(editLanguage))}
                        alt={editLanguage}
                        className="w-5 h-4 object-cover border border-[#e6ebf1]"
                      />
                      <span className="text-[#0f172a] dark:text-white">{editLanguage}</span>
                    </span>
                  ) : (
                    <span className="text-[#8898aa]">{t.dashboard.settings.profile.selectLanguage}</span>
                  )}
                  <ChevronDown size={14} className={cn("text-[#8898aa] transition-transform", isLanguageOpen && "rotate-180")} />
                </button>

                {/* Language Dropdown Menu - February 2, 2026: Updated to show flags */}
                {isLanguageOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-700 rounded-xl shadow-soft-lg z-50 max-h-48 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.name}
                        type="button"
                        onClick={() => {
                          setEditLanguage(lang.name);
                          setIsLanguageOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                          editLanguage === lang.name ? "bg-[#ffbf23]/20" : "hover:bg-[#ffbf23]/10"
                        )}
                      >
                        <img
                          src={getFlagUrl(lang.code)}
                          alt={lang.name}
                          className="w-5 h-4 object-cover border border-[#e6ebf1]"
                        />
                        <span className="text-[#0f172a] dark:text-white">{lang.name}</span>
                        {editLanguage === lang.name && <Check size={14} className="ml-auto text-[#ffbf23]" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* February 2, 2026: Updated to show flag instead of symbol */
              <div className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-lg text-sm text-[#425466] dark:text-gray-300 font-medium flex items-center gap-2">
                {currentLanguage ? (
                  <>
                    <img
                      src={getFlagUrl(getLanguageCode(currentLanguage))}
                      alt={currentLanguage}
                      className="w-5 h-4 object-cover border border-[#e6ebf1]"
                    />
                    <span>{currentLanguage}</span>
                  </>
                ) : (
                  <span className="text-[#8898aa]">{t.dashboard.settings.profile.notSet}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons — smoover refresh (April 24th, 2026)
          Divider: hairline border-t border-[#e6ebf1].
          Cancel: rounded-full hairline secondary (matches smoover secondary pattern).
          Save / Edit Profile: rounded-full + shadow-yellow-glow-sm primary CTA
          (identical to every other smoover yellow CTA). */}
      <div className="pt-4 border-t border-[#e6ebf1] dark:border-gray-700 flex justify-end gap-3">
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-all disabled:opacity-50"
            >
              {t.dashboard.settings.profile.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editName.trim()}
              className="px-5 py-2 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.dashboard.settings.profile.saving}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {t.dashboard.settings.profile.saveChanges}
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-5 py-2.5 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all"
          >
            {t.dashboard.settings.profile.editProfile}
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PLAN SETTINGS — SMOOVER REFRESH (April 25th, 2026)
//
// Migrated from neo-brutalist to the smoover design language.
//
// Status badges (getStatusBadge + getInvoiceStatusBadge): brutalist solid
//   blocks (bg-*-500 + text-white + border-black + font-black uppercase)
//   -> hairline tinted pills (rounded-full + bg-*-50 + text-*-700 +
//   border-*-200 + font-semibold). Vivid semantic colour preserved as the
//   signal; weight comes from the tint, not from a heavy block.
//
// Current Plan card: border-2 brutalist block -> rounded-2xl + hairline +
//   shadow-soft-sm. Active/paid uses #fff4d1 (Sidebar nav-active soft yellow
//   tint). Trialing softens to bg-blue-50 + border-blue-200. Plan name h-tag
//   drops font-black uppercase. Upgrade/Manage = smoover yellow CTA
//   (rounded-full + shadow-yellow-glow-sm + hover:-translate-y-px).
//
// Trial / Past-due / Subscription-ended callouts: smoover rounded-xl +
//   bg-*-50 + hairline border-*-500 (matches Security modal warning).
//
// Payment Method: filled-state row -> bg-[#f6f9fc] + hairline + rounded-xl;
//   mini card icon tile becomes a white pill with shadow-soft-sm. Empty
//   state is dashed hairline + soft bg + rounded-xl. Add Payment Method =
//   smoover yellow CTA. Update Payment Method becomes a smoover text-button
//   (no uppercase, font-semibold).
//
// Invoice History: loading + empty states use the soft-bg + hairline pattern.
//   Error matches the smoover red callout. The TABLE switches to a hairline
//   rounded-xl shell with eyebrow column headers (font-semibold + #8898aa +
//   tracking-wider) and hairline body row dividers; hover tints to #f6f9fc.
//   Action icon links pick up rounded-md + smoover muted hover.
//
// Cancel Plan: hairline divider + smoover h3 + smoover destructive
//   secondary pill (matches Security Delete Account button).
//
// Cancellation Pending: smoover orange callout + secondary pill (white bg +
//   hairline orange-200; hover promotes to vivid orange-500).
//
// =============================================================================
interface PlanSettingsProps {
  subscription: any;
  isLoading: boolean;
  isTrialing: boolean;
  isPastDue?: boolean;
  daysLeftInTrial: number | null;
  onUpgrade: () => void;
  onAddCard: () => void;
  onCancelPlan: () => void;
  userId: number | null; // Added December 2025 for invoice fetching
}

// =============================================================================
// INVOICE TYPES
// Added December 2025 to display invoice history from Stripe
// Updated January 8th, 2026 for neo-brutalist design
// =============================================================================
interface Invoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
}

function PlanSettings({ subscription, isLoading, isTrialing, isPastDue = false, daysLeftInTrial, onUpgrade, onAddCard, onCancelPlan, userId }: PlanSettingsProps) {
  // January 17, 2026: Added i18n support
  const { t } = useLanguage();
  
  // =========================================================================
  // INVOICE STATE & FETCHING
  // Added December 2025 to display invoice history from Stripe
  // =========================================================================
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!userId) return;
    
    setInvoicesLoading(true);
    setInvoicesError(null);
    
    try {
      const response = await fetch(`/api/stripe/invoices?userId=${userId}`);
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch invoices');
      }
      
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error('[PlanSettings] Error fetching invoices:', err);
      setInvoicesError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  }, [userId]);

  // Fetch invoices when component mounts or userId changes
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Format currency amount (cents to display)
  const formatAmount = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    const currencySymbol = currency === 'eur' ? '€' : currency === 'usd' ? '$' : currency.toUpperCase() + ' ';
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  // Format date from Unix timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get status badge styling for invoices — smoover refresh (April 25th, 2026).
  // Was: solid bg-*-500 + text-white + border-black brutalist blocks.
  // Now: hairline tinted pills (bg-*-50 + text-*-700 + border-*-200). Vivid
  // semantic colour preserved as the signal; weight comes from the tint, not
  // from a heavy block. Callsite renders `rounded-full + font-semibold`.
  const getInvoiceStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { label: t.dashboard.settings.plan.invoiceStatus.paid.toUpperCase(), bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' };
      case 'open':
        return { label: t.dashboard.settings.plan.invoiceStatus.open.toUpperCase(), bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' };
      case 'draft':
        return { label: t.dashboard.settings.plan.invoiceStatus.draft.toUpperCase(), bg: 'bg-[#f6f9fc] dark:bg-gray-800', text: 'text-[#425466] dark:text-gray-300', border: 'border-[#e6ebf1] dark:border-gray-700' };
      case 'void':
        return { label: t.dashboard.settings.plan.invoiceStatus.void.toUpperCase(), bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' };
      case 'uncollectible':
        return { label: t.dashboard.settings.plan.invoiceStatus.uncollectible.toUpperCase(), bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' };
      default:
        return { label: status?.toUpperCase() || t.dashboard.settings.plan.invoiceStatus.unknown.toUpperCase(), bg: 'bg-[#f6f9fc] dark:bg-gray-800', text: 'text-[#425466] dark:text-gray-300', border: 'border-[#e6ebf1] dark:border-gray-700' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#8898aa]" />
      </div>
    );
  }

  // Format plan name for display
  // January 17, 2026: Updated with i18n translations
  const getPlanDisplayName = (plan: string) => {
    const names: Record<string, string> = {
      'free_trial': t.dashboard.settings.plan.freeTrial,
      'pro': t.dashboard.settings.plan.pro,
      'business': t.dashboard.settings.plan.growth, // 'business' plan displays as 'Growth'
      'enterprise': t.dashboard.settings.plan.enterprise,
    };
    return names[plan] || plan;
  };

  // Get status badge color — smoover refresh (April 25th, 2026).
  // Same hairline tinted pill pattern as getInvoiceStatusBadge above.
  // Default (active fallback) uses the soft yellow #fff4d1 tint that matches
  // the Sidebar nav-active state (bg-[#fff4d1] + #ffbf23/30 hairline).
  const getStatusBadge = () => {
    if (subscription?.cancel_at_period_end) {
      return { label: t.dashboard.settings.plan.cancelled.toUpperCase(), bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' };
    }
    if (isTrialing) {
      return { label: t.dashboard.settings.plan.trial.toUpperCase(), bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' };
    }
    if (subscription?.status === 'active') {
      return { label: t.dashboard.settings.plan.active.toUpperCase(), bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' };
    }
    if (subscription?.status === 'past_due') {
      return { label: t.dashboard.settings.plan.pastDue.toUpperCase(), bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' };
    }
    if (subscription?.status === 'canceled') {
      return { label: t.dashboard.settings.plan.expired.toUpperCase(), bg: 'bg-[#f6f9fc] dark:bg-gray-800', text: 'text-[#425466] dark:text-gray-300', border: 'border-[#e6ebf1] dark:border-gray-700' };
    }
    return { label: t.dashboard.settings.plan.active.toUpperCase(), bg: 'bg-[#fff4d1] dark:bg-[#ffbf23]/10', text: 'text-[#0f172a] dark:text-[#ffbf23]', border: 'border-[#ffbf23]/30 dark:border-[#ffbf23]/40' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="space-y-8">
      {/* Current Plan card — smoover refresh (April 25th, 2026).
          border-2 brutalist block -> rounded-2xl + hairline border + soft shadow.
          Trialing variant softens to bg-blue-50 + border-blue-200.
          Active/paid variant uses #fff4d1 (Sidebar nav-active soft yellow tint)
          + #ffbf23/30 hairline (no more solid #ffbf23 border). */}
      <div className={cn(
        "p-5 rounded-2xl border space-y-4 shadow-soft-sm",
        isTrialing
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "bg-[#fff4d1] dark:bg-[#ffbf23]/10 border-[#ffbf23]/30 dark:border-[#ffbf23]/40"
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-[#0f172a] dark:text-white">
                {subscription ? getPlanDisplayName(subscription.plan) : t.dashboard.settings.plan.noPlan}
              </span>
              {subscription && (
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                  statusBadge.bg, statusBadge.text, statusBadge.border
                )}>
                  {statusBadge.label}
                </span>
              )}
            </div>

            {/* Trial info - January 17, 2026: Updated with i18n */}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-semibold">
                <Clock size={12} />
                <span>
                  {daysLeftInTrial === 0
                    ? t.dashboard.settings.plan.trialEndsToday
                    : daysLeftInTrial === 1
                      ? `1 ${t.dashboard.settings.plan.dayLeftInTrial}`
                      : `${daysLeftInTrial} ${t.dashboard.settings.plan.daysLeft}`
                  }
                </span>
              </div>
            )}

            {/* Billing info - January 17, 2026: Updated with i18n */}
            {subscription && !isTrialing && subscription.nextBillingDate && (
              <div className="flex items-center gap-1.5 text-xs text-[#425466] dark:text-gray-400 font-medium">
                <Calendar size={12} />
                <span>{t.dashboard.settings.plan.nextBilling}: {subscription.nextBillingDate}</span>
              </div>
            )}

            {/* Price - January 17, 2026: Updated with i18n */}
            {subscription && subscription.formattedPrice && (
              <p className="text-xs text-[#425466] dark:text-gray-400 font-medium">
                {subscription.formattedPrice}
                {subscription.billing_interval === 'annual' && ` (${t.dashboard.settings.plan.billedAnnually})`}
              </p>
            )}
          </div>

          {/* Upgrade / Manage button — smoover primary CTA. */}
          {(!subscription || subscription.plan !== 'enterprise') && (
            <button
              onClick={onUpgrade}
              className="px-5 py-2 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all flex items-center gap-1.5"
            >
              <Zap size={14} />
              {!subscription
                ? t.dashboard.settings.plan.choosePlan
                : isTrialing
                  ? t.dashboard.settings.plan.upgradePlan
                  : t.dashboard.settings.plan.managePlan
              }
            </button>
          )}
        </div>

        {/* Trial warning — smoover callout (matches Security modal warning pattern). */}
        {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-500 rounded-xl">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold">{t.dashboard.settings.plan.trialEndingSoon.title}</p>
              <p className="text-amber-700 dark:text-amber-400">{t.dashboard.settings.plan.trialEndingSoon.subtitle}</p>
            </div>
          </div>
        )}

        {/* Payment failed — past_due. Same smoover red callout as Security errors. */}
        {isPastDue && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl">
            <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 dark:text-red-300">
              <p className="font-semibold">{t.dashboard.settings.plan.paymentFailedBanner.title}</p>
              <p className="text-red-700 dark:text-red-400">{t.dashboard.settings.plan.paymentFailedBanner.subtitle}</p>
            </div>
          </div>
        )}

        {/* Subscription ended — canceled. Smoover orange callout. */}
        {subscription?.status === 'canceled' && !subscription?.cancel_at_period_end && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-500 rounded-xl">
            <AlertTriangle size={14} className="text-orange-600 shrink-0 mt-0.5" />
            <div className="text-xs text-orange-800 dark:text-orange-300">
              <p className="font-semibold">{t.dashboard.settings.plan.subscriptionEndedBanner.title}</p>
              <p className="text-orange-700 dark:text-orange-400">{t.dashboard.settings.plan.subscriptionEndedBanner.subtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method — smoover refresh (April 25th, 2026).
          h3 drops font-black uppercase. Filled-state row migrates to soft
          bg-[#f6f9fc] + hairline + rounded-xl; mini card icon tile becomes
          a subtle white pill with shadow-soft-sm. Update Payment Method
          becomes a smoover text-button (font-semibold, no uppercase).
          Empty state mirrors Settings' empty-state language: dashed hairline
          + soft bg + rounded-xl. Add Payment Method = smoover yellow CTA. */}
      <div>
        <h3 className="text-base font-semibold text-[#0f172a] dark:text-white mb-4">{t.dashboard.settings.plan.paymentMethod}</h3>
        {subscription?.card_last4 ? (
          <div className="p-4 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-white dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 rounded-md flex items-center justify-center shadow-soft-sm">
                <CreditCard size={16} className="text-[#8898aa]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0f172a] dark:text-white">
                  {subscription.card_brand || t.dashboard.settings.plan.card} •••• {subscription.card_last4}
                </p>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <p className="text-xs text-[#8898aa] dark:text-gray-500">
                    {t.dashboard.settings.plan.expires} {String(subscription.card_exp_month).padStart(2, '0')}/{String(subscription.card_exp_year).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onAddCard}
              className="text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white transition-colors"
            >
              {t.dashboard.settings.plan.updatePaymentMethod}
            </button>
          </div>
        ) : (
          <div className="p-6 bg-[#f6f9fc] dark:bg-gray-900/50 border border-dashed border-[#e6ebf1] dark:border-gray-600 rounded-xl text-center">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-soft-sm">
              <CreditCard size={20} className="text-[#8898aa]" />
            </div>
            <p className="text-sm text-[#0f172a] dark:text-gray-300 font-semibold mb-1">{t.dashboard.settings.plan.noPaymentMethod.title}</p>
            <p className="text-xs text-[#8898aa] dark:text-gray-500 mb-4">
              {isTrialing
                ? t.dashboard.settings.plan.noPaymentMethod.trialSubtitle
                : t.dashboard.settings.plan.noPaymentMethod.defaultSubtitle
              }
            </p>
            <button
              onClick={onAddCard}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all"
            >
              <Plus size={14} />
              {t.dashboard.settings.plan.addPaymentMethod}
            </button>
          </div>
        )}
      </div>

      {/* Invoices — smoover refresh (April 25th, 2026).
          h3 + state panels migrated to smoover tokens. Loading + empty
          states use the soft-bg + hairline pattern. Error matches the
          smoover red callout (rounded-xl + bg-red-50 + hairline red-500).
          The invoice TABLE switches to a hairline rounded-xl shell with
          eyebrow column headers and hairline body row dividers. Action
          icon links pick up rounded-md + smoover muted hover. */}
      <div>
        <h3 className="text-base font-semibold text-[#0f172a] dark:text-white mb-4">{t.dashboard.settings.plan.invoiceHistory}</h3>

        {/* Loading State */}
        {invoicesLoading && (
          <div className="p-8 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#8898aa]" />
            <span className="ml-2 text-sm text-[#8898aa] dark:text-gray-400 font-medium">{t.dashboard.settings.plan.loadingInvoices}</span>
          </div>
        )}

        {/* Error State */}
        {!invoicesLoading && invoicesError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-500 flex items-center gap-3">
            <XCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-semibold">{invoicesError}</p>
            <button
              onClick={fetchInvoices}
              className="ml-auto text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
            >
              {t.dashboard.settings.plan.retry}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!invoicesLoading && !invoicesError && invoices.length === 0 && (
          <div className="p-8 bg-[#f6f9fc] dark:bg-gray-900/50 border border-dashed border-[#e6ebf1] dark:border-gray-600 rounded-xl text-center">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-soft-sm">
              <FileText size={20} className="text-[#8898aa]" />
            </div>
            <p className="text-sm text-[#0f172a] dark:text-gray-300 font-semibold">{t.dashboard.settings.plan.noInvoicesYet.title}</p>
            <p className="text-xs text-[#8898aa] dark:text-gray-500 mt-1">
              {t.dashboard.settings.plan.noInvoicesYet.subtitle}
            </p>
          </div>
        )}

        {/* Invoice List — smoover hairline table. Header row uses eyebrow tokens
            (font-semibold + #8898aa + tracking-wider). Body rows hairline-divide
            on #e6ebf1; hover tints to #f6f9fc. */}
        {!invoicesLoading && !invoicesError && invoices.length > 0 && (
          <div className="border border-[#e6ebf1] dark:border-gray-700 rounded-xl overflow-hidden shadow-soft-sm">
            {/* Table Header */}
            <div className="bg-[#f6f9fc] dark:bg-gray-800 px-4 py-3 border-b border-[#e6ebf1] dark:border-gray-700 grid grid-cols-12 gap-4 text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">{t.dashboard.settings.plan.invoiceColumns.invoice}</div>
              <div className="col-span-3">{t.dashboard.settings.plan.invoiceColumns.date}</div>
              <div className="col-span-2">{t.dashboard.settings.plan.invoiceColumns.amount}</div>
              <div className="col-span-2">{t.dashboard.settings.plan.invoiceColumns.status}</div>
              <div className="col-span-2 text-right">{t.dashboard.settings.plan.invoiceColumns.actions}</div>
            </div>

            {/* Invoice Rows */}
            {invoices.map((invoice) => {
              const statusBadge = getInvoiceStatusBadge(invoice.status);
              return (
                <div
                  key={invoice.id}
                  className="px-4 py-3 border-b border-[#e6ebf1] dark:border-gray-700 last:border-b-0 grid grid-cols-12 gap-4 items-center hover:bg-[#f6f9fc] dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Invoice Number & Description */}
                  <div className="col-span-3">
                    <p className="text-sm font-semibold text-[#0f172a] dark:text-white">
                      {invoice.number || t.dashboard.settings.plan.invoiceStatus.draft}
                    </p>
                    {invoice.description && (
                      <p className="text-xs text-[#8898aa] dark:text-gray-500 truncate" title={invoice.description}>
                        {invoice.description}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-span-3">
                    <p className="text-sm text-[#425466] dark:text-gray-400 font-medium">
                      {formatDate(invoice.created)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-[#0f172a] dark:text-white">
                      {formatAmount(invoice.amount_due, invoice.currency)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                      statusBadge.bg, statusBadge.text, statusBadge.border
                    )}>
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 transition-colors"
                        title={t.dashboard.settings.plan.viewInvoice}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {invoice.invoice_pdf && (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 transition-colors"
                        title={t.dashboard.settings.plan.downloadPdf}
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Plan Section — smoover refresh (April 25th, 2026).
          Hairline divider, smoover h3 + body, destructive secondary pill
          (matches Security Delete Account button: rounded-full + bg-red-50
          + hairline red-200 + font-semibold; hover promotes to red-500). */}
      {subscription && subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
        <div className="pt-6 border-t border-[#e6ebf1] dark:border-gray-700">
          <h3 className="text-base font-semibold text-[#0f172a] dark:text-white mb-2">{t.dashboard.settings.plan.cancelSubscription.title}</h3>
          <p className="text-xs text-[#8898aa] dark:text-gray-500 mb-4">
            {t.dashboard.settings.plan.cancelSubscription.subtitle}
          </p>
          <button
            onClick={onCancelPlan}
            className="px-5 py-2 text-sm font-semibold text-red-600 hover:text-white bg-red-50 dark:bg-red-900/30 hover:bg-red-500 border border-red-200 dark:border-red-800 hover:border-red-500 rounded-full transition-all"
          >
            {t.dashboard.settings.plan.cancelSubscription.button}
          </button>
        </div>
      )}

      {/* Cancellation pending notice — smoover refresh.
          Inner orange callout matches the warning callout pattern (rounded-xl
          + bg-orange-50 + hairline orange-500). Resume button is a smoover
          orange secondary pill (white bg + hairline + hover promotes to vivid
          orange-500). */}
      {subscription?.cancel_at_period_end && (
        <div className="pt-6 border-t border-[#e6ebf1] dark:border-gray-700">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-500 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-base font-semibold text-orange-800 dark:text-orange-300">{t.dashboard.settings.plan.cancellationPending.title}</h4>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  {t.dashboard.settings.plan.cancellationPending.subtitle}
                </p>
                <button
                  onClick={onCancelPlan}
                  className="mt-3 px-4 py-1.5 text-sm font-semibold text-orange-700 hover:text-white bg-white dark:bg-gray-900 hover:bg-orange-500 border border-orange-200 dark:border-orange-800 hover:border-orange-500 rounded-full transition-all"
                >
                  {t.dashboard.settings.plan.cancellationPending.resumeButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BUY CREDITS SETTINGS — SMOOVER REFRESH (April 25th, 2026)
//
// One-time credit top-up purchase UI.
// Credits are added on top of the monthly plan allocation.
// Top-up credits never expire and persist across billing cycles.
//
// Credit packs: Email credits, AI Outreach credits, Topic Searches
// Stripe one-time payment (not subscription).
//
// Smoover migration:
// - 4 status callouts (success / cancelled / trial gate / error): bg-*-500/10
//   + border-2 -> rounded-xl + bg-*-50 + hairline border-*-500. font-bold ->
//   font-semibold. Dismiss buttons drop uppercase + font-black.
// - Header callout: bg-[#ffbf23]/10 + border-2 -> #fff4d1 + #ffbf23/30 +
//   rounded-xl. Icon tile = solid yellow rounded-md + shadow-yellow-glow-sm
//   (no more black border-2 frame).
// - Category Selector tiles: brutalist offset shadow -> Sidebar nav-active
//   pattern (bg-[#fff4d1] + #ffbf23 hairline + shadow-soft-sm). Idle hairline
//   white tile, hover tints to #f6f9fc. Tile labels drop font-black uppercase.
// - Pack cards: brutalist 4px offset -> rounded-2xl + hairline + shadow-soft-sm
//   (popular variant gets shadow-yellow-glow-sm + #ffbf23 hairline). "Most
//   Popular" ribbon = solid #1A1D21 pill + #ffbf23 hairline + rounded-full +
//   font-semibold (no more border-2 black frame).
// - Buy buttons: Popular = smoover yellow primary CTA (rounded-full +
//   shadow-yellow-glow-sm + hover:-translate-y-px). Regular = dark smoover
//   secondary (#0f172a -> #1A1D21 hover, rounded-full, shadow-soft-sm).
// - Info footer: hairline divider; titles drop font-black uppercase to
//   font-semibold; body uses muted #8898aa. Yellow icons retained as accent.
// =============================================================================

const CREDIT_PACKS = {
  email: [
    { id: 'email_50', credits: 50, price: 19 },
    { id: 'email_150', credits: 150, price: 49 },
    { id: 'email_500', credits: 500, price: 129 },
  ],
  ai: [
    { id: 'ai_50', credits: 50, price: 19 },
    { id: 'ai_150', credits: 150, price: 49 },
    { id: 'ai_500', credits: 500, price: 129 },
  ],
  search: [
    { id: 'search_5', credits: 5, price: 29 },
    { id: 'search_15', credits: 15, price: 69 },
  ],
} as const;

interface BuyCreditsSettingsProps {
  userId: number | null;
  isTrialing?: boolean;
  creditPurchaseSuccess?: boolean;
  creditPurchaseCancelled?: boolean;
  onDismissPurchaseSuccess?: () => void;
  onDismissPurchaseCancelled?: () => void;
}

function BuyCreditsSettings({ userId, isTrialing = false, creditPurchaseSuccess = false, creditPurchaseCancelled = false, onDismissPurchaseSuccess, onDismissPurchaseCancelled }: BuyCreditsSettingsProps) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<'email' | 'ai' | 'search'>('email');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // April 28, 2026: i18n-migrated — labels/descriptions previously hardcoded English.
  const categories = [
    { id: 'email' as const, label: t.dashboard.settings.buyCredits.categories.email.label, icon: <Mail size={16} />, description: t.dashboard.settings.buyCredits.categories.email.description },
    { id: 'ai' as const, label: t.dashboard.settings.buyCredits.categories.ai.label, icon: <Sparkles size={16} />, description: t.dashboard.settings.buyCredits.categories.ai.description },
    { id: 'search' as const, label: t.dashboard.settings.buyCredits.categories.search.label, icon: <Search size={16} />, description: t.dashboard.settings.buyCredits.categories.search.description },
  ];

  const handlePurchase = async (packId: string) => {
    if (!userId) return;
    setPurchasingId(packId);
    setPurchaseError(null);
    try {
      const res = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, packId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // April 28, 2026: i18n migration — server's `data.error` is dropped
        // since it's English. Always show the translated fallback.
        setPurchaseError(t.dashboard.settings.buyCredits.errors.failedToStartCheckout);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setPurchaseError(t.dashboard.settings.buyCredits.errors.invalidResponse);
    } catch (err) {
      setPurchaseError(t.dashboard.settings.buyCredits.errors.networkError);
    } finally {
      setPurchasingId(null);
    }
  };

  const currentPacks = CREDIT_PACKS[selectedCategory];

  return (
    <div className="space-y-8">
      {/* Status callouts — smoover refresh (April 25th, 2026).
          bg-*-500/10 + border-2 -> rounded-xl + bg-*-50 + hairline border-*-500.
          Vivid border kept as the colour signal. font-bold -> font-semibold;
          dismiss buttons drop uppercase + font-black. */}
      {/* April 28, 2026: i18n-migrated callouts. */}
      {creditPurchaseSuccess && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-500 flex items-center justify-between">
          <span className="text-sm font-semibold text-green-800 dark:text-green-200">{t.dashboard.settings.buyCredits.callouts.successAdded}</span>
          {onDismissPurchaseSuccess && (
            <button type="button" onClick={onDismissPurchaseSuccess} className="text-sm font-semibold text-green-700 dark:text-green-300 hover:underline transition-colors">
              {t.dashboard.settings.buyCredits.callouts.dismiss}
            </button>
          )}
        </div>
      )}
      {creditPurchaseCancelled && (
        <div className="p-4 rounded-xl bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-600 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0f172a] dark:text-gray-200">{t.dashboard.settings.buyCredits.callouts.purchaseCancelled}</span>
          {onDismissPurchaseCancelled && (
            <button type="button" onClick={onDismissPurchaseCancelled} className="text-sm font-semibold text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white transition-colors">
              {t.dashboard.settings.buyCredits.callouts.dismiss}
            </button>
          )}
        </div>
      )}
      {isTrialing && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-500 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t.dashboard.settings.buyCredits.callouts.trialOnly.title}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{t.dashboard.settings.buyCredits.callouts.trialOnly.subtitle}</p>
          </div>
        </div>
      )}
      {purchaseError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-500 flex items-center justify-between">
          <span className="text-sm font-semibold text-red-800 dark:text-red-200">{purchaseError}</span>
          <button type="button" onClick={() => setPurchaseError(null)} className="text-sm font-semibold text-red-700 dark:text-red-300 hover:underline transition-colors">
            {t.dashboard.settings.buyCredits.callouts.dismiss}
          </button>
        </div>
      )}
      {/* Header — smoover refresh. bg-[#ffbf23]/10 + border-2 -> #fff4d1 +
          hairline #ffbf23/30 + rounded-xl. Icon tile becomes a solid yellow
          rounded-md pill (no more border-2 border-black). h3 drops font-black
          uppercase. */}
      <div className="p-4 bg-[#fff4d1] dark:bg-[#ffbf23]/10 border border-[#ffbf23]/30 dark:border-[#ffbf23]/40 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#ffbf23] rounded-md shadow-yellow-glow-sm">
            <Coins size={20} className="text-[#1A1D21]" />
          </div>
          <div>
            {/* April 28, 2026: i18n-migrated header. */}
            <h3 className="text-base font-semibold text-[#0f172a] dark:text-white">{t.dashboard.settings.buyCredits.header.title}</h3>
            <p className="text-xs text-[#425466] dark:text-gray-400 mt-1">
              {t.dashboard.settings.buyCredits.header.description}
            </p>
          </div>
        </div>
      </div>

      {/* Category Selector — smoover refresh.
          h3 drops font-black uppercase tracking-wide.
          Active tile uses the Sidebar nav-active soft yellow tint
          (bg-[#fff4d1] + hairline #ffbf23 + shadow-soft-sm; no offset shadow).
          Idle tile is hairline white -> hover:bg-[#f6f9fc] (no more
          border-thickening hover). Tile labels drop font-black uppercase. */}
      <div>
        {/* April 28, 2026: i18n-migrated section header. */}
        <h3 className="text-base font-semibold text-[#0f172a] dark:text-white mb-4">{t.dashboard.settings.buyCredits.selectType}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "p-4 rounded-xl border text-left transition-all duration-200",
                selectedCategory === cat.id
                  ? "bg-[#fff4d1] dark:bg-[#ffbf23]/10 border-[#ffbf23] shadow-soft-sm"
                  : "bg-white dark:bg-[#0f0f0f] border-[#e6ebf1] dark:border-gray-700 hover:bg-[#f6f9fc] dark:hover:bg-gray-900"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  selectedCategory === cat.id ? "text-[#ffbf23]" : "text-[#8898aa]"
                )}>
                  {cat.icon}
                </span>
                <span className={cn(
                  "text-sm font-semibold",
                  selectedCategory === cat.id ? "text-[#0f172a] dark:text-white" : "text-[#425466] dark:text-gray-400"
                )}>
                  {cat.label}
                </span>
              </div>
              <p className="text-[10px] text-[#8898aa] dark:text-gray-500 leading-relaxed">{cat.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Credit Packs */}
      {/* Credit Pack cards — smoover refresh.
          h3 drops font-black uppercase tracking-wide.
          Popular variant: hairline #ffbf23 + rounded-2xl + shadow-yellow-glow-sm
          (replaces 4px brutalist offset). Regular variant: hairline #e6ebf1
          + rounded-2xl + shadow-soft-sm; hover promotes to shadow-soft-lg.
          "Most Popular" ribbon: solid #1A1D21 pill + #ffbf23 hairline +
          rounded-full + font-semibold (drops uppercase tracking-wide / heavy
          black border-2 frame).
          Buy buttons: Popular = smoover yellow primary CTA (rounded-full +
          shadow-yellow-glow-sm + hover:-translate-y-px). Regular = dark
          smoover secondary (#0f172a -> #1A1D21 hover, rounded-full,
          shadow-soft-sm). */}
      <div>
        {/* April 28, 2026: i18n-migrated section header. */}
        <h3 className="text-base font-semibold text-[#0f172a] dark:text-white mb-4">{t.dashboard.settings.buyCredits.choosePack}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {currentPacks.map((pack, idx) => {
            const isPopular = idx === 1;
            const isPurchasing = purchasingId === pack.id;

            return (
              <div
                key={pack.id}
                className={cn(
                  "relative p-5 rounded-2xl border flex flex-col transition-all duration-200",
                  isPopular
                    ? "border-[#ffbf23] shadow-yellow-glow-sm bg-white dark:bg-[#0f0f0f]"
                    : "border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm hover:shadow-soft-lg bg-white dark:bg-[#0f0f0f]"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-0 right-0 flex justify-center">
                    <span className="bg-[#1A1D21] text-[#ffbf23] text-[10px] font-semibold uppercase tracking-wider px-3 py-1 border border-[#ffbf23] rounded-full shadow-soft-sm">
                      {/* April 28, 2026: i18n-migrated. */}
                      {t.dashboard.settings.buyCredits.mostPopular}
                    </span>
                  </div>
                )}

                {/* Credits amount */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      selectedCategory === 'email' ? "text-blue-500" : selectedCategory === 'ai' ? "text-purple-500" : "text-[#ffbf23]"
                    )}>
                      {selectedCategory === 'email' ? <Mail size={16} /> : selectedCategory === 'ai' ? <Sparkles size={16} /> : <Search size={16} />}
                    </span>
                    <span className="text-2xl font-bold text-[#0f172a] dark:text-white tracking-tight">{pack.credits}</span>
                  </div>
                  {/* April 28, 2026: i18n-migrated. */}
                  <p className="text-[10px] text-[#8898aa] dark:text-gray-500 uppercase font-semibold tracking-wider">{t.dashboard.settings.buyCredits.creditsLabel}</p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-2xl font-bold text-[#0f172a] dark:text-white tracking-tight">{CURRENCY_SYMBOL}{pack.price}</span>
                </div>

                {/* Buy button */}
                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={isPurchasing || !userId || isTrialing}
                  className={cn(
                    "w-full py-2.5 text-sm font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-2",
                    isPopular
                      ? "bg-[#ffbf23] text-[#1A1D21] shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px"
                      : "bg-[#0f172a] text-white shadow-soft-sm hover:bg-[#1A1D21] hover:shadow-soft-lg",
                    (isPurchasing || !userId || isTrialing) && "opacity-50 cursor-not-allowed hover:translate-y-0"
                  )}
                >
                  {isPurchasing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart size={12} />
                      {/* April 28, 2026: i18n-migrated. */}
                      {t.dashboard.settings.buyCredits.buyNow}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info footer */}
      {/* Info footer — smoover refresh.
          Hairline divider; titles drop font-black uppercase to font-semibold;
          body text uses muted #8898aa. Yellow icons retained as accent. */}
      {/* April 28, 2026: i18n-migrated benefits footer. */}
      <div className="border-t border-[#e6ebf1] dark:border-gray-700 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#8898aa] dark:text-gray-500">
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#0f172a] dark:text-white">{t.dashboard.settings.buyCredits.benefits.neverExpire.title}</p>
              <p>{t.dashboard.settings.buyCredits.benefits.neverExpire.description}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#0f172a] dark:text-white">{t.dashboard.settings.buyCredits.benefits.instantDelivery.title}</p>
              <p>{t.dashboard.settings.buyCredits.benefits.instantDelivery.description}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#0f172a] dark:text-white">{t.dashboard.settings.buyCredits.benefits.securePayment.title}</p>
              <p>{t.dashboard.settings.buyCredits.benefits.securePayment.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BLOCKED DOMAINS SETTINGS - February 2026
// =============================================================================
function BlockedDomainsSettings() {
  const { t } = useLanguage();
  const { rawData, unblockDomain, count, isLoading } = useBlockedDomains();
  const [unblockConfirming, setUnblockConfirming] = useState<string | null>(null);
  const unblockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUnblockClick = (domain: string) => {
    if (unblockConfirming === domain) {
      if (unblockTimeoutRef.current) clearTimeout(unblockTimeoutRef.current);
      setUnblockConfirming(null);
      unblockDomain(domain);
    } else {
      setUnblockConfirming(domain);
      unblockTimeoutRef.current = setTimeout(() => setUnblockConfirming(null), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (unblockTimeoutRef.current) clearTimeout(unblockTimeoutRef.current);
    };
  }, []);

  const st = t.dashboard.settings.blockedDomains;
  const title = st.title;
  const description = st.description;
  const counter = st.counter;
  const emptyTitle = st.emptyTitle;
  const emptySubtitle = st.emptySubtitle;
  const unblockBtn = st.unblock;
  const confirmUnblock = st.confirmUnblock;
  const domainBlockedOn = st.domainBlockedOn;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#8898aa]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — smoover refresh (April 25th, 2026). Title drops uppercase + font-black; body text + counter soften to smoover tokens. */}
      <div>
        <h2 className="text-lg font-semibold text-[#0f172a] dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-[#425466] dark:text-gray-400">{description}</p>
        <p className="mt-2 text-xs font-medium text-[#8898aa] dark:text-gray-500">
          {counter.replace('{count}', String(count))}
        </p>
      </div>
      {rawData.length === 0 ? (
        /* Empty state — smoover refresh (April 25th, 2026). Hairline + rounded-xl + soft bg (matches onboarding empty states). */
        <div className="py-12 border border-[#e6ebf1] dark:border-gray-700 rounded-xl bg-[#f6f9fc] dark:bg-gray-900 text-center">
          <p className="font-semibold text-[#0f172a] dark:text-white">{emptyTitle}</p>
          <p className="mt-1 text-sm text-[#8898aa] dark:text-gray-400">{emptySubtitle}</p>
        </div>
      ) : (
        /* Blocked domains list — smoover refresh (April 25th, 2026). List rows become rounded-lg hairline cards; red unblock button keeps vivid confirm state but softer idle tint. */
        <ul className="space-y-2">
          {rawData.map((row: { domain: string; created_at: string }) => (
            <li
              key={row.domain}
              className="flex items-center justify-between gap-4 py-3 px-4 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 rounded-lg"
            >
              <div>
                <span className="font-semibold text-[#0f172a] dark:text-white">{row.domain}</span>
                <span className="ml-2 text-xs text-[#8898aa] dark:text-gray-400">
                  {domainBlockedOn} {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <button
                onClick={() => handleUnblockClick(row.domain)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-full transition-all ${
                  unblockConfirming === row.domain
                    ? 'bg-red-500 text-white border-red-500 animate-pulse'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'
                }`}
              >
                {unblockConfirming === row.domain ? confirmUnblock : unblockBtn}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =============================================================================
// SECURITY SETTINGS — SMOOVER REFRESH (April 25th, 2026)
//
// Migrated from neo-brutalist to the smoover design language. Modal shells
// were already smoover via src/app/components/Modal.tsx (Phase 2b, April 23rd);
// this pass covers the BODY content of both modals plus the main tab content.
//
// Main tab:
// - Section titles (Password & Security, Danger Zone): font-black uppercase
//   tracking-wide -> font-semibold text-[#0f172a] (Danger Zone keeps red-600
//   as signal colour).
// - Divider: h-0.5 bg-gray-200 -> h-px bg-[#e6ebf1] (hairline).
// - Change Password: rounded-full hairline secondary (hover:bg-[#f6f9fc]).
// - Delete Account (opens modal): rounded-full + bg-red-50 + hairline
//   red-200; hover promotes to vivid red-500 (matches Unblock idle pattern
//   from BlockedDomainsSettings).
//
// Password Change Modal body:
// - Success + error banners: bg-*-100 + border-2 -> rounded-xl + bg-*-50 +
//   hairline border-*-500 (matches StripeProvider error callout). font-bold
//   -> font-semibold.
// - 3x password fields: brutalist -> smoover inputs (bg-[#f6f9fc] + hairline
//   border + rounded-lg + focus:ring-2 focus:ring-[#ffbf23]/20). Eye-toggle
//   icons use muted #8898aa -> #0f172a hover.
// - Labels: eyebrow pattern (font-semibold text-[#8898aa] uppercase
//   tracking-wider).
// - Cancel: rounded-full hairline secondary. Save: smoover primary yellow
//   (rounded-full + shadow-yellow-glow-sm + hover:-translate-y-px).
//
// Delete Account Modal body:
// - Warning banner + error banner: same smoover red callout (rounded-xl +
//   bg-red-50 + hairline red-500).
// - "What will be deleted" heading: eyebrow pattern. List body uses #425466.
// - DELETE confirmation input: hairline red-400 + rounded-lg + focus ring
//   red-500/20. font-bold -> font-semibold. uppercase tracking-widest kept
//   — it IS the "type DELETE" visual signal.
// - Cancel: rounded-full hairline secondary. Delete Account: destructive
//   PRIMARY — rounded-full + bg-red-500 + font-semibold + shadow-soft-lg.
//   Deliberately NO translate-y hover: irreversible actions shouldn't feel
//   playful.
//
// January 13th, 2026:
// - Added custom password change form with user.updatePassword()
// - Simple modal with current/new/confirm password fields
// - Added Delete Account functionality with confirmation modal
// - User must type "DELETE" to confirm account deletion
// - Deletes: Stripe subscription, all user data, Stack Auth account
// =============================================================================
interface SecuritySettingsProps {
  user: any;
  neonUserId: number | null;
}

function SecuritySettings({ user, neonUserId }: SecuritySettingsProps) {
  // January 17, 2026: Added i18n support
  const { t } = useLanguage();
  
  // January 13th, 2026: State for password change modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  // January 13th, 2026: Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // January 13th, 2026: Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // January 13th, 2026: Delete account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // January 13th, 2026: Reset password form when modal closes
  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  // January 13th, 2026: Handle password modal close
  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
    resetPasswordForm();
  };

  // January 13th, 2026: Reset delete form when modal closes
  const resetDeleteForm = () => {
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  // January 13th, 2026: Handle delete modal close
  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    resetDeleteForm();
  };

  // January 13th, 2026: Handle password change using Stack Auth's user.updatePassword()
  // January 17, 2026: Updated with i18n translations
  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t.dashboard.settings.security.passwordModal.allFieldsRequired);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t.dashboard.settings.security.passwordModal.minLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t.dashboard.settings.security.passwordModal.passwordsDontMatch);
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t.dashboard.settings.security.passwordModal.mustBeDifferent);
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);

    try {
      // Use Stack Auth's updatePassword method
      const result = await user.updatePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
      });

      // Check for errors (Stack Auth returns error object on failure)
      if (result && result.status === 'error') {
        throw new Error(result.error?.message || t.dashboard.settings.security.passwordModal.genericError);
      }

      // Success
      setPasswordSuccess(true);
      setTimeout(() => {
        handleClosePasswordModal();
      }, 1500);
    } catch (err: any) {
      console.error('Error changing password:', err);
      // Handle specific Stack Auth errors
      if (err.message?.includes('PasswordConfirmationMismatch') || err.message?.includes('incorrect')) {
        setPasswordError(t.dashboard.settings.security.passwordModal.incorrectPassword);
      } else if (err.message?.includes('PasswordRequirementsNotMet')) {
        setPasswordError(t.dashboard.settings.security.passwordModal.requirementsNotMet);
      } else {
        setPasswordError(err.message || t.dashboard.settings.security.passwordModal.genericError);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ==========================================================================
  // HANDLE DELETE ACCOUNT - January 13th, 2026
  // 
  // This is an IRREVERSIBLE action that:
  // 1. Cancels Stripe subscription immediately
  // 2. Deletes all user data from Neon DB
  // 3. Deletes user from Stack Auth
  // 4. Signs out and redirects to home
  // ==========================================================================
  // January 17, 2026: Updated with i18n translations
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError(t.dashboard.settings.security.deleteModal.confirmError);
      return;
    }

    if (!neonUserId) {
      setDeleteError(t.dashboard.settings.security.deleteModal.userIdError);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: neonUserId,
          confirmText: deleteConfirmText,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || t.dashboard.settings.security.deleteModal.genericError);
      }

      // Success - redirect to home page
      // The user is already signed out by the API (Stack Auth deletion)
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || t.dashboard.settings.security.deleteModal.genericError);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password & Security — smoover refresh (April 25th, 2026).
          Title drops font-black + uppercase tracking-wide; description uses
          smoover body token; Change Password is a rounded-full hairline
          secondary (no more border-2 + font-bold uppercase). */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-[#0f172a] dark:text-white">{t.dashboard.settings.security.passwordSecurity}</h3>
        <p className="text-sm text-[#425466] dark:text-gray-400">
          {t.dashboard.settings.security.securityDescription}
        </p>
        <div className="pt-2">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-5 py-2 text-sm font-semibold text-[#0f172a] dark:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-colors"
          >
            {t.dashboard.settings.security.changePassword}
          </button>
        </div>
      </div>

      {/* Divider — hairline smoover (was h-0.5 bg-gray-200). */}
      <div className="h-px bg-[#e6ebf1] dark:bg-gray-800" />

      {/* ================================================================= */}
      {/* DANGER ZONE — smoover refresh (April 25th, 2026).                 */}
      {/* Title keeps red-600 signal colour but drops font-black + uppercase */}
      {/* tracking-wide. Delete Account button mirrors the Unblock idle     */}
      {/* pattern: rounded-full + red-50 bg + red-200 hairline + font-      */}
      {/* semibold (hover promotes to vivid red-500). Opens confirmation    */}
      {/* modal — the PRIMARY destructive action lives inside that modal.   */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-red-600">{t.dashboard.settings.security.dangerZone}</h3>
        <p className="text-xs text-[#8898aa] dark:text-gray-500">
          {t.dashboard.settings.security.dangerZoneWarning}
        </p>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="px-5 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-500 hover:text-white border border-red-200 dark:border-red-800 hover:border-red-500 rounded-full transition-all flex items-center gap-2"
        >
          <Trash2 size={14} />
          {t.dashboard.settings.security.deleteAccount}
        </button>
      </div>

      {/* =================================================================== */}
      {/* PASSWORD CHANGE MODAL - January 13th, 2026                          */}
      {/* Simple form: Current Password -> New Password -> Confirm            */}
      {/* Uses Stack Auth's user.updatePassword() method                       */}
      {/* January 17, 2026: Updated with i18n translations                    */}
      {/* =================================================================== */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
        title={t.dashboard.settings.security.passwordModal.title}
        width="max-w-md"
      >
        <div className="space-y-4">
          {/* Success banner — smoover refresh. bg-*-100 + border-2 -> rounded-xl
              + bg-*-50 + hairline border-*-500 (vivid border stays as signal).
              font-bold -> font-semibold. */}
          {passwordSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-500 rounded-xl flex items-center gap-2">
              <Check size={16} className="text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">{t.dashboard.settings.security.passwordModal.success}</span>
            </div>
          )}

          {/* Error banner — smoover refresh (matches StripeProvider error callout). */}
          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl flex items-center gap-2">
              <XCircle size={16} className="text-red-600 shrink-0" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">{passwordError}</span>
            </div>
          )}

          {/* Current Password — smoover refresh.
              Label: eyebrow pattern (font-semibold + muted #8898aa).
              Input: bg-[#f6f9fc] + hairline border + rounded-lg + focus ring
              (same as Profile edit inputs). Eye-toggle: muted smoover tokens. */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              {t.dashboard.settings.security.passwordModal.currentPassword}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-600 rounded-lg text-sm text-[#0f172a] dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:opacity-50 transition-colors"
                placeholder={t.dashboard.settings.security.passwordModal.currentPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password — smoover refresh (same pattern as Current Password). */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              {t.dashboard.settings.security.passwordModal.newPassword}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-600 rounded-lg text-sm text-[#0f172a] dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:opacity-50 transition-colors"
                placeholder={t.dashboard.settings.security.passwordModal.newPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password — smoover refresh (same pattern). */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              {t.dashboard.settings.security.passwordModal.confirmPassword}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-[#f6f9fc] dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-600 rounded-lg text-sm text-[#0f172a] dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:opacity-50 transition-colors"
                placeholder={t.dashboard.settings.security.passwordModal.confirmPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Action Buttons — smoover refresh.
              Cancel: rounded-full hairline secondary (identical to Profile Cancel).
              Save: smoover primary CTA (rounded-full + shadow-yellow-glow-sm +
              hover:-translate-y-px + font-semibold). */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleClosePasswordModal}
              disabled={isChangingPassword}
              className="px-5 py-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-all disabled:opacity-50"
            >
              {t.dashboard.settings.security.passwordModal.cancel}
            </button>
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || passwordSuccess || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 bg-[#ffbf23] text-[#1A1D21] text-sm font-semibold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:shadow-yellow-glow hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.dashboard.settings.security.passwordModal.saving}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {t.dashboard.settings.security.passwordModal.save}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* =================================================================== */}
      {/* DELETE ACCOUNT CONFIRMATION MODAL - January 13th, 2026              */}
      {/* January 17, 2026: Updated with i18n translations                    */}
      {/* WARNING: This action is IRREVERSIBLE!                               */}
      {/* =================================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        title={t.dashboard.settings.security.deleteModal.title}
        width="max-w-md"
      >
        <div className="space-y-4">
          {/* Warning Banner — smoover refresh.
              bg-*-100 + border-2 -> rounded-xl + bg-red-50 + hairline border-red-500
              (vivid border preserved as signal). Title drops font-black uppercase. */}
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {t.dashboard.settings.security.deleteModal.warning}
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  {t.dashboard.settings.security.deleteModal.warningDetail}
                </p>
              </div>
            </div>
          </div>

          {/* What will be deleted — smoover refresh. Heading uses eyebrow pattern;
              list items use smoover body token. */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              {t.dashboard.settings.security.deleteModal.willBeDeleted}
            </p>
            <ul className="text-xs text-[#425466] dark:text-gray-400 space-y-1 pl-4">
              <li>• {t.dashboard.settings.security.deleteModal.items.subscription}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.savedAffiliates}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.discoveredAffiliates}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.searchHistory}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.account}</li>
            </ul>
          </div>

          {/* Error banner — smoover refresh (matches Password Modal error). */}
          {deleteError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl flex items-center gap-2">
              <XCircle size={16} className="text-red-600 shrink-0" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">{deleteError}</span>
            </div>
          )}

          {/* Confirmation Input — smoover refresh.
              Label: eyebrow pattern. Input: hairline red-400 border + rounded-lg +
              focus:ring-2 focus:ring-red-500/20. font-bold -> font-semibold.
              uppercase tracking-widest preserved — it IS the "type DELETE" signal. */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">
              {t.dashboard.settings.security.deleteModal.typeToConfirm}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              disabled={isDeleting}
              className="w-full px-3 py-2.5 bg-[#f6f9fc] dark:bg-gray-900 border border-red-400 rounded-lg text-sm text-[#0f172a] dark:text-white font-semibold focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 uppercase tracking-widest transition-colors"
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          {/* Action Buttons — smoover refresh.
              Cancel: rounded-full hairline secondary (same as Password Modal Cancel).
              Delete: destructive PRIMARY — rounded-full + bg-red-500 + font-semibold
              + shadow-soft-lg. NO translate-y hover: irreversible actions should
              not feel playful. */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleCloseDeleteModal}
              disabled={isDeleting}
              className="px-5 py-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-700 border border-[#e6ebf1] dark:border-gray-600 rounded-full transition-all disabled:opacity-50"
            >
              {t.dashboard.settings.security.deleteModal.cancel}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-full shadow-soft-lg hover:bg-red-600 hover:shadow-soft-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.dashboard.settings.security.deleteModal.deleting}
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  {t.dashboard.settings.security.deleteModal.delete}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
