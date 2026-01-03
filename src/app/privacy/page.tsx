'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function PrivacyPolicyPage() {
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
            <Shield size={32} className="text-[#1A1D21]" />
          </div>
          <h1 className="text-4xl font-bold text-[#111827] mb-4">Privacy Policy</h1>
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
                    This privacy policy is currently being drafted by our legal team. 
                    The final version will detail how we collect, use, and protect your personal information.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#111827] mb-4">1. Information We Collect</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about personal information, usage data, cookies, and third-party integrations will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">2. How We Use Your Information</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about how we use collected data for service provision, improvement, and communication will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">3. Data Sharing and Disclosure</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about third-party services, legal requirements, and business transfers will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">4. Data Security</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about our security measures, encryption, and data protection practices will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">5. Your Rights</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about GDPR rights, data access, deletion requests, and opt-out options will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">6. Contact Us</h2>
            <p className="text-slate-600 mb-6">
              If you have any questions about this Privacy Policy, please contact us at{' '}
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

