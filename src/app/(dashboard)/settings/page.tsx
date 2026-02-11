'use client';

/**
 * =============================================================================
 * SETTINGS PAGE
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE (January 8th, 2026):
 * ------------------------------------------------
 * Updated all components to match the neo-brutalist design system:
 *   - Sharp edges (no rounded corners)
 *   - Bold borders (border-2 to border-4 with black)
 *   - Offset shadows (shadow-[Xpx_Xpx_0px_0px_#000000])
 *   - Yellow accent color (#ffbf23)
 *   - Font-black uppercase typography
 *   - Dark mode support
 * 
 * ARCHITECTURE (January 3rd, 2026):
 * -----------------------------------------
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
  // RENDER - January 8th, 2026
  // 
  // NEO-BRUTALIST DESIGN:
  // - Header: h-16 with border-b-4 and uppercase font-black title
  // - Left navigation: Sharp-edged tabs with yellow active state
  // - Right panel: Sharp edges with border-2 and offset shadow
  // 
  // Note: The outer container with Sidebar is now handled by the layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b-4 border-black dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wide">{t.dashboard.settings.pageTitle}</h1>
        </div>
      </header>

        {/* Main Content - NEO-BRUTALIST (Updated January 8th, 2026) */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-8rem)]">
            
            {/* Left Panel - Navigation - NEO-BRUTALIST */}
            <div className="w-full md:w-64 shrink-0">
              <div className="sticky top-24 space-y-1">
                <h3 className="px-3 text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{t.dashboard.settings.accountLabel}</h3>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000]"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white border-2 border-transparent"
                    )}
                  >
                    <span className={cn(
                      "shrink-0",
                      activeTab === tab.id ? "text-black" : "text-gray-400 group-hover:text-gray-600"
                    )}>
                      {tab.icon}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {activeTab === tab.id && (
                      <span className="w-2 h-2 bg-black" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel - Content - NEO-BRUTALIST */}
            <div className="flex-1 min-w-0 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] overflow-hidden">
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

      {/* Cancel Plan Confirmation Modal - NEO-BRUTALIST (Updated January 8th, 2026)
          January 17, 2026: Added i18n translations */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={subscription?.cancel_at_period_end ? t.dashboard.settings.plan.cancelModal.resumeTitle : t.dashboard.settings.plan.cancelModal.cancelTitle}
        width="max-w-md"
      >
        <div className="space-y-4">
          {subscription?.cancel_at_period_end ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t.dashboard.settings.plan.cancelModal.resumeMessage}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
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
                  className="px-4 py-2 text-xs font-black text-black bg-[#ffbf23] hover:bg-yellow-400 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase"
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
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-800 dark:text-red-300">{t.dashboard.settings.plan.cancelModal.cancelWarning}</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {t.dashboard.settings.plan.cancelModal.cancelMessage}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {t.dashboard.settings.plan.subscriptionWillRemainActive}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
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
                  className="px-4 py-2 text-xs font-black text-white bg-red-500 hover:bg-red-600 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase"
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
// PROFILE SETTINGS - NEO-BRUTALIST (Updated January 13th, 2026)
// 
// Design updates:
// - Sharp-edged input fields
// - Neo-brutalist Edit Profile button
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
      {/* User Info - Name & Email (January 13th, 2026)
          January 17, 2026: Updated with i18n translations */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.dashboard.settings.profile.fullName}</label>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-[#ffbf23] text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23]"
              placeholder={t.dashboard.settings.profile.enterYourName}
              disabled={isSaving}
              autoFocus
            />
          ) : (
            <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium">
              {userName}
            </div>
          )}
          {saveError && (
            <p className="text-xs text-red-500 font-bold">{saveError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.dashboard.settings.profile.emailAddress}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
            <div className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium">
              {userEmail}
            </div>
          </div>
          <p className="text-xs text-gray-400">{t.dashboard.settings.profile.emailCannotChange}</p>
        </div>
      </div>

      {/* Country & Language Section - January 13th, 2026
          January 17, 2026: Updated with i18n translations */}
      <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-gray-500" />
          <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.dashboard.settings.profile.targetMarket}</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country Dropdown - January 13th, 2026 */}
          <div className="space-y-1.5 relative" ref={countryDropdownRef}>
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.dashboard.settings.profile.country}</label>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryOpen(!isCountryOpen);
                    setIsLanguageOpen(false);
                  }}
                  disabled={isSaving}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-[#ffbf23] text-sm text-left flex items-center justify-between focus:outline-none disabled:opacity-50"
                >
                  {editCountry ? (
                    <span className="flex items-center gap-2">
                      <img 
                        src={`https://flagcdn.com/w20/${getCountryCode(editCountry)}.png`}
                        alt={editCountry}
                        className="w-5 h-4 object-cover border border-gray-200"
                      />
                      <span className="text-gray-900 dark:text-white">{editCountry}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">{t.dashboard.settings.profile.selectCountry}</span>
                  )}
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isCountryOpen && "rotate-180")} />
                </button>
                
                {/* Country Dropdown Menu */}
                {isCountryOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] z-50 max-h-48 overflow-y-auto">
                    {COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setEditCountry(country.name);
                          setIsCountryOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800",
                          editCountry === country.name && "bg-[#ffbf23]/20"
                        )}
                      >
                        <img 
                          src={`https://flagcdn.com/w20/${country.code}.png`}
                          alt={country.name}
                          className="w-5 h-4 object-cover border border-gray-200"
                        />
                        <span className="text-gray-900 dark:text-white">{country.name}</span>
                        {editCountry === country.name && <Check size={14} className="ml-auto text-[#ffbf23]" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                {currentCountry ? (
                  <>
                    <img 
                      src={`https://flagcdn.com/w20/${getCountryCode(currentCountry)}.png`}
                      alt={currentCountry}
                      className="w-5 h-4 object-cover border border-gray-200"
                    />
                    <span>{currentCountry}</span>
                  </>
                ) : (
                  <span className="text-gray-400">{t.dashboard.settings.profile.notSet}</span>
                )}
              </div>
            )}
          </div>

          {/* Language Dropdown - January 13th, 2026 */}
          <div className="space-y-1.5 relative" ref={languageDropdownRef}>
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.dashboard.settings.profile.language}</label>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsLanguageOpen(!isLanguageOpen);
                    setIsCountryOpen(false);
                  }}
                  disabled={isSaving}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-[#ffbf23] text-sm text-left flex items-center justify-between focus:outline-none disabled:opacity-50"
                >
                  {/* February 2, 2026: Updated to show flag instead of symbol */}
                  {editLanguage ? (
                    <span className="flex items-center gap-2">
                      <img 
                        src={getFlagUrl(getLanguageCode(editLanguage))}
                        alt={editLanguage}
                        className="w-5 h-4 object-cover border border-gray-200"
                      />
                      <span className="text-gray-900 dark:text-white">{editLanguage}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">{t.dashboard.settings.profile.selectLanguage}</span>
                  )}
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isLanguageOpen && "rotate-180")} />
                </button>
                
                {/* Language Dropdown Menu - February 2, 2026: Updated to show flags */}
                {isLanguageOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] z-50 max-h-48 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.name}
                        type="button"
                        onClick={() => {
                          setEditLanguage(lang.name);
                          setIsLanguageOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800",
                          editLanguage === lang.name && "bg-[#ffbf23]/20"
                        )}
                      >
                        <img 
                          src={getFlagUrl(lang.code)}
                          alt={lang.name}
                          className="w-5 h-4 object-cover border border-gray-200"
                        />
                        <span className="text-gray-900 dark:text-white">{lang.name}</span>
                        {editLanguage === lang.name && <Check size={14} className="ml-auto text-[#ffbf23]" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* February 2, 2026: Updated to show flag instead of symbol */
              <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                {currentLanguage ? (
                  <>
                    <img 
                      src={getFlagUrl(getLanguageCode(currentLanguage))}
                      alt={currentLanguage}
                      className="w-5 h-4 object-cover border border-gray-200"
                    />
                    <span>{currentLanguage}</span>
                  </>
                ) : (
                  <span className="text-gray-400">{t.dashboard.settings.profile.notSet}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - NEO-BRUTALIST (Updated January 13th, 2026)
          January 17, 2026: Updated with i18n translations */}
      <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        {isEditing ? (
          <>
            <button 
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase disabled:opacity-50"
            >
              {t.dashboard.settings.profile.cancel}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !editName.trim()}
              className="px-5 py-2 bg-[#ffbf23] text-black text-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            className="px-5 py-2.5 bg-[#ffbf23] text-black text-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            {t.dashboard.settings.profile.editProfile}
          </button>
        )}
      </div>
    </div>
  );
}

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

  // Get status badge styling for invoices - NEO-BRUTALIST (Updated January 8th, 2026)
  // January 17, 2026: Updated with i18n translations
  const getInvoiceStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { label: t.dashboard.settings.plan.invoiceStatus.paid.toUpperCase(), bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
      case 'open':
        return { label: t.dashboard.settings.plan.invoiceStatus.open.toUpperCase(), bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
      case 'draft':
        return { label: t.dashboard.settings.plan.invoiceStatus.draft.toUpperCase(), bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
      case 'void':
        return { label: t.dashboard.settings.plan.invoiceStatus.void.toUpperCase(), bg: 'bg-red-500', text: 'text-white', border: 'border-black' };
      case 'uncollectible':
        return { label: t.dashboard.settings.plan.invoiceStatus.uncollectible.toUpperCase(), bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
      default:
        return { label: status?.toUpperCase() || t.dashboard.settings.plan.invoiceStatus.unknown.toUpperCase(), bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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

  // Get status badge color - NEO-BRUTALIST (Updated January 8th, 2026)
  // January 17, 2026: Updated with i18n translations
  const getStatusBadge = () => {
    if (subscription?.cancel_at_period_end) {
      return { label: t.dashboard.settings.plan.cancelled.toUpperCase(), bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
    }
    if (isTrialing) {
      return { label: t.dashboard.settings.plan.trial.toUpperCase(), bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
    }
    if (subscription?.status === 'active') {
      return { label: t.dashboard.settings.plan.active.toUpperCase(), bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
    }
    if (subscription?.status === 'past_due') {
      return { label: t.dashboard.settings.plan.pastDue.toUpperCase(), bg: 'bg-red-500', text: 'text-white', border: 'border-black' };
    }
    if (subscription?.status === 'canceled') {
      return { label: t.dashboard.settings.plan.expired.toUpperCase(), bg: 'bg-gray-500', text: 'text-white', border: 'border-black' };
    }
    return { label: t.dashboard.settings.plan.active.toUpperCase(), bg: 'bg-[#ffbf23]', text: 'text-black', border: 'border-black' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="space-y-8">
      {/* Current Plan - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div className={cn(
        "p-4 border-2 space-y-4",
        isTrialing ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" : "bg-[#ffbf23]/10 border-[#ffbf23]"
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 dark:text-white uppercase">
                {subscription ? getPlanDisplayName(subscription.plan) : t.dashboard.settings.plan.noPlan}
              </span>
              {subscription && (
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border-2",
                  statusBadge.bg, statusBadge.text, statusBadge.border
                )}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            
            {/* Trial info - January 17, 2026: Updated with i18n */}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-bold">
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
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                <Calendar size={12} />
                <span>{t.dashboard.settings.plan.nextBilling}: {subscription.nextBillingDate}</span>
              </div>
            )}

            {/* Price - January 17, 2026: Updated with i18n */}
            {subscription && subscription.formattedPrice && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {subscription.formattedPrice}
                {subscription.billing_interval === 'annual' && ` (${t.dashboard.settings.plan.billedAnnually})`}
              </p>
            )}
          </div>
          
          {/* Upgrade/Manage button - NEO-BRUTALIST */}
          {/* Updated January 8th, 2026 - contextual button text with neo-brutalist styling
              January 17, 2026: Updated with i18n */}
          {(!subscription || subscription.plan !== 'enterprise') && (
            <button 
              onClick={onUpgrade}
              className="px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-1.5"
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

        {/* Trial warning - NEO-BRUTALIST
            January 17, 2026: Updated with i18n */}
        {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-black">{t.dashboard.settings.plan.trialEndingSoon.title}</p>
              <p className="text-amber-700 dark:text-amber-400">{t.dashboard.settings.plan.trialEndingSoon.subtitle}</p>
            </div>
          </div>
        )}

        {/* Payment failed - past_due */}
        {isPastDue && (
          <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
            <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 dark:text-red-300">
              <p className="font-black">{t.dashboard.settings.plan.paymentFailedBanner.title}</p>
              <p className="text-red-700 dark:text-red-400">{t.dashboard.settings.plan.paymentFailedBanner.subtitle}</p>
            </div>
          </div>
        )}

        {/* Subscription ended - canceled */}
        {subscription?.status === 'canceled' && !subscription?.cancel_at_period_end && (
          <div className="flex items-start gap-2 p-3 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500">
            <AlertTriangle size={14} className="text-orange-600 shrink-0 mt-0.5" />
            <div className="text-xs text-orange-800 dark:text-orange-300">
              <p className="font-black">{t.dashboard.settings.plan.subscriptionEndedBanner.title}</p>
              <p className="text-orange-700 dark:text-orange-400">{t.dashboard.settings.plan.subscriptionEndedBanner.subtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method - NEO-BRUTALIST (Updated January 8th, 2026)
          January 17, 2026: Updated with i18n */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">{t.dashboard.settings.plan.paymentMethod}</h3>
        {subscription?.card_last4 ? (
          <div className="p-4 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <CreditCard size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {subscription.card_brand || t.dashboard.settings.plan.card} •••• {subscription.card_last4}
                </p>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <p className="text-xs text-gray-500">
                    {t.dashboard.settings.plan.expires} {String(subscription.card_exp_month).padStart(2, '0')}/{String(subscription.card_exp_year).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={onAddCard}
              className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white uppercase"
            >
              {t.dashboard.settings.plan.updatePaymentMethod}
            </button>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-1">{t.dashboard.settings.plan.noPaymentMethod.title}</p>
            <p className="text-xs text-gray-500 mb-4">
              {isTrialing 
                ? t.dashboard.settings.plan.noPaymentMethod.trialSubtitle
                : t.dashboard.settings.plan.noPaymentMethod.defaultSubtitle
              }
            </p>
            <button 
              onClick={onAddCard}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Plus size={14} />
              {t.dashboard.settings.plan.addPaymentMethod}
            </button>
          </div>
        )}
      </div>

      {/* Invoices - NEO-BRUTALIST (Updated January 8th, 2026)
          January 17, 2026: Updated with i18n */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">{t.dashboard.settings.plan.invoiceHistory}</h3>
        
        {/* Loading State */}
        {invoicesLoading && (
          <div className="p-8 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500 font-medium">{t.dashboard.settings.plan.loadingInvoices}</span>
          </div>
        )}

        {/* Error State */}
        {!invoicesLoading && invoicesError && (
          <div className="p-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/20 flex items-center gap-3">
            <XCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{invoicesError}</p>
            <button 
              onClick={fetchInvoices}
              className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 uppercase"
            >
              {t.dashboard.settings.plan.retry}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!invoicesLoading && !invoicesError && invoices.length === 0 && (
          <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-bold">{t.dashboard.settings.plan.noInvoicesYet.title}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t.dashboard.settings.plan.noInvoicesYet.subtitle}
            </p>
          </div>
        )}

        {/* Invoice List - NEO-BRUTALIST
            January 17, 2026: Updated with i18n */}
        {!invoicesLoading && !invoicesError && invoices.length > 0 && (
          <div className="border-2 border-black dark:border-gray-600 overflow-hidden">
            {/* Table Header */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b-2 border-black dark:border-gray-600 grid grid-cols-12 gap-4 text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
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
                  className="px-4 py-3 border-b-2 border-gray-200 dark:border-gray-700 last:border-b-0 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Invoice Number & Description */}
                  <div className="col-span-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {invoice.number || t.dashboard.settings.plan.invoiceStatus.draft}
                    </p>
                    {invoice.description && (
                      <p className="text-xs text-gray-500 truncate" title={invoice.description}>
                        {invoice.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Date */}
                  <div className="col-span-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {formatDate(invoice.created)}
                    </p>
                  </div>
                  
                  {/* Amount */}
                  <div className="col-span-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatAmount(invoice.amount_due, invoice.currency)}
                    </p>
                  </div>
                  
                  {/* Status */}
                  <div className="col-span-2">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border",
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
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

      {/* Cancel Plan Section - NEO-BRUTALIST (Updated January 8th, 2026)
          January 17, 2026: Updated with i18n */}
      {subscription && subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">{t.dashboard.settings.plan.cancelSubscription.title}</h3>
          <p className="text-xs text-gray-500 mb-4">
            {t.dashboard.settings.plan.cancelSubscription.subtitle}
          </p>
          <button 
            onClick={onCancelPlan}
            className="px-4 py-2 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-500 border-2 border-red-400 hover:border-red-600 transition-all uppercase"
          >
            {t.dashboard.settings.plan.cancelSubscription.button}
          </button>
        </div>
      )}

      {/* Cancellation pending notice - NEO-BRUTALIST
          January 17, 2026: Updated with i18n */}
      {subscription?.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-orange-800 dark:text-orange-300 uppercase">{t.dashboard.settings.plan.cancellationPending.title}</h4>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  {t.dashboard.settings.plan.cancellationPending.subtitle}
                </p>
                <button 
                  onClick={onCancelPlan}
                  className="mt-3 px-3 py-1.5 text-xs font-bold text-orange-700 hover:text-white bg-white hover:bg-orange-500 border-2 border-orange-400 hover:border-orange-600 transition-all uppercase"
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
// BUY CREDITS SETTINGS - NEO-BRUTALIST (February 2026)
//
// One-time credit top-up purchase UI.
// Credits are added on top of the monthly plan allocation.
// Top-up credits never expire and persist across billing cycles.
//
// Credit packs: Email credits, AI Outreach credits, Topic Searches
// Stripe one-time payment (not subscription).
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

  const categories = [
    { id: 'email' as const, label: 'Email Credits', icon: <Mail size={16} />, description: 'Verified email lookups for affiliates' },
    { id: 'ai' as const, label: 'AI Outreach', icon: <Sparkles size={16} />, description: 'AI-generated personalized outreach emails' },
    { id: 'search' as const, label: 'Topic Searches', icon: <Search size={16} />, description: 'Find new affiliates by topic' },
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
        setPurchaseError(data.error || 'Failed to start checkout');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setPurchaseError('Invalid response from server');
    } catch (err) {
      setPurchaseError('Network error. Please try again.');
    } finally {
      setPurchasingId(null);
    }
  };

  const currentPacks = CREDIT_PACKS[selectedCategory];

  return (
    <div className="space-y-8">
      {creditPurchaseSuccess && (
        <div className="p-4 bg-green-500/10 border-2 border-green-500 flex items-center justify-between">
          <span className="text-sm font-bold text-green-800 dark:text-green-200">Credits added successfully. Your balance has been updated.</span>
          {onDismissPurchaseSuccess && (
            <button type="button" onClick={onDismissPurchaseSuccess} className="text-green-700 dark:text-green-300 hover:underline text-xs font-black uppercase">
              Dismiss
            </button>
          )}
        </div>
      )}
      {creditPurchaseCancelled && (
        <div className="p-4 bg-gray-200 dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-600 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Purchase cancelled. You can try again whenever you’re ready.</span>
          {onDismissPurchaseCancelled && (
            <button type="button" onClick={onDismissPurchaseCancelled} className="text-gray-600 dark:text-gray-300 hover:underline text-xs font-black uppercase">
              Dismiss
            </button>
          )}
        </div>
      )}
      {isTrialing && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Credit packs are for paid subscribers only</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Subscribe or end your trial to purchase add-on credits.</p>
          </div>
        </div>
      )}
      {purchaseError && (
        <div className="p-4 bg-red-500/10 border-2 border-red-500 flex items-center justify-between">
          <span className="text-sm font-bold text-red-800 dark:text-red-200">{purchaseError}</span>
          <button type="button" onClick={() => setPurchaseError(null)} className="text-red-700 dark:text-red-300 hover:underline text-xs font-black uppercase">
            Dismiss
          </button>
        </div>
      )}
      {/* Header */}
      <div className="p-4 bg-[#ffbf23]/10 border-2 border-[#ffbf23]">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#ffbf23] border-2 border-black">
            <Coins size={20} className="text-black" />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase">Top Up Credits</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Purchase additional credits instantly. Top-up credits never expire and are used after your monthly plan credits.
            </p>
          </div>
        </div>
      </div>

      {/* Category Selector */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Select Credit Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "p-4 border-2 text-left transition-all duration-200",
                selectedCategory === cat.id
                  ? "bg-[#ffbf23]/10 border-[#ffbf23] shadow-[3px_3px_0px_0px_#ffbf23]"
                  : "bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  selectedCategory === cat.id ? "text-[#ffbf23]" : "text-gray-400"
                )}>
                  {cat.icon}
                </span>
                <span className={cn(
                  "text-xs font-black uppercase",
                  selectedCategory === cat.id ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
                )}>
                  {cat.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{cat.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Credit Packs */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Choose a Pack</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {currentPacks.map((pack, idx) => {
            const isPopular = idx === 1;
            const isPurchasing = purchasingId === pack.id;

            return (
              <div
                key={pack.id}
                className={cn(
                  "relative p-5 border-2 flex flex-col transition-all duration-200",
                  isPopular
                    ? "border-[#ffbf23] shadow-[4px_4px_0px_0px_#ffbf23] bg-white dark:bg-[#0f0f0f]"
                    : "border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_#000000] dark:shadow-[3px_3px_0px_0px_#333333] bg-white dark:bg-[#0f0f0f]"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-0 right-0 flex justify-center">
                    <span className="bg-black text-[#ffbf23] text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border-2 border-[#ffbf23]">
                      Best Value
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
                    <span className="text-2xl font-black text-gray-900 dark:text-white">{pack.credits}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">credits</p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{CURRENCY_SYMBOL}{pack.price}</span>
                </div>

                {/* Buy button */}
                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={isPurchasing || !userId || isTrialing}
                  className={cn(
                    "w-full py-2.5 text-xs font-black uppercase border-2 transition-all duration-200 flex items-center justify-center gap-2",
                    isPopular
                      ? "bg-[#ffbf23] text-black border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]"
                      : "bg-black text-white border-black hover:bg-gray-800",
                    (isPurchasing || !userId || isTrialing) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isPurchasing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart size={12} />
                      Buy Now
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info footer */}
      <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-500">
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-gray-900 dark:text-white uppercase">Never Expire</p>
              <p>Top-up credits stay in your account forever</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-gray-900 dark:text-white uppercase">Instant Delivery</p>
              <p>Credits added to your account immediately</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={14} className="text-[#ffbf23] shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-gray-900 dark:text-white uppercase">Secure Payment</p>
              <p>Processed securely through Stripe</p>
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
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wide">{title}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-500">
          {counter.replace('{count}', String(count))}
        </p>
      </div>
      {rawData.length === 0 ? (
        <div className="py-12 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <p className="font-bold text-gray-900 dark:text-white">{emptyTitle}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{emptySubtitle}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rawData.map((row: { domain: string; created_at: string }) => (
            <li
              key={row.domain}
              className="flex items-center justify-between gap-4 py-3 px-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700"
            >
              <div>
                <span className="font-bold text-gray-900 dark:text-white">{row.domain}</span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {domainBlockedOn} {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <button
                onClick={() => handleUnblockClick(row.domain)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 transition-all ${
                  unblockConfirming === row.domain
                    ? 'bg-red-500 text-white border-red-600 animate-pulse'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50'
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
// SECURITY SETTINGS - NEO-BRUTALIST (Updated January 13th, 2026)
// 
// Design updates:
// - Sharp-edged buttons
// - Bold typography
// - Neo-brutalist Danger Zone section
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
      {/* January 17, 2026: Updated with i18n translations */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">{t.dashboard.settings.security.passwordSecurity}</h3>
        <p className="text-sm text-gray-500">
          {t.dashboard.settings.security.securityDescription}
        </p>
        <div className="pt-2">
          {/* January 13th, 2026: Opens password change modal */}
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors uppercase"
          >
            {t.dashboard.settings.security.changePassword}
          </button>
        </div>
      </div>
      
      <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* ================================================================= */}
      {/* DANGER ZONE - January 13th, 2026                                  */}
      {/* Delete Account button opens confirmation modal                    */}
      {/* January 17, 2026: Updated with i18n translations                  */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-red-600 uppercase tracking-wide">{t.dashboard.settings.security.dangerZone}</h3>
        <p className="text-xs text-gray-500">
          {t.dashboard.settings.security.dangerZoneWarning}
        </p>
        <button 
          onClick={() => setIsDeleteModalOpen(true)}
          className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-400 text-sm font-bold hover:bg-red-500 hover:text-white hover:border-red-600 transition-all uppercase flex items-center gap-2"
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
          {/* Success Message */}
          {passwordSuccess && (
            <div className="p-3 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="text-sm font-bold text-green-700 dark:text-green-400">{t.dashboard.settings.security.passwordModal.success}</span>
            </div>
          )}

          {/* Error Message */}
          {passwordError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 flex items-center gap-2">
              <XCircle size={16} className="text-red-600" />
              <span className="text-sm font-bold text-red-700 dark:text-red-400">{passwordError}</span>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.dashboard.settings.security.passwordModal.currentPassword}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder={t.dashboard.settings.security.passwordModal.currentPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.dashboard.settings.security.passwordModal.newPassword}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder={t.dashboard.settings.security.passwordModal.newPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.dashboard.settings.security.passwordModal.confirmPassword}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder={t.dashboard.settings.security.passwordModal.confirmPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleClosePasswordModal}
              disabled={isChangingPassword}
              className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase disabled:opacity-50"
            >
              {t.dashboard.settings.security.passwordModal.cancel}
            </button>
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || passwordSuccess || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 text-xs font-black text-black bg-[#ffbf23] hover:bg-yellow-400 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Warning Banner */}
          <div className="p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-800 dark:text-red-300 uppercase">
                  {t.dashboard.settings.security.deleteModal.warning}
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  {t.dashboard.settings.security.deleteModal.warningDetail}
                </p>
              </div>
            </div>
          </div>

          {/* What will be deleted */}
          <div className="space-y-2">
            <p className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
              {t.dashboard.settings.security.deleteModal.willBeDeleted}
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 pl-4">
              <li>• {t.dashboard.settings.security.deleteModal.items.subscription}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.savedAffiliates}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.discoveredAffiliates}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.searchHistory}</li>
              <li>• {t.dashboard.settings.security.deleteModal.items.account}</li>
            </ul>
          </div>

          {/* Error Message */}
          {deleteError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 flex items-center gap-2">
              <XCircle size={16} className="text-red-600" />
              <span className="text-sm font-bold text-red-700 dark:text-red-400">{deleteError}</span>
            </div>
          )}

          {/* Confirmation Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.dashboard.settings.security.deleteModal.typeToConfirm}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              disabled={isDeleting}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-red-400 text-sm text-gray-900 dark:text-white font-bold focus:outline-none focus:border-red-600 disabled:opacity-50 uppercase tracking-widest"
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleCloseDeleteModal}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase disabled:opacity-50"
            >
              {t.dashboard.settings.security.deleteModal.cancel}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
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
