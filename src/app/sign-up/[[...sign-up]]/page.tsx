/**
 * =============================================================================
 * SIGN UP PAGE - REDIRECT TO SIGN-IN WITH MODE
 * =============================================================================
 * 
 * Created: January 9th, 2026 (Original Stack Auth version)
 * Updated: January 19th, 2026 - Migrated to Supabase Magic Link
 * Updated: January 19th, 2026 - Pass mode=signup to show correct messaging
 * 
 * WHAT CHANGED (January 19th, 2026):
 * ----------------------------------
 * With Magic Link authentication, sign-up and sign-in are the SAME flow:
 * 1. User enters email
 * 2. Gets magic link
 * 3. Clicks link
 * 4. If new user → Supabase creates account automatically
 * 5. If existing user → Signs them in
 * 
 * So we redirect /sign-up to /sign-in?mode=signup.
 * The mode=signup parameter tells the sign-in page to show:
 * - "Start Your Free Trial" instead of "Welcome Back"
 * - Different subtitle messaging for new users
 * 
 * This page exists to:
 * - Handle "Start free trial" clicks from landing page
 * - Handle any old links or bookmarks to /sign-up
 * 
 * =============================================================================
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();

  // January 19th, 2026: Redirect to sign-in with mode=signup
  // This tells the sign-in page to show new user messaging
  useEffect(() => {
    router.replace('/sign-in?mode=signup');
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
      <div className="w-8 h-8 border-2 border-[#ffbf23] border-t-transparent animate-spin"></div>
    </div>
  );
}
