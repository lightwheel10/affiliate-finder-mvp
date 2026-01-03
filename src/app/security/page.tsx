'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Sparkles, ShieldCheck, Server, Key, Eye } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function SecurityPage() {
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
            <Lock size={32} className="text-[#1A1D21]" />
          </div>
          <h1 className="text-4xl font-bold text-[#111827] mb-4">Security</h1>
          <p className="text-slate-500 text-sm">How we protect your data</p>
        </div>

        {/* Security Highlights */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-[#1A1D21] rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-[#D4E815]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">SOC 2 Compliant</h3>
              <p className="text-sm text-slate-500">Enterprise-grade security standards</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-[#1A1D21] rounded-lg flex items-center justify-center shrink-0">
              <Key size={20} className="text-[#D4E815]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">End-to-End Encryption</h3>
              <p className="text-sm text-slate-500">All data encrypted in transit and at rest</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-[#1A1D21] rounded-lg flex items-center justify-center shrink-0">
              <Server size={20} className="text-[#D4E815]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">Secure Infrastructure</h3>
              <p className="text-sm text-slate-500">Hosted on Vercel & Neon with 99.9% uptime</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-[#1A1D21] rounded-lg flex items-center justify-center shrink-0">
              <Eye size={20} className="text-[#D4E815]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">GDPR Compliant</h3>
              <p className="text-sm text-slate-500">Full compliance with EU data protection</p>
            </div>
          </div>
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
                    Our comprehensive security documentation is currently being prepared. 
                    It will detail our security practices, certifications, and data protection measures.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#111827] mb-4">1. Data Protection</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about encryption standards, data storage practices, and access controls will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">2. Authentication & Access</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about secure authentication, session management, and role-based access will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">3. Payment Security</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about PCI DSS compliance, Stripe integration, and how we handle payment data will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">4. Infrastructure Security</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Information about our hosting providers, network security, and monitoring systems will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">5. Vulnerability Management</h2>
            <p className="text-slate-600 mb-6">
              [Placeholder: Details about security testing, bug bounty programs, and incident response will be added here.]
            </p>

            <h2 className="text-xl font-bold text-[#111827] mb-4">6. Report a Vulnerability</h2>
            <p className="text-slate-600 mb-6">
              If you discover a security vulnerability, please report it responsibly to{' '}
              <a href="mailto:security@crewcaststudio.com" className="text-[#1A1D21] hover:text-[#D4E815] font-medium transition-colors">
                security@crewcaststudio.com
              </a>
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}

