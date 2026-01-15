'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExportButton } from '../components/ExportButton';
import { AdminSelect } from '../components/AdminSelect';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Users page updated for high-contrast layout and bold borders.
// Polish pass (table striping + calmer hover) - January 15th, 2026

interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  created_at: string;
  is_onboarded: boolean;
  subscription_status: string | null;
  trial_ends_at: string | null;
  topic_search_credits_total: number | null;
  topic_search_credits_used: number | null;
  email_credits_total: number | null;
  email_credits_used: number | null;
  monthly_cost: number;
  monthly_calls: number;
  is_trial_period: boolean | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Refresh animation (Admin) - January 15th, 2026
  const fetchUsers = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/users');
      
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users || []);
      setFilteredUsers(data.users || []);
      setError('');
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search and status
  useEffect(() => {
    let result = users;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.email?.toLowerCase().includes(query) ||
          u.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((u) => {
        if (statusFilter === 'trialing') return u.subscription_status === 'trialing';
        if (statusFilter === 'active') return u.subscription_status === 'active';
        if (statusFilter === 'canceled') return u.subscription_status === 'canceled';
        if (statusFilter === 'none') return !u.subscription_status;
        return true;
      });
    }

    setFilteredUsers(result);
  }, [users, searchQuery, statusFilter]);

  const getStatusBadge = (status: string | null, isTrialPeriod: boolean | null) => {
    if (isTrialPeriod) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-[#D4E815] text-black">
          <Clock className="w-3 h-3 text-black" />
          Trial
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-green-200 text-black">
            <CheckCircle className="w-3 h-3 text-black" />
            Active
          </span>
        );
      case 'trialing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-[#D4E815] text-black">
            <Clock className="w-3 h-3 text-black" />
            Trial
          </span>
        );
      case 'canceled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-red-200 text-black">
            <XCircle className="w-3 h-3 text-black" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase bg-white text-black">
            <AlertCircle className="w-3 h-3 text-black" />
            No Sub
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-black/10 border-2 border-black" />
          <div className="h-12 bg-black/10 border-2 border-black" />
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-black/10 border-2 border-black" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase text-black">Users</h1>
          <p className="text-sm text-black/70 mt-1">
            {filteredUsers.length} of {users.length} users
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton endpoint="/api/admin/users" filename="users" />
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        {/* Status Filter */}
        {/* Standard admin dropdown styling (matches main app pattern) - Jan 15, 2026 */}
        <AdminSelect
          ariaLabel="User status filter"
          value={statusFilter}
          onChange={setStatusFilter}
          className="min-w-[180px]"
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'trialing', label: 'Trial' },
            { value: 'canceled', label: 'Canceled' },
            { value: 'none', label: 'No Subscription' },
          ]}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border-4 border-black text-black text-sm font-bold uppercase shadow-[4px_4px_0px_0px_#111827]">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border-4 border-black overflow-hidden shadow-[3px_3px_0px_0px_#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b-4 border-black bg-black/5">
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                User
              </th>
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                Plan
              </th>
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                Credits Used
              </th>
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                Monthly Cost
              </th>
              <th className="text-left text-xs font-black text-black uppercase tracking-wider px-4 py-3">
                Joined
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                onClick={() => router.push(`/admin/users/${user.id}`)}
                className="border-b-2 border-black last:border-0 odd:bg-black/5 hover:bg-[#D4E815]/60 cursor-pointer transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-2 border-black bg-[#D4E815] flex items-center justify-center">
                      <Users className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-black">
                        {user.name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-black/60">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'px-2 py-1 border-2 border-black text-xs font-bold uppercase text-black',
                    user.plan === 'business' ? 'bg-purple-200' :
                    user.plan === 'pro' ? 'bg-blue-200' :
                    'bg-white'
                  )}>
                    {user.plan?.charAt(0).toUpperCase() + user.plan?.slice(1) || 'Free'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(user.subscription_status, user.is_trial_period)}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm">
                    <span className="text-black font-bold">{user.topic_search_credits_used || 0}</span>
                    <span className="text-black/60"> / {user.topic_search_credits_total || 0}</span>
                    <span className="text-xs text-black/60 ml-1">searches</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-bold text-black">
                    ${user.monthly_cost?.toFixed(2) || '0.00'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm text-black/60">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ChevronRight className="w-4 h-4 text-black" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-black/60 font-bold uppercase">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
