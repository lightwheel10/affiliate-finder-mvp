/**
 * =============================================================================
 * SIGN IN PAGE - MAGIC LINK + OTP (Supabase Auth)
 * =============================================================================
 * 
 * Created: January 9th, 2026 (Original Stack Auth version)
 * Updated: January 19th, 2026 - Migrated to Supabase Magic Link
 * Updated: January 19th, 2026 - Performance fix: Show form immediately
 * Updated: January 19th, 2026 - Dynamic messaging based on mode (signin/signup)
 * Updated: January 21st, 2026 - Added i18n translations (EN/DE support)
 * Updated: January 22nd, 2026 - Added OTP (6-digit code) input option
 * Updated: April 23rd, 2026  - "SMOOVER" visual refresh (Phase 2a)
 *
 * APRIL 23RD, 2026 - VISUAL REFRESH (Phase 2a):
 * ---------------------------------------------
 * Client expanded Phase 1 (landing page only) to include the entire app.
 * This page was restyled to match the refreshed landing page:
 * - Hairline borders (#e6ebf1) replace the 2px/4px black brutalist borders
 * - Soft drop shadows replace the offset neo-brutalist shadows
 * - Inputs and buttons are now rounded (xl / full) instead of sharp
 * - CTA uses the yellow-glow shadow treatment from the landing navbar
 * - Logo wordmark uses font-display + text-gradient-brand for "One"
 *
 * IMPORTANT: Zero logic / i18n / a11y / Supabase calls were modified in
 * this pass. State machine, background auth check, OTP verify, redirect
 * logic, and all translation keys are untouched.
 *
 * OTP ADDITION (January 22nd, 2026):
 * ----------------------------------
 * Client requested OTP code input as an alternative to clicking the magic link.
 * Users coming from "revenuworks terminal" prefer typing a code.
 * 
 * HOW IT WORKS:
 * - Supabase's signInWithOtp() sends an email containing BOTH:
 *   1. A clickable magic link (existing flow)
 *   2. A 6-digit OTP code (new flow)
 * - User can either click the link OR enter the code
 * - Both methods create the same valid session
 * 
 * FLOW WITH OTP:
 * 1. User enters email, clicks "Send Magic Link"
 * 2. Email is sent (contains both link AND code)
 * 3. User sees success screen with "Enter Code" option
 * 4. User enters 6-digit code
 * 5. We call verifyOtp() to validate
 * 6. Session is created, user redirected to home
 * 
 * WHY THIS IS SAFE:
 * - We're NOT changing how emails are sent
 * - We're NOT changing the magic link callback
 * - We're just adding a UI to enter the code that's already in the email
 * - Both flows use the same Supabase session system
 * 
 * i18n TRANSLATIONS (January 21st, 2026):
 * ---------------------------------------
 * Added multi-language support per client request.
 * All UI text now comes from translation files:
 * - src/dictionaries/en.ts (English)
 * - src/dictionaries/de.ts (German)
 * 
 * Uses the useLanguage() hook from LanguageContext.
 * Language is auto-detected from browser or can be changed via language toggle.
 * 
 * DYNAMIC MESSAGING (January 19th, 2026):
 * ---------------------------------------
 * This page handles both sign-in and sign-up with Magic Link.
 * The flow is identical, but the messaging should be different:
 * 
 * - /sign-in (no mode) → Uses t.auth.signIn translations (returning user)
 * - /sign-in?mode=signup → Uses t.auth.signUp translations (new user)
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
 * 3. Supabase sends an email with a magic link + OTP code
 * 4. User clicks the link → redirected to /auth/callback
 *    OR User enters OTP code → verifyOtp() called directly
 * 5. Session is created → user is logged in
 * 
 * =============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, Loader2, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// FORM STATES - January 22nd, 2026: Added 'verifying' for OTP
// =============================================================================
type FormState = 'idle' | 'sending' | 'sent' | 'verifying' | 'error';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();
  
  // ===========================================================================
  // i18n TRANSLATIONS - January 21st, 2026
  // ===========================================================================
  const { t } = useLanguage();
  
  // ===========================================================================
  // STATE - January 19th, 2026
  // Updated: January 22nd, 2026 - Added OTP state
  // ===========================================================================
  // Form state
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // ===========================================================================
  // OTP STATE - January 22nd, 2026
  // ===========================================================================
  // 6-digit code entered by user
  const [otpCode, setOtpCode] = useState('');
  // Whether to show OTP input (after magic link sent)
  const [showOtpInput, setShowOtpInput] = useState(false);
  
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
  // Updated: January 21st, 2026 - Use translated error messages
  // ===========================================================================
  // If the auth callback failed, it redirects here with ?error=...
  // We show a user-friendly error message (now translated)
  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam) {
      // Map error codes to translated messages (January 21st, 2026)
      const errorMessages: Record<string, string> = {
        'auth_failed': t.auth.signIn.authFailed,
        'config': t.auth.signIn.configError,
        'invalid_token': t.auth.signIn.invalidToken,
        'access_denied': t.auth.signIn.accessDenied,
      };
      
      setErrorMessage(errorMessages[errorParam] || t.auth.signIn.genericError);
      setFormState('error');
      
      // Clean up the URL (remove error param) without triggering navigation
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, t]);

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
      router.replace('/');
      return;
    }
    
    // Validate email (January 21st, 2026: Use translated error)
    if (!email || !email.includes('@')) {
      setErrorMessage(t.auth.signIn.invalidEmail);
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
        setErrorMessage(error.message || t.auth.signIn.genericError);
        setFormState('error');
        return;
      }

      // Success! Show confirmation message
      setFormState('sent');
      
    } catch (err) {
      console.error('[Sign In] Unexpected error:', err);
      setErrorMessage(t.auth.signIn.genericError);
      setFormState('error');
    }
  };

  // ===========================================================================
  // HANDLE OTP VERIFICATION - January 22nd, 2026
  // ===========================================================================
  // When user enters the 6-digit code from their email, verify it with Supabase.
  // This creates a session directly without needing the callback route.
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate OTP format (6 digits)
    if (!otpCode || otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setErrorMessage(t.auth.signIn.invalidOtp || 'Please enter a valid 6-digit code');
      setFormState('error');
      return;
    }

    setFormState('verifying');
    setErrorMessage('');

    try {
      // Verify the OTP code with Supabase
      // This exchanges the code for a session (same as clicking the magic link)
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode,
        type: 'email', // Type for email OTP verification
      });

      if (error) {
        console.error('[Sign In] OTP verification error:', error);
        // Handle specific error cases
        if (error.message?.includes('expired')) {
          setErrorMessage(t.auth.signIn.otpExpired || 'Code expired. Please request a new one.');
        } else if (error.message?.includes('invalid')) {
          setErrorMessage(t.auth.signIn.otpInvalid || 'Invalid code. Please check and try again.');
        } else {
          setErrorMessage(error.message || t.auth.signIn.genericError);
        }
        setFormState('error');
        return;
      }

      // Success! Session is automatically set by Supabase
      if (data.session) {
        // The auth state listener will detect the new session and redirect
        // But we can also redirect immediately
        router.replace('/');
      }
      
    } catch (err) {
      console.error('[Sign In] OTP verification unexpected error:', err);
      setErrorMessage(t.auth.signIn.genericError);
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
  // January 21st, 2026: Use translated redirect message
  if (isAuthenticated && isRedirectingRef.current) {
    // "SMOOVER" refresh (April 23rd, 2026): softer spinner ring + muted copy.
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfd] dark:bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#ffbf23]/30 border-t-[#ffbf23] animate-spin mb-4"></div>
          <p className="text-sm text-[#425466] dark:text-gray-400">
            {t.auth.signIn.alreadySignedIn}
          </p>
        </div>
      </div>
    );
  }

  return (
    // "SMOOVER" refresh (April 23rd, 2026):
    // Page canvas is brand off-white with a subtle grid texture — mirrors the
    // landing hero section so the transition from landing → auth feels seamless.
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfd] dark:bg-[#0a0a0a] bg-grid-soft dark:bg-grid-soft-dark px-4 py-10">
      {/* ================================================================= */}
      {/* HEADER WITH LOGO                                                   */}
      {/* April 23rd, 2026: Rounded-full back-link pill + gradient wordmark. */}
      {/* ================================================================= */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-white/70 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} />
            {t.auth.signIn.backToHome}
          </Link>

          {/* Logo — matches landing navbar (rounded tile + font-display + gradient accent) */}
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Afforce One" className="w-5 h-5 rounded-md border border-[#e6ebf1] dark:border-gray-700" />
            <span className="font-display font-bold text-sm tracking-tight text-[#0f172a] dark:text-white">
              Afforce <span className="text-gradient-brand">One</span>
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAGIC LINK FORM — "SMOOVER" card (April 23rd, 2026)                */}
      {/* Was: border-4 black + 8px offset brutalist shadow.                 */}
      {/* Now: rounded-2xl hairline border + soft drop shadow (shadow-soft-xl). */}
      {/* ================================================================= */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl p-8 shadow-soft-xl">

          {/* ============================================================= */}
          {/* Form Header — font-display + softer body copy.                */}
          {/* January 21st, 2026: Uses translated strings (unchanged).      */}
          {/* ============================================================= */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-[#0f172a] dark:text-white mb-2">
              {isSignupMode ? t.auth.signUp.title : t.auth.signIn.title}
            </h1>
            <p className="text-sm text-[#425466] dark:text-gray-400">
              {isSignupMode
                ? t.auth.signUp.subtitle
                : t.auth.signIn.subtitle
              }
            </p>
          </div>

          {/* ============================================================= */}
          {/* SUCCESS STATE - Magic link sent (January 19th, 2026) */}
          {/* January 21st, 2026: Now using translated strings */}
          {/* January 22nd, 2026: Added OTP input option */}
          {/* ============================================================= */}
          {formState === 'sent' || formState === 'verifying' || (formState === 'error' && showOtpInput) ? (
            <div className="text-center py-4">
              {/* Success check circle — April 23rd, 2026: rounded-full + yellow glow. */}
              <div className="w-16 h-16 mx-auto mb-4 bg-[#ffbf23] rounded-full flex items-center justify-center shadow-yellow-glow">
                <CheckCircle size={32} className="text-[#0f172a]" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#0f172a] dark:text-white mb-2">
                {t.auth.signIn.checkEmail}
              </h2>
              <p className="text-sm text-[#425466] dark:text-gray-400 mb-4">
                {t.auth.signIn.magicLinkSent}<br />
                <span className="font-semibold text-[#0f172a] dark:text-white">{email}</span>
              </p>

              {/* ========================================================= */}
              {/* OTP INPUT SECTION (January 22nd, 2026 — logic unchanged). */}
              {/* April 23rd, 2026: soft visual refresh only.               */}
              {/* ========================================================= */}
              {!showOtpInput ? (
                <>
                  <p className="text-xs text-[#8898aa] dark:text-gray-500">
                    {isSignupMode
                      ? t.auth.signUp.clickToCreate
                      : t.auth.signIn.clickToSignIn
                    }
                    <br />
                    {t.auth.signIn.checkSpam}
                  </p>

                  {/* Divider — hairline dividers (April 23rd, 2026). */}
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[#e6ebf1] dark:bg-gray-800"></div>
                    <span className="text-xs font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-wider">{t.common.or}</span>
                    <div className="flex-1 h-px bg-[#e6ebf1] dark:bg-gray-800"></div>
                  </div>

                  {/* Secondary CTA — rounded-full hairline outlined pill. */}
                  <button
                    onClick={() => setShowOtpInput(true)}
                    className="w-full py-3 px-4 bg-white dark:bg-[#1a1a1a] text-[#0f172a] dark:text-white font-semibold rounded-full border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm hover:border-[#ffbf23]/40 hover:shadow-soft-md hover:-translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound size={18} />
                    {t.auth.signIn.enterCode || 'Enter Code Instead'}
                  </button>
                </>
              ) : (
                /* OTP Input Form — rounded inputs + soft focus ring (April 23rd, 2026). */
                <form onSubmit={handleOtpVerify} className="space-y-4 text-left">
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-sm font-semibold text-[#0f172a] dark:text-white mb-2"
                    >
                      {t.auth.signIn.otpLabel || '6-Digit Code'}
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setOtpCode(value);
                        if (formState === 'error') setFormState('sent');
                      }}
                      placeholder="123456"
                      className="w-full px-4 py-3 bg-[#f6f9fc] dark:bg-[#1a1a1a] border border-[#e6ebf1] dark:border-gray-700 rounded-xl text-[#0f172a] dark:text-white placeholder-[#8898aa] focus:outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 focus:bg-white dark:focus:bg-[#1a1a1a] transition-all font-mono text-2xl text-center tracking-[0.5em]"
                      disabled={formState === 'verifying'}
                      autoComplete="one-time-code"
                      autoFocus
                    />

                    {/* Error message — soft red, no bold shout. */}
                    {formState === 'error' && errorMessage && (
                      <div className="mt-2 flex items-start gap-2 text-sm font-medium text-red-500">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Primary CTA — rounded-full yellow with soft yellow glow. */}
                  <button
                    type="submit"
                    disabled={formState === 'verifying' || otpCode.length !== 6}
                    className="w-full py-3 px-4 bg-[#ffbf23] text-[#0f172a] font-bold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-px hover:shadow-yellow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-yellow-glow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {formState === 'verifying' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {t.auth.signIn.verifying || 'Verifying...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        {t.auth.signIn.verifyCode || 'Verify Code'}
                      </>
                    )}
                  </button>

                  {/* Back-to-magic-link — subtle text link. */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpInput(false);
                      setOtpCode('');
                      setFormState('sent');
                      setErrorMessage('');
                    }}
                    className="w-full text-sm font-semibold text-[#8898aa] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {t.auth.signIn.backToMagicLink || '← Back to magic link'}
                  </button>
                </form>
              )}

              {/* "Use different email" — still visible when not in OTP mode. */}
              {!showOtpInput && (
                <button
                  onClick={() => {
                    setFormState('idle');
                    setEmail('');
                    setOtpCode('');
                    setShowOtpInput(false);
                  }}
                  className="mt-6 text-sm font-semibold text-[#ffbf23] hover:text-[#e5ac20] hover:underline transition-colors cursor-pointer"
                >
                  {t.auth.signIn.useDifferentEmail}
                </button>
              )}
            </div>
          ) : (
            /* ============================================================= */
            /* EMAIL INPUT FORM                                                */
            /* April 23rd, 2026: rounded inputs, soft focus ring, pill CTA.   */
            /* (Logic + i18n unchanged.)                                       */
            /* ============================================================= */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-[#0f172a] dark:text-white mb-2"
                >
                  {t.auth.signIn.emailLabel}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8898aa]"
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formState === 'error') setFormState('idle');
                    }}
                    placeholder={t.auth.signIn.emailPlaceholder}
                    className="w-full pl-10 pr-4 py-3 bg-[#f6f9fc] dark:bg-[#1a1a1a] border border-[#e6ebf1] dark:border-gray-700 rounded-xl text-[#0f172a] dark:text-white placeholder-[#8898aa] focus:outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 focus:bg-white dark:focus:bg-[#1a1a1a] transition-all font-medium"
                    disabled={formState === 'sending'}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {/* Error message — soft red (April 23rd, 2026). */}
                {formState === 'error' && errorMessage && (
                  <div className="mt-2 flex items-start gap-2 text-sm font-medium text-red-500">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Primary CTA — rounded-full yellow with soft yellow glow. */}
              <button
                type="submit"
                disabled={formState === 'sending' || !email}
                className="w-full py-3 px-4 bg-[#ffbf23] text-[#0f172a] font-bold rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-px hover:shadow-yellow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-yellow-glow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {formState === 'sending' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t.auth.signIn.sending}
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    {t.auth.signIn.sendMagicLink}
                  </>
                )}
              </button>
            </form>
          )}

          {/* ============================================================= */}
          {/* FOOTER INFO — April 23rd, 2026: hairline divider.              */}
          {/* ============================================================= */}
          <div className="mt-8 pt-6 border-t border-[#e6ebf1] dark:border-gray-800">
            <p className="text-xs text-center text-[#8898aa] dark:text-gray-500 leading-relaxed">
              {isSignupMode ? (
                <>
                  {t.auth.signUp.noPasswordNeeded}
                  <br />
                  {t.auth.signUp.alreadyHaveAccount}{' '}
                  <a href="/sign-in" className="text-[#ffbf23] hover:text-[#e5ac20] font-semibold transition-colors">{t.auth.signUp.signIn}</a>
                </>
              ) : (
                <>
                  {t.auth.signIn.noPasswordNeeded}
                  <br />
                  {t.auth.signIn.newHere}{' '}
                  <a href="/sign-up" className="text-[#ffbf23] hover:text-[#e5ac20] font-semibold transition-colors">{t.auth.signIn.startTrial}</a>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* LEGAL LINKS — softer palette (April 23rd, 2026).                   */}
      {/* ================================================================= */}
      <div className="mt-8 flex gap-6 text-xs text-[#8898aa] dark:text-gray-500">
        <Link href="/privacy" className="hover:text-[#0f172a] dark:hover:text-white transition-colors">
          {t.auth.signIn.privacyPolicy}
        </Link>
        <Link href="/terms" className="hover:text-[#0f172a] dark:hover:text-white transition-colors">
          {t.auth.signIn.termsOfService}
        </Link>
      </div>
    </div>
  );
}
