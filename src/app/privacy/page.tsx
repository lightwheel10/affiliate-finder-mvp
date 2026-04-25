'use client';

/**
 * =============================================================================
 * Privacy Policy Page — SMOOVER REFRESH (April 25, 2026)
 * =============================================================================
 *
 * History:
 *   Jan  8, 2026 — Original neo-brutalist version.
 *   Jan 10, 2026 — i18n migration (t.legalPages.privacy.* / .common.*).
 *   Apr 25, 2026 — Smoover refresh (this version).
 *
 * Shares the same template as the other 3 legal pages (cookies / security /
 * terms). Full brutalist -> smoover visual mapping is documented in
 * src/app/cookies/page.tsx — mirror any future tweak across all four files
 * for a consistent footer-linked legal surface.
 *
 * No content changes. All i18n keys preserved. Translation hook usage:
 * const { t } = useLanguage();
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f6f9fc] dark:bg-black font-sans text-[#0f172a] dark:text-white">
      {/* Header — smoover (Apr 25, 2026); see cookies/page.tsx for full mapping. */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt="Afforce One"
              className="w-8 h-8 rounded-md border border-[#e6ebf1] dark:border-gray-700"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-[#0f172a] dark:text-white">Afforce One</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-[#425466] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {t.legalPages.common.backToHome}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title section — smoover. */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ffbf23] rounded-2xl mb-6 shadow-yellow-glow-sm">
            <Shield size={32} className="text-[#1A1D21]" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.title}</h1>
          <p className="text-[#8898aa] dark:text-gray-500 text-sm font-medium">{t.legalPages.common.lastUpdated} January 2025</p>
        </div>

        {/* Content card — smoover. */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-xl p-8 md:p-12">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {/* Coming-soon callout — smoover. */}
            <div className="bg-[#fff4d1] dark:bg-[#ffbf23]/10 border border-[#ffbf23]/30 dark:border-[#ffbf23]/40 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-[#0f172a] dark:text-[#ffbf23] mt-0.5 shrink-0" strokeWidth={2} />
                <div>
                  <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.common.contentComingSoon}</h3>
                  <p className="text-sm text-[#425466] dark:text-gray-400">
                    {t.legalPages.privacy.comingSoonMessage}
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.informationWeCollect}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.informationWeCollectPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.howWeUseInfo}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.howWeUseInfoPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.dataSharing}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.dataSharingPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.dataSecurity}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.dataSecurityPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.yourRights}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.yourRightsPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.privacy.sections.contactUs}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.privacy.sections.contactUsText}{' '}
              <a href="mailto:privacy@afforceone.com" className="text-[#0f172a] dark:text-white font-semibold hover:text-[#ffbf23] transition-colors">
                privacy@afforceone.com
              </a>
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
