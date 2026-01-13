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
import { cn } from '@/lib/utils';
import { useUser } from '@stackframe/stack';
import { PricingModal } from '../../components/PricingModal';
import { AddCardModal } from '../../components/AddCardModal';
import { Modal } from '../../components/Modal';
import { useNeonUser } from '../../hooks/useNeonUser';
import { useSubscription } from '../../hooks/useSubscription';
import { 
  User, 
  CreditCard, 
  Bell, 
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
  Trash2        // January 13th, 2026: Added for delete account
} from 'lucide-react';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

type SettingsTab = 'profile' | 'plan' | 'notifications' | 'security';

// =============================================================================
// SETTINGS PAGE - January 3rd, 2026
// 
// Layout now handles: AuthGuard, ErrorBoundary, and Sidebar.
// This component only renders the header and main content area.
// =============================================================================
export default function SettingsPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const user = useUser();
  // January 13th, 2026: Added refetch for updating name, country, language
  const { userId, user: neonUser, refetch: refetchNeonUser } = useNeonUser();
  const { subscription, isLoading: subscriptionLoading, isTrialing, daysLeftInTrial, refetch: refetchSubscription, cancelSubscription, resumeSubscription } = useSubscription(userId);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Tabs - Translated (January 9th, 2026)
  const tabs = [
    { id: 'profile', label: t.dashboard.settings.tabs.profile.label, icon: <User size={16} />, description: t.dashboard.settings.tabs.profile.description },
    { id: 'plan', label: t.dashboard.settings.tabs.plan.label, icon: <CreditCard size={16} />, description: t.dashboard.settings.tabs.plan.description },
    { id: 'notifications', label: t.dashboard.settings.tabs.notifications.label, icon: <Bell size={16} />, description: t.dashboard.settings.tabs.notifications.description },
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
                <h3 className="px-3 text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Account</h3>
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
                      user={user}
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
                      daysLeftInTrial={daysLeftInTrial}
                      onUpgrade={() => setIsPricingModalOpen(true)}
                      onAddCard={() => setIsAddCardModalOpen(true)}
                      onCancelPlan={() => setIsCancelModalOpen(true)}
                      userId={userId}
                    />
                  )}
                  {activeTab === 'notifications' && <NotificationSettings />}
                  {activeTab === 'security' && <SecuritySettings user={user} neonUserId={userId} />}
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

      {userId && user?.primaryEmail && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          userId={userId}
          userEmail={user.primaryEmail}
          onSuccess={() => {
            refetchSubscription();
            setIsAddCardModalOpen(false);
          }}
        />
      )}

      {/* Cancel Plan Confirmation Modal - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={subscription?.cancel_at_period_end ? "Resume Subscription" : "Cancel Subscription"}
        width="max-w-md"
      >
        <div className="space-y-4">
          {subscription?.cancel_at_period_end ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Would you like to resume your subscription? Your plan will continue as normal and you'll be billed at the next billing cycle.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
                >
                  Keep Canceled
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
                  Resume Subscription
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-800 dark:text-red-300">Are you sure you want to cancel?</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      You'll lose access to premium features at the end of your current billing period.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Your subscription will remain active until the end of your current billing period. You can resume anytime before then.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase"
                >
                  Keep Subscription
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
                  Cancel Subscription
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
// - Updates both Stack Auth (displayName) and Neon DB (name, target_country, target_language)
// =============================================================================
interface ProfileSettingsProps {
  user: any;
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
// Same list as onboarding for consistency
// =============================================================================
const LANGUAGES = [
  { name: 'English', symbol: 'Aa' },
  { name: 'Spanish', symbol: 'Ñ' },
  { name: 'German', symbol: 'ß' },
  { name: 'French', symbol: 'Ç' },
  { name: 'Italian', symbol: 'È' },
  { name: 'Portuguese', symbol: 'Ã' },
  { name: 'Dutch', symbol: 'IJ' },
  { name: 'Swedish', symbol: 'Å' },
  { name: 'Polish', symbol: 'Ł' },
  { name: 'Danish', symbol: 'Ø' },
  { name: 'Norwegian', symbol: 'Æ' },
  { name: 'Japanese', symbol: '日' },
  { name: 'Korean', symbol: '한' },
  { name: 'Chinese', symbol: '中' },
  { name: 'Arabic', symbol: 'ع' },
];

function ProfileSettings({ user, neonUserId, currentCountry, currentLanguage, onProfileUpdated }: ProfileSettingsProps) {
  const userName = user?.displayName || 'User';
  const userEmail = user?.primaryEmail || '';
  
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
  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Update Stack Auth displayName
      if (user) {
        await user.update({ displayName: editName.trim() });
      }

      // Update Neon DB (name, country, language)
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
          throw new Error('Failed to update database');
        }
      }

      // Success - exit edit mode and notify parent
      setIsEditing(false);
      onProfileUpdated?.();
    } catch (err) {
      console.error('Error updating profile:', err);
      setSaveError('Failed to save. Please try again.');
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

  // Get language symbol (January 13th, 2026)
  const getLanguageSymbol = (langName: string) => {
    return LANGUAGES.find(l => l.name === langName)?.symbol || '';
  };
  
  return (
    <div className="space-y-6">
      {/* User Info - Name & Email (January 13th, 2026) */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Full Name</label>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-[#ffbf23] text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23]"
              placeholder="Enter your name"
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
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
            <div className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium">
              {userEmail}
            </div>
          </div>
          <p className="text-xs text-gray-400">Email cannot be changed here.</p>
        </div>
      </div>

      {/* Country & Language Section - January 13th, 2026 */}
      <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-gray-500" />
          <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Target Market</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country Dropdown - January 13th, 2026 */}
          <div className="space-y-1.5 relative" ref={countryDropdownRef}>
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Country</label>
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
                    <span className="text-gray-400">Select country</span>
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
                  <span className="text-gray-400">Not set</span>
                )}
              </div>
            )}
          </div>

          {/* Language Dropdown - January 13th, 2026 */}
          <div className="space-y-1.5 relative" ref={languageDropdownRef}>
            <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Language</label>
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
                  {editLanguage ? (
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        {getLanguageSymbol(editLanguage)}
                      </span>
                      <span className="text-gray-900 dark:text-white">{editLanguage}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">Select language</span>
                  )}
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isLanguageOpen && "rotate-180")} />
                </button>
                
                {/* Language Dropdown Menu */}
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
                        <span className="w-6 h-6 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                          {lang.symbol}
                        </span>
                        <span className="text-gray-900 dark:text-white">{lang.name}</span>
                        {editLanguage === lang.name && <Check size={14} className="ml-auto text-[#ffbf23]" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                {currentLanguage ? (
                  <>
                    <span className="w-6 h-6 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {getLanguageSymbol(currentLanguage)}
                    </span>
                    <span>{currentLanguage}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - NEO-BRUTALIST (Updated January 13th, 2026) */}
      <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        {isEditing ? (
          <>
            <button 
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !editName.trim()}
              className="px-5 py-2 bg-[#ffbf23] text-black text-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save Changes
                </>
              )}
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="px-5 py-2.5 bg-[#ffbf23] text-black text-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Edit Profile
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

function PlanSettings({ subscription, isLoading, isTrialing, daysLeftInTrial, onUpgrade, onAddCard, onCancelPlan, userId }: PlanSettingsProps) {
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
  const getInvoiceStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { label: 'PAID', bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
      case 'open':
        return { label: 'OPEN', bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
      case 'draft':
        return { label: 'DRAFT', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
      case 'void':
        return { label: 'VOID', bg: 'bg-red-500', text: 'text-white', border: 'border-black' };
      case 'uncollectible':
        return { label: 'UNCOLLECTIBLE', bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
      default:
        return { label: status?.toUpperCase() || 'UNKNOWN', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400' };
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
  const getPlanDisplayName = (plan: string) => {
    const names: Record<string, string> = {
      'free_trial': 'Free Trial',
      'pro': 'Pro',
      'business': 'Business',
      'enterprise': 'Enterprise',
    };
    return names[plan] || plan;
  };

  // Get status badge color - NEO-BRUTALIST (Updated January 8th, 2026)
  const getStatusBadge = () => {
    if (subscription?.cancel_at_period_end) {
      return { label: 'CANCELLED', bg: 'bg-orange-500', text: 'text-white', border: 'border-black' };
    }
    if (isTrialing) {
      return { label: 'TRIAL', bg: 'bg-blue-500', text: 'text-white', border: 'border-black' };
    }
    if (subscription?.status === 'active') {
      return { label: 'ACTIVE', bg: 'bg-green-500', text: 'text-white', border: 'border-black' };
    }
    return { label: 'ACTIVE', bg: 'bg-[#ffbf23]', text: 'text-black', border: 'border-black' };
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
                {subscription ? getPlanDisplayName(subscription.plan) : 'No Plan'}
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
            
            {/* Trial info */}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-bold">
                <Clock size={12} />
                <span>
                  {daysLeftInTrial === 0 
                    ? 'Trial ends today' 
                    : `${daysLeftInTrial} day${daysLeftInTrial !== 1 ? 's' : ''} left in trial`
                  }
                </span>
              </div>
            )}

            {/* Billing info */}
            {subscription && !isTrialing && subscription.nextBillingDate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                <Calendar size={12} />
                <span>Next billing: {subscription.nextBillingDate}</span>
              </div>
            )}

            {/* Price */}
            {subscription && subscription.formattedPrice && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {subscription.formattedPrice}
                {subscription.billing_interval === 'annual' && ' (billed annually)'}
              </p>
            )}
          </div>
          
          {/* Upgrade/Manage button - NEO-BRUTALIST */}
          {/* Updated January 8th, 2026 - contextual button text with neo-brutalist styling */}
          {(!subscription || subscription.plan !== 'enterprise') && (
            <button 
              onClick={onUpgrade}
              className="px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-1.5"
            >
              <Zap size={14} />
              {!subscription 
                ? 'Choose Plan' 
                : isTrialing 
                  ? 'Upgrade Plan' 
                  : 'Manage Plan'
              }
            </button>
          )}
        </div>

        {/* Trial warning - NEO-BRUTALIST */}
        {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-black">Your trial is ending soon</p>
              <p className="text-amber-700 dark:text-amber-400">Add a payment method to continue using all features.</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Payment Method</h3>
        {subscription?.card_last4 ? (
          <div className="p-4 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <CreditCard size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {subscription.card_brand || 'Card'} •••• {subscription.card_last4}
                </p>
                {subscription.card_exp_month && subscription.card_exp_year && (
                  <p className="text-xs text-gray-500">
                    Expires {String(subscription.card_exp_month).padStart(2, '0')}/{String(subscription.card_exp_year).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={onAddCard}
              className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white uppercase"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-1">No payment method added</p>
            <p className="text-xs text-gray-500 mb-4">
              {isTrialing 
                ? 'Add a card to continue using all features after your trial ends.'
                : 'Add a payment method to upgrade your plan.'
              }
            </p>
            <button 
              onClick={onAddCard}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Plus size={14} />
              Add Payment Method
            </button>
          </div>
        )}
      </div>

      {/* Invoices - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Invoice History</h3>
        
        {/* Loading State */}
        {invoicesLoading && (
          <div className="p-8 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500 font-medium">Loading invoices...</span>
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
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!invoicesLoading && !invoicesError && invoices.length === 0 && (
          <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-bold">No invoices yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Invoices will appear here after your first billing cycle
            </p>
          </div>
        )}

        {/* Invoice List - NEO-BRUTALIST */}
        {!invoicesLoading && !invoicesError && invoices.length > 0 && (
          <div className="border-2 border-black dark:border-gray-600 overflow-hidden">
            {/* Table Header */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b-2 border-black dark:border-gray-600 grid grid-cols-12 gap-4 text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              <div className="col-span-3">Invoice</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
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
                      {invoice.number || 'Draft'}
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
                        title="View invoice"
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
                        title="Download PDF"
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

      {/* Cancel Plan Section - NEO-BRUTALIST (Updated January 8th, 2026) */}
      {subscription && subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Cancel Subscription</h3>
          <p className="text-xs text-gray-500 mb-4">
            If you cancel, you'll still have access to your plan until the end of your current billing period.
          </p>
          <button 
            onClick={onCancelPlan}
            className="px-4 py-2 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-500 border-2 border-red-400 hover:border-red-600 transition-all uppercase"
          >
            Cancel Plan
          </button>
        </div>
      )}

      {/* Cancellation pending notice - NEO-BRUTALIST */}
      {subscription?.cancel_at_period_end && (
        <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-orange-800 dark:text-orange-300 uppercase">Subscription Canceling</h4>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  Your plan will be canceled at the end of the current billing period. 
                  You'll continue to have access until then.
                </p>
                <button 
                  onClick={onCancelPlan}
                  className="mt-3 px-3 py-1.5 text-xs font-bold text-orange-700 hover:text-white bg-white hover:bg-orange-500 border-2 border-orange-400 hover:border-orange-600 transition-all uppercase"
                >
                  Resume Subscription
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
// NOTIFICATION SETTINGS - NEO-BRUTALIST (Updated January 8th, 2026)
// 
// Design updates:
// - Sharp-edged notification rows
// - Bold checkboxes with yellow accent
// - Bold typography
// =============================================================================
function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Email Notifications</h3>
        
        {[
          { id: 'emailMatches', label: 'New affiliate matches found', desc: 'Get notified when we find new high-potential affiliates.' },
          { id: 'emailReports', label: 'Weekly performance report', desc: 'Summary of your campaign performance and outreach stats.' },
          { id: 'emailUpdates', label: 'Product updates', desc: 'News about new features and improvements.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors -mx-3 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700">
            <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-5 w-5 border-2 border-black dark:border-gray-600 accent-[#ffbf23] cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-900 dark:text-white block cursor-pointer">{item.label}</label>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">App Notifications</h3>
        {[
          { id: 'appReplies', label: 'Successful outreach replies', desc: 'Notify me when an affiliate replies to my email.' },
          { id: 'appReminders', label: 'Task reminders', desc: 'Remind me about follow-ups and scheduled tasks.' }
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors -mx-3 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700">
             <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                defaultChecked={true}
                className="peer h-5 w-5 border-2 border-black dark:border-gray-600 accent-[#ffbf23] cursor-pointer" 
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-gray-900 dark:text-white block cursor-pointer">{item.label}</label>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
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
  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
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
        throw new Error(result.error?.message || 'Failed to update password');
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
        setPasswordError('Current password is incorrect');
      } else if (err.message?.includes('PasswordRequirementsNotMet')) {
        setPasswordError('Password does not meet requirements');
      } else {
        setPasswordError(err.message || 'Failed to change password. Please try again.');
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
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    if (!neonUserId) {
      setDeleteError('User ID not found. Please refresh and try again.');
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
        throw new Error(data.error || 'Failed to delete account');
      }

      // Success - redirect to home page
      // The user is already signed out by the API (Stack Auth deletion)
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try again or contact support.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Password & Security</h3>
        <p className="text-sm text-gray-500">
          Change your password to keep your account secure.
        </p>
        <div className="pt-2">
          {/* January 13th, 2026: Opens password change modal */}
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors uppercase"
          >
            Change Password
          </button>
        </div>
      </div>
      
      <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* ================================================================= */}
      {/* DANGER ZONE - January 13th, 2026                                  */}
      {/* Delete Account button opens confirmation modal                    */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-red-600 uppercase tracking-wide">Danger Zone</h3>
        <p className="text-xs text-gray-500">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button 
          onClick={() => setIsDeleteModalOpen(true)}
          className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-400 text-sm font-bold hover:bg-red-500 hover:text-white hover:border-red-600 transition-all uppercase flex items-center gap-2"
        >
          <Trash2 size={14} />
          Delete Account
        </button>
      </div>

      {/* =================================================================== */}
      {/* PASSWORD CHANGE MODAL - January 13th, 2026                          */}
      {/* Simple form: Current Password -> New Password -> Confirm            */}
      {/* Uses Stack Auth's user.updatePassword() method                       */}
      {/* =================================================================== */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
        title="Change Password"
        width="max-w-md"
      >
        <div className="space-y-4">
          {/* Success Message */}
          {passwordSuccess && (
            <div className="p-3 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="text-sm font-bold text-green-700 dark:text-green-400">Password changed successfully!</span>
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
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder="Enter current password"
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
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder="Enter new password (min 8 characters)"
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
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword || passwordSuccess}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#ffbf23] disabled:opacity-50"
                placeholder="Confirm new password"
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
              Cancel
            </button>
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || passwordSuccess || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 text-xs font-black text-black bg-[#ffbf23] hover:bg-yellow-400 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save Password
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* =================================================================== */}
      {/* DELETE ACCOUNT CONFIRMATION MODAL - January 13th, 2026              */}
      {/*                                                                     */}
      {/* WARNING: This action is IRREVERSIBLE!                               */}
      {/* - Cancels Stripe subscription immediately                            */}
      {/* - Deletes all saved/discovered affiliates                           */}
      {/* - Deletes all search history and API logs                           */}
      {/* - Deletes user account from database                                */}
      {/* - Deletes authentication from Stack Auth                            */}
      {/*                                                                     */}
      {/* User must type "DELETE" to confirm                                  */}
      {/* =================================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        title="Delete Account"
        width="max-w-md"
      >
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="p-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-800 dark:text-red-300 uppercase">
                  This action cannot be undone
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  Your account and all associated data will be permanently deleted.
                </p>
              </div>
            </div>
          </div>

          {/* What will be deleted */}
          <div className="space-y-2">
            <p className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase">
              The following will be permanently deleted:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 pl-4">
              <li>• Your subscription (canceled immediately)</li>
              <li>• All saved affiliates</li>
              <li>• All discovered affiliates</li>
              <li>• All search history</li>
              <li>• Your account and login credentials</li>
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
              Type DELETE to confirm
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
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete Forever
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
