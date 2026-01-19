/**
 * =============================================================================
 * SIGN IN PAGE - MAGIC LINK (Supabase Auth)
 * =============================================================================
 * 
 * Created: January 9th, 2026 (Original Stack Auth version)
 * Updated: January 19th, 2026 - Migrated to Supabase Magic Link
 * Updated: January 19th, 2026 - Performance fix: Show form immediately
 * Updated: January 19th, 2026 - Dynamic messaging based on mode (signin/signup)
 * 
 * DYNAMIC MESSAGING (January 19th, 2026):
 * ---------------------------------------
 * This page handles both sign-in and sign-up with Magic Link.
 * The flow is identical, but the messaging should be different:
 * 
 * - /sign-in (no mode) → "Welcome Back" (returning user)
 * - /sign-in?mode=signup → "Start Your Free Trial" (new user)
 * 
 * The ?mode=signup param is added by /sign-up redirect.
 * 
 * WHAT CHANGED (January 19th, 2026 - Performance Fix):
 * ----------------------------------------------------
 * PROBLEM: The sign-in page showed a loading spinner for 500ms-2s while
 * checking if the user was already authenticated. This was unnecessary
 * because the sign-in page contains no sensitive data.
 * 
 * SOLUTION: Show the form immediately, check auth in the background.
 * If user is already authenticated, redirect them to home.
 * 
 * SECURITY ANALYSIS:
 * ------------------
 * Q: Is it safe to show the form before checking auth?
 * A: YES - The sign-in page contains only:
 *    - An email input field (not sensitive)
 *    - A "Send Magic Link" button
 *    - No user data, no secrets, nothing to protect
 * 
 * The actual security happens:
 *    1. Server-side when Supabase validates the magic link token
 *    2. In middleware protecting authenticated routes
 *    3. In API routes that verify sessions
 * 
 * EDGE CASES HANDLED:
 * -------------------
 * 1. User is authenticated → Background check detects this, redirect to home
 * 2. User submits form while auth check pending → Check auth before submit
 * 3. Error from callback (e.g., invalid token) → Show error message
 * 4. User logs in on another tab → Auth listener detects, redirects
 * 5. Session expires while on page → Fine, they're already here to sign in
 * 
 * HOW MAGIC LINK WORKS:
 * ---------------------
 * 1. User enters their email address
 * 2. We call supabase.auth.signInWithOtp({ email })
 * 3. Supabase sends an email with a magic link
 * 4. User clicks the link → redirected to /auth/callback
 * 5. Callback exchanges code for session → user is logged in
 * 
 * =============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// =============================================================================
// MAGIC LINK FORM STATES
// =============================================================================
type FormState = 'idle' | 'sending' | 'sent' | 'error';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();
  
  // ===========================================================================
  // STATE - January 19th, 2026
  // ===========================================================================
  // Form state
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // ===========================================================================
  // MODE DETECTION - January 19th, 2026
  // ===========================================================================
  // Check if user came from "Start free trial" (/sign-up → /sign-in?mode=signup)
  // This determines the messaging shown on the page
  const isSignupMode = searchParams?.get('mode') === 'signup';
  
  // Auth check state (runs in background, doesn't block form render)
  // We track this separately to avoid showing a loading spinner
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Ref to track if we've already started redirecting (prevent double redirect)
  const isRedirectingRef = useRef(false);

  // ===========================================================================
  // EDGE CASE 3: Handle error from callback - January 19th, 2026
  // ===========================================================================
  // If the auth callback failed, it redirects here with ?error=...
  // We show a user-friendly error message
  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        'auth_failed': 'Authentication failed. Please try again.',
        'config': 'Configuration error. Please contact support.',
        'invalid_token': 'The magic link has expired. Please request a new one.',
        'access_denied': 'Access denied. Please try again.',
      };
      
      setErrorMessage(errorMessages[errorParam] || 'Something went wrong. Please try again.');
      setFormState('error');
      
      // Clean up the URL (remove error param) without triggering navigation
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  // ===========================================================================
  // BACKGROUND AUTH CHECK - January 19th, 2026
  // ===========================================================================
  // Check if user is already authenticated WITHOUT blocking the form render.
  // This runs in the background while the form is already visible.
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          if (session?.user) {
            setIsAuthenticated(true);
            // User is already logged in, redirect to home
            // AuthGuard will handle onboarding check
            if (!isRedirectingRef.current) {
              isRedirectingRef.current = true;
              console.log('[Sign In] User already authenticated, redirecting to home');
              router.replace('/');
            }
          }
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error('[Sign In] Error checking auth:', err);
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };
    
    checkAuth();
    
    // ===========================================================================
    // EDGE CASE 4: Listen for auth changes (e.g., login on another tab)
    // January 19th, 2026
    // ===========================================================================
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user && isMounted) {
          setIsAuthenticated(true);
          if (!isRedirectingRef.current) {
            isRedirectingRef.current = true;
            console.log('[Sign In] Auth state changed to SIGNED_IN, redirecting');
            router.replace('/');
          }
        }
      }
    );
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // ===========================================================================
  // HANDLE MAGIC LINK SUBMISSION - January 19th, 2026
  // ===========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ===========================================================================
    // EDGE CASE 2: Check if user became authenticated while typing
    // January 19th, 2026
    // ===========================================================================
    // This can happen if:
    // - User has the page open, logs in on another tab
    // - Auth state listener hasn't redirected yet
    // - User quickly submits the form
    if (isAuthenticated) {
      console.log('[Sign In] User is authenticated, skipping form submission');
      router.replace('/');
      return;
    }
    
    // Validate email
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      setFormState('error');
      return;
    }

    setFormState('sending');
    setErrorMessage('');

    try {
      // Send magic link via Supabase
      // The redirectTo URL must be in the allowed list in Supabase Dashboard
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Redirect to our callback route after clicking the magic link
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('[Sign In] Error sending magic link:', error);
        setErrorMessage(error.message || 'Failed to send magic link');
        setFormState('error');
        return;
      }

      // Success! Show confirmation message
      setFormState('sent');
      console.log('[Sign In] Magic link sent to:', email);
      
    } catch (err) {
      console.error('[Sign In] Unexpected error:', err);
      setErrorMessage('Something went wrong. Please try again.');
      setFormState('error');
    }
  };

  // ===========================================================================
  // RENDER - January 19th, 2026
  // ===========================================================================
  // IMPORTANT: We render the form IMMEDIATELY without waiting for auth check.
  // If user is authenticated, the background check will redirect them.
  // This provides instant perceived performance.
  
  // Only show a minimal redirect indicator if we KNOW user is authenticated
  // and we're actively redirecting (not during initial check)
  if (isAuthenticated && isRedirectingRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#ffbf23] border-t-transparent animate-spin mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already signed in, redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4">
      {/* ================================================================= */}
      {/* HEADER WITH LOGO - NEO-BRUTALIST */}
      {/* ================================================================= */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-700 px-3 py-1.5"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          
          {/* Logo - NEO-BRUTALIST */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">
              CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span>
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAGIC LINK FORM - NEO-BRUTALIST */}
      {/* ================================================================= */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 p-8 shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#333]">
          
          {/* ============================================================= */}
          {/* Form Header - Dynamic based on mode (January 19th, 2026) */}
          {/* /sign-in → "Welcome Back" (returning user) */}
          {/* /sign-in?mode=signup → "Start Your Free Trial" (new user) */}
          {/* ============================================================= */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
              {isSignupMode ? 'Start Your Free Trial' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isSignupMode 
                ? 'Enter your email to get started — no credit card required'
                : 'Enter your email to receive a magic link'
              }
            </p>
          </div>

          {/* ============================================================= */}
          {/* SUCCESS STATE - Magic link sent (January 19th, 2026) */}
          {/* Message varies based on signup vs signin mode */}
          {/* ============================================================= */}
          {formState === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#ffbf23] border-4 border-black flex items-center justify-center">
                <CheckCircle size={32} className="text-black" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                We sent a magic link to<br />
                <span className="font-bold text-gray-900 dark:text-white">{email}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {isSignupMode 
                  ? 'Click the link in the email to create your account.'
                  : 'Click the link in the email to sign in.'
                }
                <br />
                Don&apos;t see it? Check your spam folder.
              </p>
              
              {/* Send again button */}
              <button
                onClick={() => {
                  setFormState('idle');
                  setEmail('');
                }}
                className="mt-6 text-sm font-bold text-[#ffbf23] hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* ============================================================= */
            /* EMAIL INPUT FORM */
            /* ============================================================= */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input - NEO-BRUTALIST */}
              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-bold text-gray-900 dark:text-white mb-2"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formState === 'error') setFormState('idle');
                    }}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1a1a1a] border-2 border-black dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#ffbf23] transition-colors font-medium"
                    disabled={formState === 'sending'}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                
                {/* ========================================================= */}
                {/* Error Message - January 19th, 2026 */}
                {/* Enhanced to show callback errors with icon */}
                {/* ========================================================= */}
                {formState === 'error' && errorMessage && (
                  <div className="mt-2 flex items-start gap-2 text-sm font-bold text-red-500">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Submit Button - NEO-BRUTALIST */}
              <button
                type="submit"
                disabled={formState === 'sending' || !email}
                className="w-full py-3 px-4 bg-[#ffbf23] text-black font-black uppercase tracking-wide border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {formState === 'sending' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    Send Magic Link
                  </>
                )}
              </button>
            </form>
          )}

          {/* ============================================================= */}
          {/* FOOTER INFO - Dynamic based on mode (January 19th, 2026) */}
          {/* ============================================================= */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-500">
              {isSignupMode ? (
                <>
                  No password needed! We&apos;ll send you a secure link to get started.
                  <br />
                  Already have an account? <a href="/sign-in" className="text-[#ffbf23] hover:underline font-bold">Sign in</a>
                </>
              ) : (
                <>
                  No password needed! We&apos;ll send you a secure link to sign in.
                  <br />
                  New here? <a href="/sign-up" className="text-[#ffbf23] hover:underline font-bold">Start your free trial</a>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* LEGAL LINKS */}
      {/* ================================================================= */}
      <div className="mt-8 flex gap-4 text-xs text-gray-500 dark:text-gray-500">
        <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
