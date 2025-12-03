'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, Loader2, Lock, Mail, User, CheckCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthView = 'signin' | 'signup' | 'forgot-password';

interface LoginScreenProps {
  onBackToHome?: () => void;
  initialView?: AuthView;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onBackToHome, initialView = 'signin' }) => {
  const { login } = useAuth();
  const [view, setView] = useState<AuthView>(initialView);
  
  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic Validation
    if (view === 'signin' && (!email || !password)) {
      setError('Please enter both email and password');
      return;
    }
    if (view === 'signup' && (!name || !email || !password)) {
      setError('Please complete all fields');
      return;
    }
    if (view === 'forgot-password' && !email) {
      setError('Please enter your email address');
      return;
    }

    setIsSubmitting(true);

    try {
      if (view === 'forgot-password') {
        // Mock Password Reset
        await new Promise(resolve => setTimeout(resolve, 1500));
        setResetSent(true);
      } else {
        // Login or Signup (Mock Auto-login)
        // Pass name if we have it (signup mode), otherwise undefined (login mode)
        await login(email, name || undefined);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form state when switching views
  const switchView = (newView: AuthView) => {
    setView(newView);
    setError('');
    setResetSent(false);
    // Keep email filled if already typed
    if (newView === 'forgot-password' && email) {
      // keep email
    } else {
      // optional: clear password/name if needed
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FDFDFD] relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#D4E815]/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#D4E815]/5 blur-3xl" />
      </div>

      <div className="w-full max-w-[400px] px-6 relative z-10">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-xl rounded-2xl p-6 md:p-8">
          {/* Back to Home Button */}
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#1A1D21] transition-colors mb-4 group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </button>
          )}

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 bg-[#1A1D21] rounded-xl flex items-center justify-center shadow-lg shadow-[#1A1D21]/20">
              <Sparkles size={20} fill="currentColor" className="text-[#D4E815]" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-900 mb-1.5">
              {view === 'signin' && 'Welcome Back'}
              {view === 'signup' && 'Create Account'}
              {view === 'forgot-password' && 'Reset Password'}
            </h1>
            <p className="text-slate-500 text-xs">
              {view === 'signin' && 'Enter your credentials to access your workspace'}
              {view === 'signup' && 'Start your 14-day free trial today'}
              {view === 'forgot-password' && !resetSent && 'Enter your email to receive a reset link'}
              {view === 'forgot-password' && resetSent && 'Check your email for the reset link'}
            </p>
          </div>

          {view === 'forgot-password' && resetSent ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-[#D4E815]/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-[#1A1D21]" />
                </div>
              </div>
              <button
                onClick={() => switchView('signin')}
                className="text-sm text-slate-600 font-semibold hover:text-[#D4E815] transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {view === 'signup' && (
                <div className="space-y-1.5 animate-in slide-in-from-left-2 duration-300">
                  <label className="text-xs font-semibold text-slate-700 ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1A1D21] transition-colors" size={16} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-2 focus:ring-[#D4E815]/20 transition-all"
                      placeholder="Jamie Founder"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1A1D21] transition-colors" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-2 focus:ring-[#D4E815]/20 transition-all"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              {view !== 'forgot-password' && (
                <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 ml-1">Password</label>
                    {view === 'signin' && (
                      <button 
                        type="button"
                        onClick={() => switchView('forgot-password')}
                        className="text-[11px] font-medium text-[#1A1D21] hover:text-[#D4E815] transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1A1D21] transition-colors" size={16} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D4E815] focus:ring-2 focus:ring-[#D4E815]/20 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-500 text-xs bg-red-50 p-2 rounded-lg border border-red-100 text-center animate-in fade-in zoom-in-95 duration-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full mt-6 bg-[#1A1D21] hover:bg-[#D4E815] text-white hover:text-[#1A1D21] font-semibold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:shadow-[#D4E815]/30",
                  isSubmitting && "opacity-80 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {view === 'signin' && 'Sign In'}
                    {view === 'signup' && 'Create Account'}
                    {view === 'forgot-password' && 'Send Reset Link'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center space-y-4">
            {view === 'signin' && (
              <p className="text-xs text-slate-500">
                Don't have an account?{' '}
                <button 
                  onClick={() => switchView('signup')}
                  className="text-[#1A1D21] font-semibold hover:text-[#D4E815] transition-colors"
                >
                  Sign up
                </button>
              </p>
            )}

            {view === 'signup' && (
              <p className="text-xs text-slate-500">
                Already have an account?{' '}
                <button 
                  onClick={() => switchView('signin')}
                  className="text-[#1A1D21] font-semibold hover:text-[#D4E815] transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}

            {view === 'forgot-password' && !resetSent && (
              <button 
                onClick={() => switchView('signin')}
                className="text-xs text-slate-500 font-medium hover:text-slate-800 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                Back to Sign In
              </button>
            )}

            {view !== 'forgot-password' && (
              <p className="text-[10px] text-slate-400">
                By continuing, you agree to our{' '}
                <a href="#" className="text-slate-500 hover:text-slate-700 underline decoration-slate-200 hover:decoration-slate-400 transition-all">Terms of Service</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
