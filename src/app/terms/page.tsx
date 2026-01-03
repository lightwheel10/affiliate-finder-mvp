'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function TermsOfServicePage() {
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
            <FileText size={32} className="text-[#1A1D21]" />
          </div>
          <h1 className="text-4xl font-bold text-[#111827] mb-4">Terms of Service</h1>
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
                    These Terms of Service are currently being drafted by our legal team. 
                    The final version will detail the rules and guidelines for using CrewCast Studio.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#111827] mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about agreement to terms, eligibility requirements, and account responsibilities will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">2. Description of Service</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about the CrewCast Studio platform, features, and service availability will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">3. User Accounts</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about account creation, security, and user responsibilities will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">4. Payment and Billing</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about subscription plans, pricing, refunds, and payment processing will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">5. Acceptable Use</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Guidelines for proper use of the platform, prohibited activities, and content restrictions will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">6. Intellectual Property</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about ownership rights, licenses, and intellectual property protections will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">7. Limitation of Liability</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about liability limitations, disclaimers, and indemnification will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">8. Contact Us</h2>
            <p className="text-slate-600 mb-6">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@crewcaststudio.com" className="text-[#1A1D21] hover:text-[#D4E815] font-medium transition-colors">
                legal@crewcaststudio.com
              </a>
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}

