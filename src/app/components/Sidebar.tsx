'use client';

/**
 * =============================================================================
 * SIDEBAR COMPONENT
 * =============================================================================
 *
 * January 6th, 2026 — Neo-brutalist rewrite:
 *   Bold borders (border-4, border-2), hard offset shadows (shadow-neo-sm),
 *   brand yellow (#ffbf23), dark/light mode support.
 *
 * April 23rd, 2026 — "Smoover" refresh (Phase 2c):
 *   Carries the softer design language from the landing / auth / modal
 *   refreshes into the dashboard chrome:
 *     - Hairline borders (#e6ebf1) replace the 4px black dividers
 *     - Soft drop shadows (shadow-soft-lg / shadow-yellow-glow) replace
 *       the hard offset shadows
 *     - Active nav becomes a soft yellow pill (no more left-rail border-l-4)
 *     - Rounded-full pills for the EN/DE + theme row (matching navbar)
 *     - Archivo display font for the brand mark and dropdown titles
 *     - Logout modal buttons match the new ConfirmDeleteModal pattern
 *
 *   Logic, i18n keys, Supabase auth, subscription branches, SWR counts,
 *   and all hydration-safe patterns are UNCHANGED.
 *
 * The old design code is preserved in comments marked with:
 *   // OLD_DESIGN_START and // OLD_DESIGN_END
 *
 * To revert: uncomment OLD_DESIGN sections and comment NEW_DESIGN sections.
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  Briefcase, 
  Settings, 
  LogOut, 
  MoreHorizontal,
  Zap,
  Clock,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
// January 19th, 2026: Removed Stack Auth import
// import { useUser } from '@stackframe/stack';
// Now using useSupabaseUser hook which provides supabaseUser and signOut
import { Modal } from './Modal';
import { PricingModal } from './PricingModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../hooks/useAffiliates';
// January 19th, 2026: Migrated from useNeonUser to useSupabaseUser
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useSubscription } from '../hooks/useSubscription';
// =============================================================================
// LANGUAGE CONTEXT (January 9th, 2026)
// Added i18n support - see LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';
// =============================================================================
// THEME SWITCHER (January 22nd, 2026)
// Added dark mode toggle for dashboard - see ThemeContext for implementation
// =============================================================================
import { ThemeSwitcher } from './ThemeSwitcher';

// =============================================================================
// SKELETON COMPONENT
// Originally neo-brutalist (January 6th, 2026); refreshed to SMOOVER on
// April 23rd, 2026 so the loading state matches the post-hydration sidebar.
// =============================================================================
const SidebarSkeleton: React.FC = () => (
  <aside className="min-h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r border-[#e6ebf1] dark:border-gray-800 flex flex-col fixed left-0 top-0 bottom-0 z-40">
    {/* Brand / Logo Area — SMOOVER skeleton mirror (April 23rd, 2026) */}
    <div className="h-16 px-6 border-b border-[#e6ebf1] dark:border-gray-800 flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <img src="/logo.svg" alt="Afforce One" className="w-7 h-7 rounded-md" />
        <span className="font-display text-lg font-bold tracking-tight leading-none text-[#0f172a] dark:text-white">Afforce One</span>
      </div>
      {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
    </div>

    {/* Navigation Skeleton */}
    <nav className="flex-1 p-4 space-y-6 overflow-y-auto animate-pulse">
      <div>
        <div className="h-3 w-20 bg-[#e6ebf1] dark:bg-gray-800 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-10 bg-[#f6f9fc] dark:bg-gray-900 rounded-lg"></div>
          <div className="h-10 bg-[#f6f9fc] dark:bg-gray-900 rounded-lg"></div>
        </div>
      </div>

      <div>
        <div className="h-3 w-24 bg-[#e6ebf1] dark:bg-gray-800 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-10 bg-[#f6f9fc] dark:bg-gray-900 rounded-lg"></div>
          <div className="h-10 bg-[#f6f9fc] dark:bg-gray-900 rounded-lg"></div>
        </div>
      </div>
    </nav>

    {/* Bottom Section Skeleton — SMOOVER: hairline divider + off-white bg */}
    <div className="p-4 border-t border-[#e6ebf1] dark:border-gray-800 bg-[#f6f9fc] dark:bg-[#0a0a0a] animate-pulse">
      {/* Plan Card Skeleton — SMOOVER: rounded-2xl with soft shadow */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-2xl mb-4 border border-gray-800 shadow-soft-lg">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-700 rounded"></div>
          <div className="h-2 w-24 bg-gray-700 rounded"></div>
          <div className="h-7 w-full bg-gray-700 rounded-full mt-3"></div>
        </div>
      </div>

      {/* Profile Skeleton */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-8 h-8 rounded-full bg-[#e6ebf1] dark:bg-gray-700"></div>
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-16 bg-[#e6ebf1] dark:bg-gray-700 rounded"></div>
          <div className="h-2.5 w-28 bg-[#e6ebf1] dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  </aside>
);

/* OLD_DESIGN_START - SidebarSkeleton (pre-January 6th, 2026)
const SidebarSkeletonOld: React.FC = () => (
  <aside className="min-h-screen w-52 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40">
    <div className="h-14 flex items-center mt-1 mb-6 px-4">
      <div className="flex items-center gap-2.5 text-slate-900">
        <img src="/logo.svg" alt="Afforce One" className="w-7 h-7 rounded-lg shadow-md shadow-[#1A1D21]/10 shrink-0" />
        <span className="font-bold text-sm tracking-tight leading-none">Afforce <span className="text-[#1A1D21]">One</span></span>
      </div>
    </div>
    <nav className="flex-1 space-y-6 overflow-y-auto py-1 px-3 animate-pulse">
      <div>
        <div className="h-2.5 w-16 bg-slate-200 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-9 bg-slate-100 rounded-lg"></div>
          <div className="h-9 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
      <div>
        <div className="h-2.5 w-20 bg-slate-200 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-9 bg-slate-100 rounded-lg"></div>
          <div className="h-9 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
    </nav>
    <div className="p-3 space-y-3 bg-white/50 animate-pulse">
      <div className="bg-slate-100 rounded-xl p-3.5">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-3 w-full bg-slate-200 rounded"></div>
          <div className="h-8 w-full bg-slate-200 rounded-lg mt-2"></div>
        </div>
      </div>
      <div className="border-t border-slate-100"></div>
      <div className="flex items-center gap-2.5 p-2">
        <div className="w-7 h-7 bg-slate-200 rounded-full"></div>
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
          <div className="h-2.5 w-32 bg-slate-200 rounded"></div>
        </div>
        <div className="w-4 h-4 bg-slate-200 rounded"></div>
      </div>
    </div>
  </aside>
);
OLD_DESIGN_END */

export const Sidebar: React.FC = () => {
  // Translation hook (January 9th, 2026)
  // January 22nd, 2026: Added language and setLanguage for inline switcher
  const { t, language, setLanguage } = useLanguage();
  // January 19th, 2026: Migrated from Stack Auth useUser() + useNeonUser() to useSupabaseUser()
  // const user = useUser(); // Removed - Stack Auth
  const { userId, user, supabaseUser, userName: hookUserName, isLoading: userLoading, signOut } = useSupabaseUser();
  const { subscription, isTrialing, isPastDue, daysLeftInTrial, isLoading: subscriptionLoading, refetch: refetchSubscription } = useSubscription(userId);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const pathname = usePathname();
  
  // ==========================================================================
  // REAL-TIME COUNTS WITH SWR - January 3rd, 2026
  // 
  // These hooks now use SWR for global cache sharing. When any component
  // (e.g., Find New page, Saved page) saves or removes an affiliate, it calls
  // SWR's mutate(), which updates ALL components using the same cache key.
  // 
  // RESULT: Sidebar counts update instantly without page refresh!
  // 
  // NOTE: We still need the useState/useEffect pattern below for SSR hydration
  // to prevent the server/client mismatch on Vercel. SWR handles the cache
  // sharing, the useEffect handles the SSR hydration.
  // ==========================================================================
  const { count: pipelineCount } = useSavedAffiliates();
  const { count: discoveredCount } = useDiscoveredAffiliates();

  // ==========================================================================
  // CLIENT-SIDE BADGE RENDERING - January 3rd, 2026
  // 
  // ISSUE: Badge counts work locally but don't show on Vercel production.
  // 
  // ROOT CAUSE (SSR Hydration Mismatch):
  // - During SSR on Vercel, userId is null (no auth cookies on server)
  // - Hooks return count: 0, so badges don't render in server HTML
  // - On client hydration, hooks should refetch and update counts
  // - But React may not re-render the badges due to hydration optimization
  // 
  // SOLUTION (Next.js Recommended Pattern):
  // Use useState(null) + useEffect to ensure badges only render on client.
  // - Server renders with displayCount = null (no badge in HTML)
  // - Client useEffect runs AFTER hydration, sets actual count
  // - Badge renders correctly on client without hydration mismatch
  // 
  // The SWR migration above handles real-time updates across components.
  // This pattern just handles the SSR/client rendering boundary.
  // ==========================================================================
  const [displayPipelineCount, setDisplayPipelineCount] = useState<number | null>(null);
  const [displayDiscoveredCount, setDisplayDiscoveredCount] = useState<number | null>(null);

  // Update display counts on client after hydration
  useEffect(() => {
    setDisplayPipelineCount(pipelineCount);
  }, [pipelineCount]);

  useEffect(() => {
    setDisplayDiscoveredCount(discoveredCount);
  }, [discoveredCount]);

  // January 19th, 2026: Updated to use signOut from useSupabaseUser
  const handleLogout = async () => {
    await signOut();
    setIsLogoutModalOpen(false);
  };

  // Database name takes priority so sidebar stays in sync with profile settings
  const userName = user?.name || hookUserName || supabaseUser?.email?.split('@')[0] || 'User';
  const userEmail = supabaseUser?.email || user?.email || '';
  const userImageUrl = user?.profile_image_url || supabaseUser?.user_metadata?.avatar_url;

  // Show skeleton while user data is loading
  if (userLoading || subscriptionLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      {/* =============================================================================
          SMOOVER SIDEBAR — April 23rd, 2026 (Phase 2c)
          Replaces the Jan 6 2026 neo-brutalist treatment with hairline borders,
          soft shadows, and display typography. See file-level comment for context.
          ============================================================================= */}
      <aside className="min-h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r border-[#e6ebf1] dark:border-gray-800 flex flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Brand / Logo Area — SMOOVER: hairline bottom divider, plain rounded logo, display-font title */}
        <div className="h-16 px-6 border-b border-[#e6ebf1] dark:border-gray-800 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Afforce One" className="w-7 h-7 rounded-md" />
            <span className="font-display text-lg font-bold tracking-tight leading-none text-[#0f172a] dark:text-white">Afforce One</span>
          </div>
          {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
        </div>

        {/* Main Navigation — SMOOVER (April 23rd, 2026) */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Discovery Section - Translated (January 9th, 2026) */}
          <div>
            <h4 className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-widest mb-3 px-2">{t.nav.discovery}</h4>
            <ul className="space-y-1">
              <li>
                <NavItemNeo 
                  href="/find" 
                  icon={<Search size={18} />} 
                  label={t.nav.findNew} 
                  active={pathname === '/find'} 
                />
              </li>
              <li>
                <NavItemNeo 
                  href="/discovered"
                  icon={<LayoutDashboard size={18} />} 
                  label={t.nav.allDiscovered} 
                  badge={displayDiscoveredCount && displayDiscoveredCount > 0 ? displayDiscoveredCount.toString() : undefined}
                  active={pathname === '/discovered'}
                />
              </li>
            </ul>
          </div>

          {/* Management Section - Translated (January 9th, 2026) */}
          <div>
            <h4 className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-widest mb-3 px-2">{t.nav.management}</h4>
            <ul className="space-y-1">
              <li>
                <NavItemNeo 
                  href="/saved"
                  icon={<Briefcase size={18} />} 
                  label={t.nav.savedAffiliates} 
                  badge={displayPipelineCount && displayPipelineCount > 0 ? displayPipelineCount.toString() : undefined}
                  active={pathname === '/saved'}
                />
              </li>
              <li>
                <NavItemNeo 
                  href="/outreach"
                  icon={<Users size={18} />} 
                  label={t.nav.outreach}
                  active={pathname === '/outreach'}
                />
              </li>
            </ul>
          </div>
        </nav>

        {/* =================================================================
            LANGUAGE & THEME SWITCHERS + PLAN CARD (January 10th, 2026)
            Moved above the black divider line per client request.
            These should appear above the profile section separator.
            See LANGUAGE_MIGRATION.md for i18n documentation.
            
            January 22nd, 2026: Added ThemeSwitcher for dark mode toggle
            - Combined into single row with matching styles
            ================================================================= */}
        <div className="px-4 pb-4">
          {/* Language & Theme Switchers — SMOOVER (April 23rd, 2026): rounded-full hairline container, visual parity with the navbar */}
          <div className="mb-4 flex items-center justify-between px-2 py-1.5 rounded-full bg-[#f6f9fc] dark:bg-[#111] border border-[#e6ebf1] dark:border-gray-800">
            {/* Language toggle — rounded-full pills matching LanguageSwitcher.tsx navbar variant */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full transition-all",
                  language === 'en'
                    ? "bg-[#ffbf23] text-black shadow-soft-sm"
                    : "text-[#8898aa] hover:text-[#425466] dark:text-gray-500 dark:hover:text-gray-300"
                )}
                aria-label="Switch to English"
                title="English"
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('de')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full transition-all",
                  language === 'de'
                    ? "bg-[#ffbf23] text-black shadow-soft-sm"
                    : "text-[#8898aa] hover:text-[#425466] dark:text-gray-500 dark:hover:text-gray-300"
                )}
                aria-label="Switch to German"
                title="Deutsch"
              >
                DE
              </button>
            </div>
            
            {/* Theme toggle - February 2, 2026: Changed to navbar variant for animated sun/moon toggle */}
            <ThemeSwitcher variant="navbar" />
          </div>

          {/* Plan Card — SMOOVER (April 23rd, 2026): rounded-2xl gradient card, soft drop shadow, yellow-glow on hover. Logic UNCHANGED. */}
          <div 
            className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-2xl text-white border border-gray-800 shadow-soft-lg cursor-pointer hover:shadow-yellow-glow hover:-translate-y-0.5 transition-all duration-300"
            onClick={() => setIsPricingModalOpen(true)}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-1.5 bg-[#ffbf23] rounded-md text-black shadow-soft-sm">
                <Zap size={14} fill="currentColor" />
              </div>
              <div>
                <h5 className="font-display font-bold text-xs uppercase tracking-wide text-[#ffbf23]">
                  {isTrialing 
                    ? `${subscription?.plan || 'Trial'} ${t.sidebar.planCard.planSuffix}`
                    : subscription?.status === 'active'
                      ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} ${t.sidebar.planCard.planSuffix}`
                      : subscription?.status === 'past_due' || subscription?.status === 'canceled'
                        ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} ${t.sidebar.planCard.planSuffix}`
                        : 'Free Plan'
                  }
                </h5>
                <p className="text-[10px] text-gray-300 flex items-center gap-1">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    subscription?.status === 'past_due' ? 'bg-red-500' : subscription?.status === 'canceled' ? 'bg-orange-500' : 'bg-green-500'
                  )}></span>
                  {isTrialing 
                    ? `${daysLeftInTrial} ${t.sidebar.planCard.daysLeft}`
                    : subscription?.status === 'active'
                      ? t.sidebar.planCard.activeSubscription
                      : isPastDue
                        ? t.sidebar.planCard.paymentFailed
                        : subscription?.status === 'canceled'
                          ? t.sidebar.planCard.cancelled
                          : t.sidebar.planCard.upgradeAvailable
                  }
                </p>
              </div>
            </div>
            <button className="w-full py-2 bg-[#ffbf23] hover:bg-[#e5ac20] text-black text-xs font-semibold uppercase tracking-wide rounded-full transition-colors flex items-center justify-center gap-1">
              {subscription?.status === 'active' 
                ? t.sidebar.planCard.managePlan 
                : isPastDue 
                  ? t.sidebar.planCard.subscribeNow 
                  : subscription?.status === 'canceled' 
                    ? t.sidebar.planCard.resubscribe 
                    : t.sidebar.planCard.upgradePlan} <ChevronRight size={10} />
            </button>
          </div>
        </div>

        {/* User Profile Section — SMOOVER (April 23rd, 2026): hairline divider, brand off-white background */}
        <div className="p-4 border-t border-[#e6ebf1] dark:border-gray-800 bg-[#f6f9fc] dark:bg-[#0a0a0a]">
          {/* User Profile — SMOOVER (April 23rd, 2026) */}
          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-3 px-2 w-full hover:bg-white dark:hover:bg-gray-900 rounded-xl py-2 transition-colors border border-transparent hover:border-[#e6ebf1] dark:hover:border-gray-800"
            >
              <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center font-semibold text-xs text-[#425466] dark:text-gray-300 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm overflow-hidden">
                {userImageUrl ? (
                  <img src={userImageUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  userName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate text-[#0f172a] dark:text-white">{userName}</p>
                <p className="text-xs text-[#8898aa] dark:text-gray-500 truncate">{userEmail}</p>
              </div>
              <MoreHorizontal size={16} className="text-[#8898aa] dark:text-gray-500" />
            </button>

            {/* Dropdown Menu — SMOOVER (April 23rd, 2026) */}
            {isProfileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileMenuOpen(false)} 
                />
                {/* Profile Dropdown — SMOOVER (April 23rd, 2026): rounded-xl hairline border with soft shadow */}
                <div className="absolute bottom-full mb-2 left-0 w-full bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl shadow-soft-lg py-1 z-50 overflow-hidden">
                  <Link 
                    href="/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-[#425466] dark:text-gray-200 hover:bg-[#f6f9fc] dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Settings size={14} />
                    {t.sidebar.profile.settings}
                  </Link>
                  <div className="h-px bg-[#e6ebf1] dark:bg-gray-800 my-1" />
                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsLogoutModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    {t.sidebar.profile.logout}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* 
        OLD_DESIGN_START - Sidebar Bottom Section (pre-January 6th, 2026)
        See component documentation at the top of this file for the old design code.
        The old design used:
        - bg-white/50 container
        - Trial/Active/Free plan banners with radial gradient pattern
        - Rounded profile with avatar and dropdown menu
        - border-t divider between sections
        OLD_DESIGN_END 
      */}

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

      {/* Logout Confirmation Modal — SMOOVER (April 23rd, 2026): rounded-full buttons matching ConfirmDeleteModal */}
      <Modal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)}
        title={t.sidebar.logoutModal.title}
        width="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#425466] dark:text-gray-400 leading-relaxed">
            {t.sidebar.logoutModal.message}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium rounded-full text-[#425466] dark:text-gray-300 bg-white dark:bg-[#1a1a1a] hover:bg-[#f6f9fc] dark:hover:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm transition-all duration-200"
            >
              {t.sidebar.logoutModal.cancel}
            </button>
            <button 
              onClick={handleLogout}
              className="px-5 py-2.5 text-sm font-semibold rounded-full text-white bg-red-500 hover:bg-red-600 shadow-[0_4px_14px_-2px_rgba(239,68,68,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(239,68,68,0.45)] transition-all duration-200 flex items-center gap-2"
            >
              <LogOut size={14} />
              {t.sidebar.logoutModal.confirm}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// =============================================================================
// NAV ITEM COMPONENTS
// =============================================================================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
  href?: string;
}

// SMOOVER NavItem (April 23rd, 2026): soft yellow pill active state (no left rail), rounded-full pill badge
const NavItemNeo = ({ icon, label, active, badge, onClick, href }: NavItemProps) => {
  const content = (
    <>
      {icon}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 text-[#425466] dark:text-gray-300 rounded-full">
          {badge}
        </span>
      )}
    </>
  );

  const className = cn(
    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
    active 
      ? "bg-[#fff4d1] dark:bg-[#ffbf23]/10 text-[#0f172a] dark:text-[#ffbf23] font-semibold shadow-soft-sm" 
      : "text-[#425466] dark:text-gray-400 hover:bg-[#f6f9fc] dark:hover:bg-gray-900 hover:text-[#0f172a] dark:hover:text-white"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
};

/* OLD_DESIGN_START - NavItem (pre-January 6th, 2026)
const NavItem = ({ icon, label, active, badge, onClick, href }: NavItemProps) => {
  const content = (
    <>
      <span className={cn("transition-colors shrink-0", active ? "text-[#1A1D21]" : "group-hover:text-slate-700")}>
        {icon}
      </span>
      <span className="text-left flex-1">
        {label}
      </span>
      {badge && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[9px] font-bold min-w-[20px] text-center",
          active ? "bg-[#D4E815]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
        )}>
          {badge}
        </span>
      )}
    </>
  );

  const className = cn(
    "w-full flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 group relative justify-start px-2.5 py-1.5 gap-2.5",
    active 
      ? "bg-[#D4E815]/10 text-[#1A1D21]" 
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
};
OLD_DESIGN_END */
