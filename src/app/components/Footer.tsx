/**
 * =============================================================================
 * Footer Component — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Updated: April 23rd, 2026
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened per landing refresh brief.
 *   Was: border-t-4 black top border, uppercase font-black headings, hard
 *   black bordered logo tile, square status dot. Now: hairline #e6ebf1
 *   divider, Archivo section headings (mixed case, semibold), rounded-lg
 *   logo tile, rounded-full status dot with soft yellow glow. Softer #425466
 *   body text and #8898aa copyright line.
 *
 * - January 9th, 2026: i18n migration — all copy now goes through
 *   useLanguage(). See LANGUAGE_MIGRATION.md for details.
 * - January 9th, 2026: Neo-brutalist pass (superseded).
 *
 * =============================================================================
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export const Footer = () => {
  const { t } = useLanguage();

  return (
    // April 23rd, 2026: Soft top border + off-white fill in light mode.
    <footer className="bg-[#f6f9fc] dark:bg-[#0a0a0a] border-t border-[#e6ebf1] dark:border-gray-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Section — Archivo wordmark + gradient "One" (April 23rd, 2026) */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 font-display font-bold text-lg text-[#0f172a] dark:text-white mb-4">
              <img
                src="/logo.svg"
                alt="Afforce One"
                className="w-7 h-7 rounded-lg border border-[#e6ebf1] dark:border-gray-700 bg-white dark:bg-[#111] p-0.5"
              />
              <span>Afforce<span className="text-gradient-brand font-semibold">One</span></span>
            </Link>
            <p className="text-[#425466] dark:text-gray-400 text-xs leading-relaxed max-w-xs">
              {t.landing.footer.brandDescription}
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-display font-semibold text-[#0f172a] dark:text-white text-sm mb-4">{t.landing.footer.product}</h4>
            <ul className="space-y-2.5 text-xs text-[#425466] dark:text-gray-400">
              <li><a href="#features" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.nav.features}</a></li>
              <li><a href="#pricing" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.nav.pricing}</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-display font-semibold text-[#0f172a] dark:text-white text-sm mb-4">{t.landing.footer.legal}</h4>
            <ul className="space-y-2.5 text-xs text-[#425466] dark:text-gray-400">
              <li><Link href="/privacy" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.landing.footer.privacyPolicy}</Link></li>
              <li><Link href="/terms" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.landing.footer.termsOfService}</Link></li>
              <li><Link href="/cookies" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.landing.footer.cookiePolicy}</Link></li>
              <li><Link href="/security" className="hover:text-[#0f172a] dark:hover:text-white transition-colors font-medium">{t.landing.footer.security}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar — soft (April 23rd, 2026) */}
        <div className="pt-8 border-t border-[#e6ebf1] dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <p className="text-[10px] text-[#8898aa] dark:text-gray-500 font-medium">{t.landing.footer.copyright}</p>
             <span className="hidden md:block text-[10px] text-[#e6ebf1] dark:text-gray-700">•</span>
             <a href="https://www.spectrumailabs.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#8898aa] dark:text-gray-500 hover:text-[#ffbf23] transition-colors font-medium">{t.landing.footer.madeBy}</a>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#425466] dark:text-gray-400 font-semibold">
            <div className="w-2 h-2 rounded-full bg-[#ffbf23] shadow-[0_0_0_3px_rgba(255,191,35,0.18)]"></div>
            {t.landing.footer.systemStatus}
          </div>
        </div>
      </div>
    </footer>
  );
};
