'use client';

/**
 * =============================================================================
 * Security Page — SMOOVER REFRESH (April 25, 2026)
 * =============================================================================
 *
 * History:
 *   Jan  8, 2026 — Original neo-brutalist version.
 *   Jan 10, 2026 — i18n migration (t.legalPages.security.* / .common.*).
 *   Apr 25, 2026 — Smoover refresh (this version).
 *
 * Same shared legal-page template as cookies / privacy / terms — full
 * brutalist -> smoover visual mapping is documented in cookies/page.tsx.
 *
 * Security-specific extra: 4 "highlights" cards above the main content
 * (compliance / encryption / infrastructure / GDPR). Migration for those:
 *   Card chrome: border-2 border-black + 4px offset shadow ->
 *                hairline border-[#e6ebf1] + rounded-xl + shadow-soft-sm.
 *   Icon tile:   w-10 h-10 bg-black + border-2 (square dark tile with
 *                yellow icon) -> w-10 h-10 bg-[#0f172a] + rounded-md +
 *                shadow-soft-sm (kept dark for the security/premium
 *                semantic; only the geometry softens).
 *   Title h3:    font-black uppercase -> font-semibold mixed-case.
 *
 * No content changes. All i18n keys preserved.
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Sparkles, ShieldCheck, Server, Key, Eye } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SecurityPage() {
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
            <Lock size={32} className="text-[#1A1D21]" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.title}</h1>
          <p className="text-[#8898aa] dark:text-gray-500 text-sm font-medium">{t.legalPages.security.subtitle}</p>
        </div>

        {/* Security highlights — smoover (Apr 25, 2026). 4 cards. */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl p-6 flex items-start gap-4 shadow-soft-sm">
            <div className="w-10 h-10 bg-[#0f172a] rounded-md flex items-center justify-center shrink-0 shadow-soft-sm">
              <ShieldCheck size={20} className="text-[#ffbf23]" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.security.highlights.soc2Title}</h3>
              <p className="text-sm text-[#8898aa] dark:text-gray-500">{t.legalPages.security.highlights.soc2Description}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl p-6 flex items-start gap-4 shadow-soft-sm">
            <div className="w-10 h-10 bg-[#0f172a] rounded-md flex items-center justify-center shrink-0 shadow-soft-sm">
              <Key size={20} className="text-[#ffbf23]" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.security.highlights.encryptionTitle}</h3>
              <p className="text-sm text-[#8898aa] dark:text-gray-500">{t.legalPages.security.highlights.encryptionDescription}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl p-6 flex items-start gap-4 shadow-soft-sm">
            <div className="w-10 h-10 bg-[#0f172a] rounded-md flex items-center justify-center shrink-0 shadow-soft-sm">
              <Server size={20} className="text-[#ffbf23]" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.security.highlights.infrastructureTitle}</h3>
              <p className="text-sm text-[#8898aa] dark:text-gray-500">{t.legalPages.security.highlights.infrastructureDescription}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-xl p-6 flex items-start gap-4 shadow-soft-sm">
            <div className="w-10 h-10 bg-[#0f172a] rounded-md flex items-center justify-center shrink-0 shadow-soft-sm">
              <Eye size={20} className="text-[#ffbf23]" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.security.highlights.gdprTitle}</h3>
              <p className="text-sm text-[#8898aa] dark:text-gray-500">{t.legalPages.security.highlights.gdprDescription}</p>
            </div>
          </div>
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
                    {t.legalPages.security.comingSoonMessage}
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.dataProtection}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.dataProtectionPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.authentication}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.authenticationPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.paymentSecurity}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.paymentSecurityPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.infrastructureSecurity}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.infrastructureSecurityPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.vulnerabilityManagement}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.vulnerabilityManagementPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.security.sections.reportVulnerability}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.security.sections.reportVulnerabilityText}{' '}
              <a href="mailto:security@afforceone.com" className="text-[#0f172a] dark:text-white font-semibold hover:text-[#ffbf23] transition-colors">
                security@afforceone.com
              </a>
            </p>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
