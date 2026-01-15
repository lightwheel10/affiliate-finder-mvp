'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Login screen updated to match admin section design system.
// Polish pass (softer shadows + tighter type) - January 15th, 2026

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        setIsLoading(false);
        return;
      }

      // Redirect to admin dashboard on success
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-black bg-[#D4E815] mb-4 shadow-[3px_3px_0px_0px_#111827]">
            <Lock className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-black uppercase text-black">Admin Console</h1>
          <p className="text-sm text-black/60 mt-1 uppercase tracking-wide">CrewCast Studio</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border-4 border-black p-6 space-y-4 shadow-[3px_3px_0px_0px_#111827]">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 border-2 border-black bg-red-100 text-black text-sm font-bold uppercase">
                <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                {error}
              </div>
            )}

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase text-black/70 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black text-black text-sm placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black transition-all"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase text-black/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black text-black text-sm placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black transition-all"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#D4E815] border-2 border-black text-black font-bold uppercase text-sm hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          <p className="text-center text-xs text-black/60 uppercase tracking-wide">
            Protected admin area. Unauthorized access is prohibited.
          </p>
        </form>
      </div>
    </div>
  );
}
