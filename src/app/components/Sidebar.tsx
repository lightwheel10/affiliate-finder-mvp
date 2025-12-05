'use client';

import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@stackframe/stack';
import { Modal } from './Modal';
import { PricingModal } from './PricingModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSavedAffiliates, useDiscoveredAffiliates } from '../hooks/useAffiliates';
import { useNeonUser } from '../hooks/useNeonUser';
import { useSubscription } from '../hooks/useSubscription';

// Skeleton component for loading state
const SidebarSkeleton: React.FC = () => (
  <aside className="min-h-screen w-60 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40">
    {/* Brand / Logo Area - Always visible */}
    <div className="h-14 flex items-center mt-1 mb-6 px-4">
      <div className="flex items-center gap-2.5 text-slate-900">
        <img 
          src="/logo.jpg" 
          alt="CrewCast Studio" 
          className="w-7 h-7 rounded-lg shadow-md shadow-[#1A1D21]/10 shrink-0 object-cover"
        />
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight leading-none">CrewCast <span className="text-[#1A1D21]">Studio</span></span>
          <span className="text-[9px] font-medium text-slate-400 tracking-wide mt-0.5">backed by selecdoo AI</span>
        </div>
      </div>
    </div>

    {/* Navigation Skeleton */}
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

    {/* Bottom Section Skeleton */}
    <div className="p-3 space-y-3 bg-white/50 animate-pulse">
      {/* Plan Banner Skeleton */}
      <div className="bg-slate-100 rounded-xl p-3.5">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-3 w-full bg-slate-200 rounded"></div>
          <div className="h-8 w-full bg-slate-200 rounded-lg mt-2"></div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100"></div>

      {/* Profile Skeleton */}
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

export const Sidebar: React.FC = () => {
  const user = useUser();
  const { userId, isLoading: userLoading } = useNeonUser();
  const { subscription, isTrialing, daysLeftInTrial, isLoading: subscriptionLoading, refetch: refetchSubscription } = useSubscription(userId);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const pathname = usePathname();
  
  // Hooks for real-time counts
  const { count: pipelineCount } = useSavedAffiliates();
  const { count: discoveredCount } = useDiscoveredAffiliates();

  const handleLogout = async () => {
    await user?.signOut();
    setIsLogoutModalOpen(false);
  };

  // Get user display info from Stack Auth
  const userName = user?.displayName || user?.primaryEmail?.split('@')[0] || 'User';
  const userEmail = user?.primaryEmail || '';
  const userImageUrl = user?.profileImageUrl;

  // Show skeleton while user data is loading
  if (userLoading || subscriptionLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      <aside className="min-h-screen w-60 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Brand / Logo Area */}
        <div className="h-14 flex items-center mt-1 mb-6 px-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-7 h-7 rounded-lg shadow-md shadow-[#1A1D21]/10 shrink-0 object-cover"
            />
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-none">CrewCast <span className="text-[#1A1D21]">Studio</span></span>
              <span className="text-[9px] font-medium text-slate-400 tracking-wide mt-0.5">backed by selecdoo AI</span>
            </div>
          </div>
        </div>


        {/* Main Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto py-1 px-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-0.5 px-2">Discovery</p>
            <div className="space-y-0.5">
              <NavItem 
                href="/" 
                icon={<Search size={14} />} 
                label="Find New" 
                active={pathname === '/'} 
              />
              <NavItem 
                href="/discovered"
                icon={<LayoutDashboard size={14} />} 
                label="All Discovered" 
                badge={discoveredCount > 0 ? discoveredCount.toString() : undefined}
                active={pathname === '/discovered'}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-0.5 px-2">Management</p>
            <div className="space-y-0.5">
              <NavItem 
                href="/saved"
                icon={<Briefcase size={14} />} 
                label="Saved Affiliates" 
                badge={pipelineCount > 0 ? pipelineCount.toString() : undefined}
                active={pathname === '/saved'}
              />
              <NavItem icon={<Users size={14} />} label="Outreach" />
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 space-y-3 bg-white/50">
          
          {/* Dynamic Plan Banner - Changes based on trial/subscription status */}
          {isTrialing ? (
            // Trial with card (card is always on file now since it's required at signup)
            <div className="bg-[#1A1D21] rounded-xl p-3.5 text-white relative overflow-hidden group cursor-pointer shadow-lg shadow-[#1A1D21]/20" onClick={() => setIsPricingModalOpen(true)}>
              <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="p-1 rounded-md backdrop-blur-sm bg-[#D4E815]/20">
                    <Clock size={12} className="text-[#D4E815]" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-white/90">
                    {subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Trial'} Plan
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 leading-tight">
                  {daysLeftInTrial === 0 
                    ? 'Trial ends today' 
                    : daysLeftInTrial === 1 
                      ? '1 day left in trial' 
                      : `${daysLeftInTrial} days left in trial`
                  }
                </h4>
                <p className="text-[10px] text-slate-300 leading-relaxed mb-3 opacity-90">
                  Upgrade or change your plan anytime.
                </p>
                <button className="w-full bg-[#D4E815] text-[#1A1D21] text-[10px] font-bold py-2 rounded-lg shadow-sm hover:bg-[#c5d913] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md">
                  Change Plan <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500 bg-[#D4E815]/20 group-hover:bg-[#D4E815]/30" />
            </div>
          ) : subscription?.status === 'active' ? (
            // Active subscription - Show manage plan
            <div className="bg-[#1A1D21] rounded-xl p-3.5 text-white relative overflow-hidden group cursor-pointer shadow-lg shadow-[#1A1D21]/20" onClick={() => setIsPricingModalOpen(true)}>
              <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="p-1 rounded-md backdrop-blur-sm bg-[#D4E815]/20">
                    <Zap size={12} className="text-[#D4E815]" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-white/90">
                    {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 leading-tight flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Active Subscription
                </h4>
                <p className="text-[10px] text-slate-300 leading-relaxed mb-3 opacity-90">
                  Manage your plan or update billing
                </p>
                <button className="w-full bg-[#D4E815] text-[#1A1D21] text-[10px] font-bold py-2 rounded-lg shadow-sm hover:bg-[#c5d913] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md">
                  Manage Plan <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500 bg-[#D4E815]/20 group-hover:bg-[#D4E815]/30" />
            </div>
          ) : (
            // No subscription - Show upgrade CTA
            <div className="bg-[#1A1D21] rounded-xl p-3.5 text-white relative overflow-hidden group cursor-pointer shadow-lg shadow-[#1A1D21]/20" onClick={() => setIsPricingModalOpen(true)}>
              <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="p-1 rounded-md backdrop-blur-sm bg-[#D4E815]/20">
                    <Zap size={12} className="text-[#D4E815]" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-white/90">
                    Free Plan
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 leading-tight">
                  Upgrade to Pro
                </h4>
                <p className="text-[10px] text-slate-300 leading-relaxed mb-3 opacity-90">
                  Unlock unlimited searches and premium features.
                </p>
                <button className="w-full bg-[#D4E815] text-[#1A1D21] text-[10px] font-bold py-2 rounded-lg shadow-sm hover:bg-[#c5d913] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md">
                  Upgrade Now <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500 bg-[#D4E815]/20 group-hover:bg-[#D4E815]/30" />
              <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full blur-xl bg-[#D4E815]/10" />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100"></div>

          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center w-full rounded-lg transition-all duration-200 hover:bg-slate-50 group p-2 gap-2.5"
            >
              <div className="relative shrink-0">
                 <img 
                  src={userImageUrl || `https://ui-avatars.com/api/?name=${userName}&background=0f172a&color=fff`}
                  alt="User" 
                  className="w-7 h-7 rounded-full border border-white shadow-sm object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{userName}</p>
                <p className="text-[10px] text-slate-500 truncate">{userEmail || 'Free Plan'}</p>
              </div>

              <MoreHorizontal size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isProfileMenuOpen && (
              <>
                {/* Backdrop to close menu on click outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileMenuOpen(false)} 
                />
                <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <Link 
                    href="/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 relative z-50"
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                  <div className="h-px bg-slate-100 my-1" />
                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsLogoutModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 relative z-50"
                  >
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Pricing Modal */}
      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
      />

      {/* Logout Confirmation Modal */}
      <Modal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)}
        title="Log out"
        width="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            Are you sure you want to log out? You'll need to sign in again to access your workspace.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border border-transparent rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
  href?: string;
}

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
    <button 
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
};
