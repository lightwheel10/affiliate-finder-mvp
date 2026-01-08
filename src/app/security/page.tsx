'use client';

/**
 * =============================================================================
 * Security Page - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Sparkles, ShieldCheck, Server, Key, Eye } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black font-sans text-gray-900 dark:text-white">
      {/* Header - NEO-BRUTALIST */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0a] border-b-4 border-black dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-lg tracking-tight uppercase">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-8 h-8 border-2 border-black dark:border-gray-600 object-cover"
            />
            <span className="text-gray-900 dark:text-white">CrewCast Studio</span>
          </Link>
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors uppercase"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content - NEO-BRUTALIST */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ffbf23] border-4 border-black mb-6 shadow-[4px_4px_0px_0px_#000000]">
            <Lock size={32} className="text-black" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Security</h1>
          <p className="text-gray-500 text-sm font-medium">How we protect your data</p>
        </div>

        {/* Security Highlights - NEO-BRUTALIST */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 p-6 flex items-start gap-4 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333]">
            <div className="w-10 h-10 bg-black flex items-center justify-center shrink-0 border-2 border-black">
              <ShieldCheck size={20} className="text-[#ffbf23]" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 dark:text-white mb-1 uppercase">SOC 2 Compliant</h3>
              <p className="text-sm text-gray-500">Enterprise-grade security standards</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 p-6 flex items-start gap-4 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333]">
            <div className="w-10 h-10 bg-black flex items-center justify-center shrink-0 border-2 border-black">
              <Key size={20} className="text-[#ffbf23]" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 dark:text-white mb-1 uppercase">End-to-End Encryption</h3>
              <p className="text-sm text-gray-500">All data encrypted in transit and at rest</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 p-6 flex items-start gap-4 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333]">
            <div className="w-10 h-10 bg-black flex items-center justify-center shrink-0 border-2 border-black">
              <Server size={20} className="text-[#ffbf23]" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 dark:text-white mb-1 uppercase">Secure Infrastructure</h3>
              <p className="text-sm text-gray-500">Hosted on Vercel & Neon with 99.9% uptime</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 p-6 flex items-start gap-4 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333]">
            <div className="w-10 h-10 bg-black flex items-center justify-center shrink-0 border-2 border-black">
              <Eye size={20} className="text-[#ffbf23]" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 dark:text-white mb-1 uppercase">GDPR Compliant</h3>
              <p className="text-sm text-gray-500">Full compliance with EU data protection</p>
            </div>
          </div>
        </div>

        {/* Content - NEO-BRUTALIST */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_#000000] dark:shadow-[8px_8px_0px_0px_#333333] p-8 md:p-12">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="bg-[#ffbf23]/20 border-2 border-[#ffbf23] p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-black dark:text-white mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-black text-black dark:text-white mb-1 uppercase">Content Coming Soon</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Our comprehensive security documentation is currently being prepared. 
                    It will detail our security practices, certifications, and data protection measures.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">1. Data Protection</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              [Placeholder: Details about encryption standards, data storage practices, and access controls will be added here.]
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">2. Authentication & Access</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              [Placeholder: Information about secure authentication, session management, and role-based access will be added here.]
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">3. Payment Security</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              [Placeholder: Details about PCI DSS compliance, Stripe integration, and how we handle payment data will be added here.]
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">4. Infrastructure Security</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              [Placeholder: Information about our hosting providers, network security, and monitoring systems will be added here.]
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">5. Vulnerability Management</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              [Placeholder: Details about security testing, bug bounty programs, and incident response will be added here.]
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">6. Report a Vulnerability</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              If you discover a security vulnerability, please report it responsibly to{' '}
              <a href="mailto:security@crewcaststudio.com" className="text-black dark:text-white font-bold hover:text-[#ffbf23] transition-colors">
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
