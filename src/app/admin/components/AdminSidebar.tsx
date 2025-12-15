'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  LogOut,
  Shield,
  TrendingUp,
  Activity,
  Settings,
  PiggyBank
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'Costs',
    href: '/admin/costs',
    icon: DollarSign,
  },
  {
    label: 'Revenue',
    href: '/admin/revenue',
    icon: PiggyBank,
  },
  {
    label: 'API Health',
    href: '/admin/health',
    icon: Activity,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="w-56 h-screen bg-[#1A1D21] border-r border-[#2E3338] flex flex-col fixed left-0 top-0 z-50">
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b border-[#2E3338]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#D4E815]/10">
            <Shield className="w-5 h-5 text-[#D4E815]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Admin Console</h1>
            <p className="text-[10px] text-slate-500">CrewCast Studio</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">
          Analytics
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-[#D4E815]/10 text-[#D4E815]'
                  : 'text-slate-400 hover:bg-[#23272B] hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#2E3338]">
        {/* Quick Stats */}
        <div className="mb-3 p-3 rounded-lg bg-[#23272B]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#D4E815]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Stats</span>
          </div>
          <p className="text-xs text-slate-500">
            View platform analytics and user metrics
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
