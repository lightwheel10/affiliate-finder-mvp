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
  Sparkles,
  Command,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import { PricingModal } from './PricingModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSavedAffiliates, getDiscoveredAffiliates } from '../services/storage';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
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
      <aside 
        className={cn(
          "min-h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 ease-in-out will-change-[width]",
          isCollapsed ? "w-[52px]" : "w-60"
        )}
      >
        {/* Collapse Toggle Button */}
        <button 
          onClick={toggleCollapse}
          className={cn(
            "absolute top-6 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm z-50 transition-all hover:scale-110",
            isCollapsed ? "-right-2.5" : "-right-2.5"
          )}
        >
          {isCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>

        {/* Brand / Logo Area */}
        <div className={cn("h-14 flex items-center mt-1 mb-6 transition-all duration-300", isCollapsed ? "px-0 justify-center" : "px-4")}>
          <div className="flex items-center gap-2 text-slate-900">
            <div className="w-7 h-7 bg-[#1A1D21] rounded-lg flex items-center justify-center shadow-md shadow-[#1A1D21]/10 shrink-0">
              <Sparkles size={14} fill="currentColor" className="text-[#D4E815] opacity-90" />
            </div>
            <div className={cn("flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
              <span className="font-bold text-sm tracking-tight leading-none">Affiliate<span className="text-[#1A1D21]">Finder</span></span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Intelligence</span>
            </div>
          </div>
        </div>


        {/* Main Navigation */}
        <nav className={cn("flex-1 space-y-6 overflow-y-auto py-1 transition-all duration-300", isCollapsed ? "px-1.5" : "px-3")}>
          <div>
            <p className={cn("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-0.5 transition-all duration-300 whitespace-nowrap overflow-hidden", isCollapsed ? "opacity-0 h-0" : "px-2 h-auto opacity-100")}>Discovery</p>
            <div className="space-y-0.5">
              <NavItem 
                href="/" 
                icon={<Search size={14} />} 
                label="Find New" 
                active={pathname === '/'} 
                isCollapsed={isCollapsed} 
              />
              <NavItem 
                href="/discovered"
                icon={<LayoutDashboard size={14} />} 
                label="All Discovered" 
                badge={discoveredCount > 0 ? discoveredCount.toString() : undefined}
                active={pathname === '/discovered'}
                isCollapsed={isCollapsed} 
              />
            </div>
          </div>

          <div>
            <p className={cn("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-0.5 transition-all duration-300 whitespace-nowrap overflow-hidden", isCollapsed ? "opacity-0 h-0" : "px-2 h-auto opacity-100")}>Management</p>
            <div className="space-y-0.5">
              <NavItem 
                href="/saved"
                icon={<Briefcase size={14} />} 
                label="Saved Affiliates" 
                badge={pipelineCount > 0 ? pipelineCount.toString() : undefined}
                active={pathname === '/saved'}
                isCollapsed={isCollapsed} 
              />
              <NavItem icon={<Users size={14} />} label="Outreach" isCollapsed={isCollapsed} />
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className={cn("border-t border-slate-100 space-y-0.5 bg-white/50 transition-all duration-300", isCollapsed ? "p-1.5" : "p-3")}>
          
          {/* Upgrade Plan CTA for Free Trial Users */}
          {(!user?.plan || user?.plan === 'free_trial') && (
            <div className={cn("mb-3 transition-all duration-300", isCollapsed ? "hidden" : "block")}>
              <div className="bg-[#1A1D21] rounded-xl p-3.5 text-white relative overflow-hidden group cursor-pointer shadow-lg shadow-[#1A1D21]/20" onClick={() => setIsPricingModalOpen(true)}>
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="p-1 bg-[#D4E815]/20 rounded-md backdrop-blur-sm">
                      <Zap size={12} className="text-[#D4E815]" fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase">Trial Ending Soon</span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 leading-tight">Unlock Full Access</h4>
                  <p className="text-[10px] text-slate-300 leading-relaxed mb-3 opacity-90">
                    Don't lose your saved affiliates. Upgrade now to keep growing.
                  </p>
                  <button className="w-full bg-[#D4E815] text-[#1A1D21] text-[10px] font-bold py-2 rounded-lg shadow-sm hover:bg-[#c5d913] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-md">
                    View Plans <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-[#D4E815]/10 rounded-full blur-2xl group-hover:bg-[#D4E815]/20 transition-all duration-500" />
                <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 bg-[#D4E815]/10 rounded-full blur-xl" />
              </div>
            </div>
          )}

          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={cn(
                "flex items-center w-full rounded-lg transition-all duration-200 hover:bg-slate-50 group", 
                isCollapsed ? "justify-center p-1" : "p-2 gap-2.5"
              )}
            >
              <div className="relative shrink-0">
                 <img 
                  src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0f172a&color=fff`}
                  alt="User" 
                  className="w-7 h-7 rounded-full border border-white shadow-sm"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              
              <div className={cn("flex-1 text-left min-w-0 transition-all duration-300 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Jamie Founder'}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">{user?.plan?.replace('_', ' ') || 'Free Trial'}</p>
              </div>

              {!isCollapsed && (
                <MoreHorizontal size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0 ml-1" />
              )}
            </button>

            {/* Dropdown Menu */}
            {isProfileMenuOpen && (
              <>
                {/* Backdrop to close menu on click outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileMenuOpen(false)} 
                />
                <div className={cn(
                  "absolute bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2",
                  isCollapsed ? "left-full ml-2 bottom-0 mb-0" : "left-0 w-full"
                )}>
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
  isCollapsed?: boolean;
  onClick?: () => void;
  href?: string;
}

const NavItem = ({ icon, label, active, badge, isCollapsed, onClick, href }: NavItemProps) => {
  const content = (
    <>
      <span className={cn("transition-colors shrink-0", active ? "text-[#1A1D21]" : "group-hover:text-slate-700")}>
        {icon}
      </span>
      <span 
        className={cn(
          "text-left transition-all duration-300 overflow-hidden whitespace-nowrap",
          isCollapsed ? "w-0 opacity-0 duration-100" : "flex-1 w-auto opacity-100 delay-100"
        )}
      >
        {label}
      </span>
      {badge && !isCollapsed && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[9px] font-bold min-w-[20px] text-center transition-opacity duration-300",
          active ? "bg-[#D4E815]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
        )}>
          {badge}
        </span>
      )}
      {badge && isCollapsed && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#D4E815] rounded-full ring-1 ring-white" />
      )}
    </>
  );

  const className = cn(
    "w-full flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 group relative",
    active 
      ? "bg-[#D4E815]/10 text-[#1A1D21]" 
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
    isCollapsed ? "justify-center px-0 py-2" : "justify-start px-2.5 py-1.5 gap-2.5"
  );

  if (href) {
    return (
      <Link href={href} className={className} title={isCollapsed ? label : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={className}
      title={isCollapsed ? label : undefined}
    >
      {content}
    </button>
  );
};
