'use client';

/**
 * =============================================================================
 * Terms of Service Page - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * i18n Migration: January 10th, 2026 - Priority 6: Static Pages
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * 
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TermsOfServicePage() {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();

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
            {t.legalPages.common.backToHome}
          </Link>
        </div>
      </header>

      {/* Main Content - NEO-BRUTALIST */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ffbf23] border-4 border-black mb-6 shadow-[4px_4px_0px_0px_#000000]">
            <FileText size={32} className="text-black" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wide">{t.legalPages.terms.title}</h1>
          <p className="text-gray-500 text-sm font-medium">{t.legalPages.common.lastUpdated} January 2025</p>
        </div>

        {/* Content - NEO-BRUTALIST */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_#000000] dark:shadow-[8px_8px_0px_0px_#333333] p-8 md:p-12">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="bg-[#ffbf23]/20 border-2 border-[#ffbf23] p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-black dark:text-white mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-black text-black dark:text-white mb-1 uppercase">{t.legalPages.common.contentComingSoon}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t.legalPages.terms.comingSoonMessage}
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.acceptanceOfTerms}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.acceptanceOfTermsPlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.descriptionOfService}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.descriptionOfServicePlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.userAccounts}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.userAccountsPlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.paymentAndBilling}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.paymentAndBillingPlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.acceptableUse}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.acceptableUsePlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.intellectualProperty}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.intellectualPropertyPlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.limitationOfLiability}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.limitationOfLiabilityPlaceholder}
            </p>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase">{t.legalPages.terms.sections.contactUs}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.legalPages.terms.sections.contactUsText}{' '}
              <a href="mailto:legal@crewcaststudio.com" className="text-black dark:text-white font-bold hover:text-[#ffbf23] transition-colors">
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
