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
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setIsLoading(true);
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
        <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400">
          <Clock className="w-3 h-3" />
          Trial
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'trialing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400">
            <Clock className="w-3 h-3" />
            Trial
          </span>
        );
      case 'canceled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400">
            <XCircle className="w-3 h-3" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-500/10 text-slate-400">
            <AlertCircle className="w-3 h-3" />
            No Sub
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#23272B] rounded-lg" />
          <div className="h-12 bg-[#23272B] rounded-lg" />
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-[#23272B] rounded-lg" />
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
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400 mt-1">
            {filteredUsers.length} of {users.length} users
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton endpoint="/api/admin/users" filename="users" />
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#23272B] border border-[#2E3338] rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50 focus:border-[#D4E815] transition-all"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-[#23272B] border border-[#2E3338] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trial</option>
          <option value="canceled">Canceled</option>
          <option value="none">No Subscription</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#23272B] rounded-xl border border-[#2E3338] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2E3338]">
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                User
              </th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                Plan
              </th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                Credits Used
              </th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
                Monthly Cost
              </th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
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
                className="border-b border-[#2E3338] last:border-0 hover:bg-[#2E3338]/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#D4E815]/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#D4E815]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {user.name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium',
                    user.plan === 'business' ? 'bg-purple-500/10 text-purple-400' :
                    user.plan === 'pro' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-500/10 text-slate-400'
                  )}>
                    {user.plan?.charAt(0).toUpperCase() + user.plan?.slice(1) || 'Free'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(user.subscription_status, user.is_trial_period)}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm">
                    <span className="text-white">{user.topic_search_credits_used || 0}</span>
                    <span className="text-slate-500"> / {user.topic_search_credits_total || 0}</span>
                    <span className="text-xs text-slate-500 ml-1">searches</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-medium text-[#D4E815]">
                    ${user.monthly_cost?.toFixed(2) || '0.00'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm text-slate-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
