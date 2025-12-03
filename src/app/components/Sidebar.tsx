'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  Briefcase, 
  Settings, 
  LogOut, 
  ChevronDown,
  Command,
  MoreHorizontal,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';

// Selecdoo "S" Logo Icon
const SelecdooIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
  >
    <path 
      d="M12 4C8.5 4 6 6 6 8.5C6 11 8 12.5 12 13.5C16 14.5 18 16 18 18.5C18 21 15.5 23 12 23C8.5 23 6 21 6 18.5M12 1V4M12 23V20" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);
import { cn } from '@/lib/utils';
import { useAuth, getTrialDaysRemaining } from '../context/AuthContext';
import { Modal } from './Modal';
import { PricingModal } from './PricingModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSavedAffiliates, getDiscoveredAffiliates } from '../services/storage';

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const pathname = usePathname();
  const [pipelineCount, setPipelineCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  useEffect(() => {
    const updateSavedCount = () => {
      const count = getSavedAffiliates().length;
      setPipelineCount(count);
    };

    const updateDiscoveredCount = () => {
      const count = getDiscoveredAffiliates().length;
      setDiscoveredCount(count);
    };

    // Initialize counts
    updateSavedCount();
    updateDiscoveredCount();
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', updateSavedCount);
    window.addEventListener('storage', updateDiscoveredCount);
    
    // Listen for internal updates
    window.addEventListener('pipeline-update', updateSavedCount);
    window.addEventListener('discovered-update', updateDiscoveredCount);

    return () => {
      window.removeEventListener('storage', updateSavedCount);
      window.removeEventListener('pipeline-update', updateSavedCount);
      window.removeEventListener('discovered-update', updateDiscoveredCount);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsLogoutModalOpen(false);
  };

  return (
    <>
      <aside className="min-h-screen w-60 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Brand / Logo Area */}
        <div className="h-14 flex items-center mt-1 mb-6 px-4">
          <div className="flex items-center gap-2 text-slate-900">
            <div className="w-7 h-7 bg-[#1A1D21] rounded-lg flex items-center justify-center shadow-md shadow-[#1A1D21]/10 shrink-0">
              <SelecdooIcon size={14} className="text-[#D4E815]" />
            </div>
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
          
          {/* Upgrade Plan CTA for Free Trial Users */}
          {user?.plan === 'free_trial' && user?.trialEndDate && (
            <>
              {(() => {
                const daysRemaining = getTrialDaysRemaining(user.trialEndDate);
                const isUrgent = daysRemaining <= 2;
                const trialPlanName = user.trialPlan ? user.trialPlan.charAt(0).toUpperCase() + user.trialPlan.slice(1) : 'Pro';
                
                return (
                  <div className="bg-[#1A1D21] rounded-xl p-3.5 text-white relative overflow-hidden group cursor-pointer shadow-lg shadow-[#1A1D21]/20" onClick={() => setIsPricingModalOpen(true)}>
                    {/* Dot pattern background - matching landing page CTA */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={cn("p-1 rounded-md backdrop-blur-sm", isUrgent ? "bg-red-500/20" : "bg-[#D4E815]/20")}>
                          <Clock size={12} className={isUrgent ? "text-red-400" : "text-[#D4E815]"} />
                        </div>
                        <span className={cn("text-[10px] font-bold tracking-wide uppercase", isUrgent ? "text-red-400" : "text-white/90")}>
                          {daysRemaining === 0 ? 'Trial Ends Today!' : daysRemaining === 1 ? '1 Day Left' : `${daysRemaining} Days Left`}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1 leading-tight">
                        {trialPlanName} Plan Trial
                      </h4>
                      <p className="text-[10px] text-slate-300 leading-relaxed mb-3 opacity-90">
                        {isUrgent 
                          ? "Upgrade now to keep your data and continue growing." 
                          : "Enjoying the trial? Upgrade anytime to unlock full access."
                        }
                      </p>
                      <button className="w-full bg-[#D4E815] text-[#1A1D21] text-[10px] font-bold py-2 rounded-lg shadow-sm hover:bg-[#c5d913] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md">
                        Upgrade Now <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    {/* Decorative blur elements */}
                    <div className={cn("absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500", isUrgent ? "bg-red-500/10 group-hover:bg-red-500/20" : "bg-[#D4E815]/20 group-hover:bg-[#D4E815]/30")} />
                    <div className={cn("absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full blur-xl", isUrgent ? "bg-red-500/10" : "bg-[#D4E815]/10")} />
                  </div>
                );
              })()}
            </>
          )}

          {/* Divider - now below the trial indicator */}
          <div className="border-t border-slate-100"></div>

          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center w-full rounded-lg transition-all duration-200 hover:bg-slate-50 group p-2 gap-2.5"
            >
              <div className="relative shrink-0">
                 <img 
                  src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0f172a&color=fff`}
                  alt="User" 
                  className="w-7 h-7 rounded-full border border-white shadow-sm"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Jamie Founder'}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">{user?.plan?.replace('_', ' ') || 'Free Trial'}</p>
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
