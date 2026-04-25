'use client';

/**
 * =============================================================================
 * Cookie Policy Page — SMOOVER REFRESH (April 25, 2026)
 * =============================================================================
 *
 * History:
 *   Jan  8, 2026 — Original neo-brutalist version (border-4 black, 8px offset
 *                  shadows, font-black uppercase headings, yellow accent block).
 *   Jan 10, 2026 — i18n migration (every visible string keyed to
 *                  t.legalPages.cookies.* / t.legalPages.common.*).
 *   Apr 25, 2026 — Smoover refresh (this version).
 *
 * Smoover refresh — the four legal pages (cookies / privacy / security /
 * terms) share the same template; visual changes mirror across all four for
 * a consistent footer-linked legal surface.
 *
 *   Page bg:    bg-gray-100 -> bg-[#f6f9fc] (smoover soft bg).
 *   Header:     border-b-4 black -> hairline border-b. Brand link uses
 *               font-display semibold mixed-case (matches landing page).
 *               Logo gets a hairline border + rounded-md instead of square
 *               border-2 black. Back link drops uppercase + font-bold ->
 *               font-semibold.
 *   Title tile: bg-[#ffbf23] + border-4 black + 4px offset shadow ->
 *               bg-[#ffbf23] + rounded-2xl + shadow-yellow-glow-sm
 *               (matches landing hero icon).
 *   H1:         font-black uppercase tracking-wide -> font-display
 *               font-bold tracking-tight (matches landing hero).
 *   Content:    border-4 black + 8px offset shadow -> hairline + rounded-2xl
 *               + shadow-soft-xl (matches Modal.tsx shell).
 *   Callout:    bg-[#ffbf23]/20 + border-2 [#ffbf23] -> bg-[#fff4d1] +
 *               hairline [#ffbf23]/30 + rounded-xl (Sidebar nav-active tint).
 *   H2:         font-black uppercase -> font-display font-semibold
 *               tracking-tight.
 *   Body:       text-gray-600 -> text-[#425466]; text-gray-500 -> #8898aa.
 *   Email link: text-black font-bold -> text-[#0f172a] font-semibold.
 *
 * No content changes. All i18n keys preserved. Translation hook usage:
 * const { t } = useLanguage();
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Cookie, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CookiePolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f6f9fc] dark:bg-black font-sans text-[#0f172a] dark:text-white">
      {/* Header — smoover (Apr 25, 2026); see file docblock above. */}
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
        {/* Title section — smoover (Apr 25, 2026). */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ffbf23] rounded-2xl mb-6 shadow-yellow-glow-sm">
            <Cookie size={32} className="text-[#1A1D21]" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.title}</h1>
          <p className="text-[#8898aa] dark:text-gray-500 text-sm font-medium">{t.legalPages.common.lastUpdated} January 2025</p>
        </div>

        {/* Content card — smoover (Apr 25, 2026). */}
        <div className="bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-xl p-8 md:p-12">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {/* Coming-soon callout — smoover. */}
            <div className="bg-[#fff4d1] dark:bg-[#ffbf23]/10 border border-[#ffbf23]/30 dark:border-[#ffbf23]/40 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles size={20} className="text-[#0f172a] dark:text-[#ffbf23] mt-0.5 shrink-0" strokeWidth={2} />
                <div>
                  <h3 className="font-semibold text-[#0f172a] dark:text-white mb-1">{t.legalPages.common.contentComingSoon}</h3>
                  <p className="text-sm text-[#425466] dark:text-gray-400">
                    {t.legalPages.cookies.comingSoonMessage}
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.whatAreCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.whatAreCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.typesOfCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.typesOfCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.essentialCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.essentialCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.analyticsCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.analyticsCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.thirdPartyCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.thirdPartyCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.managingCookies}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.managingCookiesPlaceholder}
            </p>

            <h2 className="text-xl font-display font-semibold tracking-tight text-[#0f172a] dark:text-white mb-4">{t.legalPages.cookies.sections.contactUs}</h2>
            <p className="text-[#425466] dark:text-gray-400 mb-6">
              {t.legalPages.cookies.sections.contactUsText}{' '}
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
