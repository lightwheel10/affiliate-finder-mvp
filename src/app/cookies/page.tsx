'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Cookie, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-[#111827]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-7 h-7 rounded-lg shadow-lg shadow-[#1A1D21]/20 object-cover"
            />
            <span className="text-[#111827]">CrewCast Studio</span>
          </Link>
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#1A1D21] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#D4E815]/20 rounded-2xl mb-6">
            <Cookie size={32} className="text-[#1A1D21]" />
          </div>
          <h1 className="text-4xl font-bold text-[#111827] mb-4">Cookie Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: January 2025</p>
        </div>

        {/* Content Placeholder */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12">
          <div className="prose prose-slate max-w-none">
            <div className="bg-[#D4E815]/10 border border-[#D4E815]/30 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-[#1A1D21] mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-[#1A1D21] mb-1">Content Coming Soon</h3>
                  <p className="text-sm text-slate-600">
                    This Cookie Policy is currently being drafted by our legal team. 
                    The final version will explain how we use cookies and similar technologies.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#111827] mb-4">1. What Are Cookies?</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Explanation of cookies, how they work, and why websites use them will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">2. Types of Cookies We Use</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about essential cookies, analytics cookies, functional cookies, and marketing cookies will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">3. Essential Cookies</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about cookies necessary for the website to function properly will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">4. Analytics Cookies</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about cookies used to understand how visitors interact with our website will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">5. Third-Party Cookies</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about cookies set by third-party services like Stripe, analytics providers, etc. will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">6. Managing Cookies</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Instructions on how to control, disable, or delete cookies through browser settings will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">7. Contact Us</h2>
            <p className="text-slate-600 mb-6">
              If you have any questions about our Cookie Policy, please contact us at{' '}
              <a href="mailto:privacy@crewcaststudio.com" className="text-[#1A1D21] hover:text-[#D4E815] font-medium transition-colors">
                privacy@crewcaststudio.com
              </a>
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}

