'use client';

/**
 * =============================================================================
 * SIDEBAR COMPONENT - January 6th, 2026
 * =============================================================================
 * 
 * DESIGN UPDATE: Implementing neo-brutalist design from DashboardDemo.tsx
 * 
 * The old design code is preserved in comments marked with:
 *   // OLD_DESIGN_START and // OLD_DESIGN_END
 * 
 * New design uses:
 *   - Bold borders (border-4, border-2)
 *   - Neo-brutalist shadows (shadow-neo-sm)
 *   - Brand yellow (#ffbf23) instead of Electric Lime
 *   - Dark/Light mode support
 *   - More industrial/terminal aesthetic
 * 
 * To revert: Uncomment OLD_DESIGN sections and comment NEW_DESIGN sections
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
// LANGUAGE SWITCHER (January 9th, 2026)
// Added i18n support - see LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// SKELETON COMPONENT - NEW DESIGN (January 6th, 2026)
// Neo-brutalist style with bold borders and industrial aesthetic
// =============================================================================
const SidebarSkeleton: React.FC = () => (
  <aside className="min-h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r-4 border-black dark:border-white flex flex-col fixed left-0 top-0 bottom-0 z-40">
    {/* Brand / Logo Area - h-16 to match main header */}
    <div className="h-16 px-6 border-b-4 border-black dark:border-white flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <div className="bg-[#ffbf23] p-1 border-2 border-black dark:border-white">
          <Zap size={16} className="text-black" />
        </div>
        <span className="font-black text-lg tracking-tighter leading-none">CrewCast Studio</span>
      </div>
      {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
    </div>

    {/* Navigation Skeleton */}
    <nav className="flex-1 p-4 space-y-6 overflow-y-auto animate-pulse">
      <div>
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-10 bg-gray-100 dark:bg-gray-900 rounded-md"></div>
          <div className="h-10 bg-gray-100 dark:bg-gray-900 rounded-md"></div>
        </div>
      </div>

      <div>
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-3 ml-2"></div>
        <div className="space-y-1">
          <div className="h-10 bg-gray-100 dark:bg-gray-900 rounded-md"></div>
          <div className="h-10 bg-gray-100 dark:bg-gray-900 rounded-md"></div>
        </div>
      </div>
    </nav>

    {/* Bottom Section Skeleton */}
    <div className="p-4 border-t-4 border-black dark:border-white bg-gray-50 dark:bg-[#111] animate-pulse">
      {/* Plan Card Skeleton */}
      <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4 border-2 border-black dark:border-gray-700">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-700 rounded"></div>
          <div className="h-2 w-24 bg-gray-700 rounded"></div>
          <div className="h-7 w-full bg-gray-700 rounded mt-3"></div>
        </div>
      </div>

      {/* Profile Skeleton */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-2.5 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
        <img src="/logo.jpg" alt="CrewCast Studio" className="w-7 h-7 rounded-lg shadow-md shadow-[#1A1D21]/10 shrink-0 object-cover" />
        <span className="font-bold text-sm tracking-tight leading-none">CrewCast <span className="text-[#1A1D21]">Studio</span></span>
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
  const { t } = useLanguage();
  // January 19th, 2026: Migrated from Stack Auth useUser() + useNeonUser() to useSupabaseUser()
  // const user = useUser(); // Removed - Stack Auth
  const { userId, user, supabaseUser, userName: hookUserName, isLoading: userLoading, signOut } = useSupabaseUser();
  const { subscription, isTrialing, daysLeftInTrial, isLoading: subscriptionLoading, refetch: refetchSubscription } = useSubscription(userId);
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

  // January 19th, 2026: Updated to use Supabase user properties
  // Supabase user has: email, user_metadata.name, user_metadata.avatar_url
  // Database user (from useSupabaseUser) has: name, email, profile_image_url
  const userName = hookUserName || user?.name || supabaseUser?.email?.split('@')[0] || 'User';
  const userEmail = supabaseUser?.email || user?.email || '';
  const userImageUrl = user?.profile_image_url || supabaseUser?.user_metadata?.avatar_url;

  // Show skeleton while user data is loading
  if (userLoading || subscriptionLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      {/* =============================================================================
          NEW DESIGN - Neo-brutalist Sidebar (January 6th, 2026)
          ============================================================================= */}
      <aside className="min-h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r-4 border-black dark:border-white flex flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Brand / Logo Area - Neo-brutalist style - h-16 to match main header */}
        <div className="h-16 px-6 border-b-4 border-black dark:border-white flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#ffbf23] p-1 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_#000000]">
              <Zap size={16} className="text-black" />
            </div>
            <span className="font-black text-lg tracking-tighter leading-none">CrewCast Studio</span>
          </div>
          {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
        </div>

        {/* Main Navigation - Neo-brutalist style */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Discovery Section - Translated (January 9th, 2026) */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">{t.nav.discovery}</h4>
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
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">{t.nav.management}</h4>
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
            LANGUAGE SWITCHER & PLAN CARD (January 10th, 2026)
            Moved above the black divider line per client request.
            These should appear above the profile section separator.
            See LANGUAGE_MIGRATION.md for i18n documentation.
            ================================================================= */}
        <div className="px-4 pb-4">
          {/* Language Switcher */}
          <div className="mb-4">
            <LanguageSwitcher variant="sidebar" />
          </div>

          {/* Plan Card - Neo-brutalist style - Translated (January 9th, 2026) */}
          <div 
            className="bg-[#1a1a1a] p-4 rounded-lg text-white border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_0px_#000000] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            onClick={() => setIsPricingModalOpen(true)}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-1.5 bg-[#ffbf23] rounded text-black">
                <Zap size={14} fill="currentColor" />
              </div>
              <div>
                <h5 className="font-black text-xs uppercase text-[#ffbf23]">
                  {isTrialing 
                    ? `${subscription?.plan || 'Trial'} ${t.sidebar.planCard.planSuffix}`
                    : subscription?.status === 'active'
                      ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} ${t.sidebar.planCard.planSuffix}`
                      : 'Free Plan'
                  }
                </h5>
                <p className="text-[10px] text-gray-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  {isTrialing 
                    ? `${daysLeftInTrial} ${t.sidebar.planCard.daysLeft}`
                    : subscription?.status === 'active'
                      ? t.sidebar.planCard.activeSubscription
                      : t.sidebar.planCard.upgradeAvailable
                  }
                </p>
              </div>
            </div>
            <button className="w-full py-1.5 bg-[#ffbf23] text-black text-xs font-bold uppercase rounded hover:bg-white transition-colors flex items-center justify-center gap-1">
              {subscription?.status === 'active' ? t.sidebar.planCard.managePlan : t.sidebar.planCard.upgradePlan} <ChevronRight size={10} />
            </button>
          </div>
        </div>

        {/* User Profile Section - Below black divider line (January 10th, 2026) */}
        <div className="p-4 border-t-4 border-black dark:border-white bg-gray-50 dark:bg-[#111]">
          {/* User Profile - Neo-brutalist style */}
          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-3 px-1 w-full hover:bg-gray-100 dark:hover:bg-gray-900 rounded-md py-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center font-bold text-xs border border-gray-400 overflow-hidden">
                {userImageUrl ? (
                  <img src={userImageUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  userName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
              <MoreHorizontal size={16} className="text-gray-400" />
            </button>

            {/* Dropdown Menu - Neo-brutalist style */}
            {isProfileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileMenuOpen(false)} 
                />
                {/* Profile Dropdown - Translated (January 9th, 2026) */}
                <div className="absolute bottom-full mb-2 left-0 w-full bg-white dark:bg-[#1a1a1a] border-2 border-black dark:border-white rounded-md shadow-[2px_2px_0px_0px_#000000] py-1 z-50 overflow-hidden">
                  <Link 
                    href="/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Settings size={14} />
                    {t.sidebar.profile.settings}
                  </Link>
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsLogoutModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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

      {/* Logout Confirmation Modal - Translated (January 9th, 2026) */}
      <Modal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)}
        title={t.sidebar.logoutModal.title}
        width="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            {t.sidebar.logoutModal.message}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all duration-200"
            >
              {t.sidebar.logoutModal.cancel}
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border border-transparent rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
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

// NEW DESIGN - Neo-brutalist NavItem (January 6th, 2026)
const NavItemNeo = ({ icon, label, active, badge, onClick, href }: NavItemProps) => {
  const content = (
    <>
      {icon}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-200 dark:bg-gray-800 rounded">
          {badge}
        </span>
      )}
    </>
  );

  const className = cn(
    "w-full flex items-center gap-3 px-3 py-2 font-medium rounded-md transition-colors",
    active 
      ? "bg-[#ffbf23]/20 text-black dark:text-[#ffbf23] font-bold border-l-4 border-[#ffbf23]" 
      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-black dark:hover:text-white"
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
