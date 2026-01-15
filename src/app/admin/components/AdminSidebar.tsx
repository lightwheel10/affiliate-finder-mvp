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

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Sidebar updated to use bold borders, high contrast, and brand accents.
// Polish pass (tighter type + consistent shadows) - January 15th, 2026

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
    <aside className="w-56 h-screen bg-white border-r-4 border-black flex flex-col fixed left-0 top-0 z-50">
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b-4 border-black">
        <div className="flex items-center gap-3">
          <div className="p-2 border-2 border-black bg-[#D4E815]">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-sm font-black text-black uppercase">Admin Console</h1>
            <p className="text-[10px] text-black/60 uppercase tracking-wide">CrewCast Studio</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-3 px-3">
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
                'flex items-center gap-3 px-3 py-2.5 border-2 border-transparent text-[12px] font-bold uppercase tracking-wide transition-all',
                isActive
                  ? 'bg-[#D4E815] text-black border-black shadow-[2px_2px_0px_0px_#111827]'
                  : 'text-black/70 hover:bg-black hover:text-white hover:border-black'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t-4 border-black">
        {/* Quick Stats */}
        <div className="mb-3 p-3 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#111827]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-black" />
            <span className="text-[10px] font-black text-black/70 uppercase">Quick Stats</span>
          </div>
          <p className="text-xs text-black/60">
            View platform analytics and user metrics
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-all disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
