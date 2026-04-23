'use client';

/**
 * =============================================================================
 * LANDING PAGE — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Last Updated: April 23rd, 2026
 *
 * CHANGELOG:
 * - April 23rd, 2026: Client-requested visual refresh (David / RevenueWorks).
 *   Brief: "add this design to afforce, i just made it a little nicer and
 *   smoover and not so hard" — referencing the newer revenueworks.ai site.
 *
 *   Approach: retain the brand yellow (#ffbf23) punch and the overall section
 *   structure / copy / animations / i18n wiring, but soften the visual
 *   language — rounded corners, soft drop shadows, refined Archivo display
 *   font for headlines, signature yellow→amber gradient for emphasis words,
 *   off-white (#f6f9fc) alternating section backgrounds, and #e6ebf1 soft
 *   dividers in place of bold black borders.
 *
 *   NOTHING logic-side was changed: props, state, translation keys, framer
 *   animations, and dark-mode wiring are all preserved.
 *
 *   Design tokens live in src/app/globals.css (look for "SMOOVER" section).
 *   Fonts are loaded in src/app/layout.tsx.
 *
 * - January 9th, 2026: Neo-brutalist pass (superseded April 23rd, 2026).
 *   Sharp edges, font-black uppercase, offset shadows, #ffbf23 accents.
 *
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight, 
  Search, 
  Mail, 
  BarChart3, 
  CheckCircle2, 
  Zap, 
  Globe, 
  Users, 
  TrendingUp,
  Menu,
  X,
  ChevronRight,
  Star,
  Target,
  Radar
} from 'lucide-react';
import { LogoMarquee } from './LogoMarquee';
import { InteractiveSearchDemo } from './InteractiveSearchDemo';
import { BentoGrid, BentoCard } from './BentoGrid';
import { DiscoveryGraphic } from './DiscoveryGraphic';
import { VerifiedEmailGraphic } from './VerifiedEmailGraphic';
import { PipelineGraphic } from './PipelineGraphic';
import { Footer } from '../Footer';
// =============================================================================
// LANGUAGE SWITCHER (January 9th, 2026)
// Added i18n support for landing page - see LANGUAGE_MIGRATION.md
// =============================================================================
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // =============================================================================
  // i18n TRANSLATIONS (January 9th, 2026)
  // All UI strings are now translated - see LANGUAGE_MIGRATION.md
  // =============================================================================
  const { t } = useLanguage();

  // Parallax scroll tracking
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, -150]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    // April 23rd, 2026: Root page container — softened palette.
    // Light: warm near-white #fdfdfd (matches revenueworks.ai body bg).
    // Dark: kept at #0a0a0a to stay consistent with existing dark mode.
    // Body text defaults to #425466 (soft slate) instead of near-black.
    <div className="min-h-screen bg-[#fdfdfd] dark:bg-[#0a0a0a] font-sans text-[#425466] dark:text-gray-200 selection:bg-[#ffbf23]/30 selection:text-[#1A1D21] overflow-x-hidden">

      {/* Background Texture — softened grid (April 23rd, 2026).
          Was `bg-grid-pattern` (radial dots, slate-gray). Now a subtle 40x40
          crosshatch at 4% black, identical to revenueworks.ai. */}
      <div className="fixed inset-0 pointer-events-none bg-grid-soft dark:bg-grid-soft-dark opacity-60" />

      {/* ==========================================================================
          NAVBAR — "SMOOVER" (April 23rd, 2026)
          Was: neo-brutalist (border-2 black, sharp edges, offset shadow CTA).
          Now: soft pill for nav links, soft hairline border on scroll, rounded
          logo tile, gradient-ready Archivo wordmark, rounded primary CTA with
          a subtle yellow glow instead of an offset black shadow.
          ========================================================================== */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-[#e6ebf1] dark:border-gray-800 shadow-[0_1px_2px_0_rgba(16,24,40,0.04)] py-2.5'
            : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo — Archivo wordmark with gradient on "One" (April 23rd, 2026).
              Logo tile is now rounded-lg with a soft border instead of hard black. */}
          <div className="flex items-center gap-2.5 font-display font-bold text-lg tracking-tight z-50">
            <img
              src="/logo.svg"
              alt="Afforce One"
              className="w-7 h-7 rounded-lg border border-[#e6ebf1] dark:border-gray-700 bg-white dark:bg-[#111] p-0.5"
            />
            <span className="text-[#0f172a] dark:text-white">
              Afforce<span className="text-gradient-brand font-semibold">One</span>
            </span>
          </div>

          {/* Desktop Links — soft pill (April 23rd, 2026).
              Was: sharp border-2. Now: rounded-full, hairline #e6ebf1 border,
              hover uses a soft yellow wash (bg-[#ffbf23]/15). */}
          <div className="hidden md:flex items-center gap-0.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md px-1.5 py-1 rounded-full border border-[#e6ebf1] dark:border-gray-800 shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]">
            {[
              { label: t.nav.features, href: '#features' },
              { label: t.nav.howItWorks, href: '#how-it-works' },
              { label: t.nav.pricing, href: '#pricing' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.querySelector(item.href);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="px-3.5 py-1.5 text-sm font-semibold text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white rounded-full hover:bg-[#ffbf23]/15 transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Auth Buttons — softened (April 23rd, 2026).
              Login: rounded borderless text-button.
              Primary CTA: rounded-full yellow button with soft yellow glow
              shadow (replaces the neo-brutalist offset black shadow). */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher (January 9th, 2026) */}
            <LanguageSwitcher variant="navbar" />
            {/* Theme Switcher (January 22nd, 2026) */}
            <ThemeSwitcher variant="navbar" />
            <button
              onClick={onLoginClick}
              className="text-sm font-semibold text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white px-3 py-2 rounded-full transition-colors cursor-pointer"
            >
              {t.nav.login}
            </button>
            <button
              onClick={onSignupClick}
              className="px-4 py-2 bg-[#ffbf23] text-[#0f172a] text-xs font-bold tracking-wide uppercase rounded-full shadow-[0_4px_14px_-2px_rgba(255,191,35,0.5)] hover:bg-[#e5ac20] hover:-translate-y-px hover:shadow-[0_6px_18px_-2px_rgba(255,191,35,0.55)] transition-all cursor-pointer"
            >
              {t.nav.startFreeTrial}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden z-50 p-2 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown — softened (April 23rd, 2026).
            Removed border-b-2 black; replaced with soft divider + soft shadow. */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800 shadow-[0_10px_30px_-4px_rgba(16,24,40,0.10)]">
            <div className="px-6 py-4 space-y-1">
              {[
                { label: t.nav.features, href: '#features' },
                { label: t.nav.howItWorks, href: '#how-it-works' },
                { label: t.nav.pricing, href: '#pricing' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    const element = document.querySelector(item.href);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="block px-4 py-2.5 text-sm font-semibold text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white rounded-lg hover:bg-[#ffbf23]/15 transition-all"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t border-[#e6ebf1] dark:border-gray-800 space-y-2">
                {/* Language & Theme Switchers (January 22nd, 2026) */}
                <div className="flex items-center justify-between px-4 py-2">
                  <LanguageSwitcher variant="navbar" />
                  <ThemeSwitcher variant="navbar" />
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-gray-900 rounded-lg transition-all text-left cursor-pointer"
                >
                  {t.nav.login}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignupClick();
                  }}
                  className="w-full px-4 py-2.5 bg-[#ffbf23] text-[#0f172a] text-sm font-bold uppercase tracking-wide rounded-full shadow-[0_4px_14px_-2px_rgba(255,191,35,0.5)] hover:bg-[#e5ac20] transition-all text-center cursor-pointer"
                >
                  {t.nav.startFreeTrial}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ==========================================================================
          HERO SECTION — "SMOOVER" (April 23rd, 2026)
          Was: sharp badge, flat-yellow headline highlight, neo-brutalist CTA
          with black offset shadow, sharp avatar borders.
          Now: rounded-full pill badge, Archivo display headline with the
          yellow→amber gradient on the highlight word, rounded-full CTA with a
          soft yellow glow shadow, rounded-full soft-bordered avatars.
          ========================================================================== */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">

          {/* Hero Content — Archivo display + gradient emphasis (April 23rd, 2026) */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Live badge — rounded pill with hairline border (April 23rd, 2026) */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23]/10 border border-[#ffbf23]/50 rounded-full text-[11px] font-bold uppercase tracking-wider text-[#0f172a] dark:text-white mb-6 cursor-default">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffbf23] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffbf23]"></span>
                </span>
                {t.landing.hero.badge}
              </div>

              {/* Headline — Archivo display, gradient on highlight (April 23rd, 2026) */}
              <h1 className="font-display text-5xl md:text-6xl font-bold text-[#0f172a] dark:text-white tracking-[-0.02em] mb-6 leading-[1.05]">
                {t.landing.hero.title} <br />
                <span className="text-gradient-brand">{t.landing.hero.titleHighlight}</span>
              </h1>

              <p className="text-lg text-[#425466] dark:text-gray-400 mb-8 leading-relaxed max-w-md">
                {t.landing.hero.subtitle}
              </p>

              {/* CTA Button — soft yellow glow replaces offset shadow (April 23rd, 2026) */}
              {/* January 13th, 2026: "Get Demo" button removed per client request. */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={onSignupClick}
                  className="w-full sm:w-auto px-6 py-3.5 bg-[#ffbf23] text-[#0f172a] text-sm font-bold uppercase tracking-wide rounded-full shadow-[0_10px_30px_-6px_rgba(255,191,35,0.5)] hover:bg-[#e5ac20] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-6px_rgba(255,191,35,0.6)] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {t.landing.hero.ctaPrimary}
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Social Proof — rounded avatars, soft text (April 23rd, 2026) */}
              <div className="mt-8 flex items-center gap-3 text-xs text-[#425466] dark:text-gray-400 font-medium">
                <div className="flex -space-x-2">
                  {[
                    'https://randomuser.me/api/portraits/women/44.jpg',
                    'https://randomuser.me/api/portraits/men/32.jpg',
                    'https://randomuser.me/api/portraits/women/68.jpg',
                    'https://randomuser.me/api/portraits/men/75.jpg',
                    'https://randomuser.me/api/portraits/women/17.jpg',
                  ].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Customer ${i + 1}`}
                      className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 object-cover shadow-[0_1px_2px_0_rgba(16,24,40,0.08)]"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                   <div className="flex text-[#ffbf23]">
                     {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                   </div>
                   <span className="text-[#0f172a] dark:text-gray-300 ml-1 font-semibold">{t.landing.hero.socialProof}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual — softer ambient glow (April 23rd, 2026) */}
          <div className="relative lg:h-[480px] flex items-center justify-center scale-90 origin-center">
             <motion.div
               style={{ y: y1 }}
               className="absolute inset-0 bg-gradient-to-tr from-[#ffbf23]/20 to-[#ffbf23]/5 blur-3xl animate-blob mix-blend-multiply"
             />
             <InteractiveSearchDemo />
          </div>

        </div>
      </section>

      {/* ==========================================================================
          LOGO CLOUD — "SMOOVER" (April 23rd, 2026)
          Was: border-y-2 black. Now: hairline #e6ebf1 dividers + off-white wash. */}
      <section className="border-y border-[#e6ebf1] dark:border-gray-800 bg-[#f6f9fc] dark:bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#8898aa] dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap mr-8">{t.landing.trustedBy}</span>
          <div className="scale-90 origin-right">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* ==========================================================================
          FEATURE GRID / BENTO — "SMOOVER" (April 23rd, 2026)
          Was: border-b-2 black, font-black uppercase headings, sharp badges.
          Now: hairline divider, Archivo display heading, rounded-full badges
          with soft borders. BentoGrid / BentoCard component-level styling is
          updated in BentoGrid.tsx (same date). */}
      <section id="features" className="py-24 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6">
           {/* Section Header — Archivo display, soft body copy (April 23rd, 2026) */}
           <div className="mb-16 max-w-2xl mx-auto text-center">
             <h2 className="font-display text-3xl md:text-4xl font-bold text-[#0f172a] dark:text-white mb-4 tracking-[-0.02em]">{t.landing.features.sectionTitle}</h2>
             <p className="text-base text-[#425466] dark:text-gray-400 leading-relaxed">
               {t.landing.features.sectionSubtitle}
             </p>
           </div>

           <BentoGrid>
              {/* Large Main Feature */}
              <BentoCard
                title={t.landing.features.mainFeature.title}
                description={t.landing.features.mainFeature.description}
                className="md:col-span-2 md:row-span-2 bg-white"
                fade="bottom"
                graphic={<DiscoveryGraphic />}
              >
                {/* Feature Badges — rounded pills (April 23rd, 2026) */}
                <div className="mt-4 flex gap-2 flex-wrap">
                  <div className="px-3 py-1 bg-[#ffbf23]/15 text-[#0f172a] dark:text-white text-xs font-semibold rounded-full border border-[#ffbf23]/50">{t.landing.features.mainFeature.badge1}</div>
                  <div className="px-3 py-1 bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 text-xs font-semibold rounded-full border border-[#e6ebf1] dark:border-gray-700">{t.landing.features.mainFeature.badge2}</div>
                </div>
              </BentoCard>

              {/* Standard Cards */}
              <BentoCard
                title={t.landing.features.feature2.title}
                description={t.landing.features.feature2.description}
                graphic={<VerifiedEmailGraphic />}
              />

              <BentoCard
                title={t.landing.features.feature3.title}
                description={t.landing.features.feature3.description}
                graphic={<PipelineGraphic />}
              />
           </BentoGrid>
        </div>
      </section>

      {/* ==========================================================================
          "HOW IT WORKS" STEPS — "SMOOVER" (April 23rd, 2026)
          Was: border-t-2 black divider, font-black headings, offset brutal
          shadows on images, square step numbers, square bullet squares.
          Now: hairline #e6ebf1 divider, Archivo headings, rounded-full step
          numbers with soft shadows, rounded-full bullets, rounded-2xl image
          cards with soft shadows + yellow glow on hover, rounded overlay
          cards. Off-white (#f6f9fc) section background to alternate with the
          features section above. */}
      <section id="how-it-works" className="py-24 border-t border-[#e6ebf1] dark:border-gray-800 bg-[#f6f9fc] dark:bg-[#0a0a0a] overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
           {/* Section Header — Archivo display (April 23rd, 2026) */}
           <div className="text-center mb-24">
             <motion.h2
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="font-display text-3xl md:text-4xl font-bold text-[#0f172a] dark:text-white mb-4 tracking-[-0.02em]"
             >
               {t.landing.howItWorks.sectionTitle}
             </motion.h2>
             <motion.p
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-[#425466] dark:text-gray-400 text-lg"
             >
               {t.landing.howItWorks.sectionSubtitle}
             </motion.p>
           </div>

           <div className="space-y-24">
             {[
               {
                 step: t.landing.howItWorks.step1.number,
                 title: t.landing.howItWorks.step1.title,
                 desc: t.landing.howItWorks.step1.description,
                 image: "/Find Your Competitors' Top Affiliates.jpeg",
                 overlayTitle: t.landing.howItWorks.step1.overlayTitle,
                 overlaySubtitle: t.landing.howItWorks.step1.overlaySubtitle,
                 bullets: t.landing.howItWorks.step1.bullets
               },
               {
                 step: t.landing.howItWorks.step2.number,
                 title: t.landing.howItWorks.step2.title,
                 desc: t.landing.howItWorks.step2.description,
                 image: "/Get 500-2,500 Qualified Prospects.jpeg",
                 overlayTitle: t.landing.howItWorks.step2.overlayTitle,
                 overlaySubtitle: t.landing.howItWorks.step2.overlaySubtitle,
                 bullets: t.landing.howItWorks.step2.bullets
               },
               {
                 step: t.landing.howItWorks.step3.number,
                 title: t.landing.howItWorks.step3.title,
                 desc: t.landing.howItWorks.step3.description,
                 image: "/Start Recruiting Immediately.jpeg",
                 overlayTitle: t.landing.howItWorks.step3.overlayTitle,
                 overlaySubtitle: t.landing.howItWorks.step3.overlaySubtitle,
                 bullets: t.landing.howItWorks.step3.bullets
               }
             ].map((item, idx) => (
               <motion.div
                 key={idx}
                 initial={{ opacity: 0, y: 40 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, margin: "-100px" }}
                 transition={{ duration: 0.7, delay: idx * 0.2 }}
                 className={`flex flex-col md:flex-row items-center gap-12 lg:gap-20 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
               >
                  <div className="flex-1 space-y-6">
                    {/* Step Number — rounded-full with soft yellow glow (April 23rd, 2026) */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center justify-center w-12 h-12 bg-[#ffbf23] text-[#0f172a] text-lg font-bold font-mono rounded-full shadow-[0_6px_16px_-4px_rgba(255,191,35,0.55)]">
                        {item.step}
                      </span>
                      <div className="h-px flex-1 bg-[#e6ebf1] dark:bg-gray-800"></div>
                    </div>

                    {/* Title & Description — Archivo (April 23rd, 2026) */}
                    <h3 className="font-display text-2xl font-bold text-[#0f172a] dark:text-white tracking-[-0.01em]">{item.title}</h3>
                    <p className="text-lg text-[#425466] dark:text-gray-400 leading-relaxed">{item.desc}</p>

                    {/* Bullet Points — rounded dots (April 23rd, 2026) */}
                    <ul className="space-y-3 pt-2">
                      {item.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-[#425466] dark:text-gray-300 font-medium">
                          <div className="w-1.5 h-1.5 bg-[#ffbf23] rounded-full shadow-[0_0_0_3px_rgba(255,191,35,0.15)]"></div>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Image Container — rounded-2xl with soft shadow + yellow glow on hover (April 23rd, 2026) */}
                  <div className="flex-1 w-full">
                    <div className="relative group">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${idx % 2 === 0 ? 'from-[#ffbf23]/25 to-[#ffbf23]/10' : 'from-[#ffbf23]/10 to-[#ffbf23]/25'} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl`} />
                      <div className="relative overflow-hidden rounded-2xl aspect-[4/3] ring-1 ring-[#e6ebf1] dark:ring-gray-800 shadow-[0_12px_40px_-12px_rgba(16,24,40,0.18)] group-hover:shadow-[0_20px_50px_-12px_rgba(255,191,35,0.35)] group-hover:-translate-y-1 transition-all duration-300">
                        <img src={item.image} alt={item.title} className="object-cover w-full h-full" />

                        {/* Floating Overlay — rounded card with soft shadow (April 23rd, 2026) */}
                        <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/95 dark:bg-[#111]/95 backdrop-blur-md rounded-xl border border-[#e6ebf1] dark:border-gray-700 shadow-[0_10px_30px_-6px_rgba(16,24,40,0.12)] transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-3">
                            <img
                              src="/logo.svg"
                              alt="Afforce One"
                              className="w-8 h-8 rounded-lg border border-[#e6ebf1] dark:border-gray-700 bg-white dark:bg-[#111] p-0.5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-[#0f172a] dark:text-white">{item.overlayTitle}</div>
                              <div className="text-xs text-[#8898aa] dark:text-gray-400 font-medium">{item.overlaySubtitle}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
               </motion.div>
             ))}
           </div>
        </div>
      </section>

      {/* ==========================================================================
          PRICING SECTION — "SMOOVER" (April 23rd, 2026)
          Was: border-t-2 black divider, sharp cards with offset black/yellow
          shadows, font-black CTAs, square checkmarks.
          Now: hairline #e6ebf1 divider, rounded-2xl cards with soft shadows
          (yellow glow on the Pro featured card), rounded-full CTAs, rounded-full
          checkmark circles, Archivo section heading.

          Historical: April 14th, 2026 — Enterprise plan card removed per
          client request. Tier not yet implemented end-to-end (no Stripe
          price, no team / brand projects / API / webhooks). Translation keys
          `t.landing.pricing.enterprise.*` also removed from dictionaries on
          the same date. To reintroduce, restore from git history prior to
          2026-04-14. */}
      <section id="pricing" className="py-24 px-6 bg-white dark:bg-[#0a0a0a] border-t border-[#e6ebf1] dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          {/* Section Header — Archivo display + rounded badge (April 23rd, 2026) */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffbf23]/15 rounded-full border border-[#ffbf23]/50 text-[11px] font-bold text-[#0f172a] dark:text-white mb-4 uppercase tracking-wider">
                <Zap size={12} fill="currentColor" />
                {t.landing.pricing.badge}
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-[#0f172a] dark:text-white mb-4 tracking-[-0.02em]">
                {t.landing.pricing.sectionTitle}
              </h2>
              <p className="text-[#425466] dark:text-gray-400 text-lg max-w-xl mx-auto">
                {t.landing.pricing.sectionSubtitle}
              </p>
            </motion.div>
          </div>

          {/* Pricing Cards (April 23rd, 2026: rounded-2xl + soft shadows) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Pro Plan — featured card with yellow glow (April 23rd, 2026) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="relative bg-white dark:bg-[#111] rounded-2xl ring-1 ring-[#ffbf23]/40 flex flex-col overflow-hidden shadow-[0_20px_50px_-15px_rgba(255,191,35,0.35),0_10px_25px_-10px_rgba(16,24,40,0.10)]"
            >
              {/* Most Popular Banner */}
              <div className="bg-[#ffbf23] text-[#0f172a] text-xs font-bold tracking-wider uppercase text-center py-2 flex items-center justify-center gap-1.5">
                <Zap size={12} fill="currentColor" />
                {t.landing.pricing.mostPopular}
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="font-display text-lg font-bold text-[#0f172a] dark:text-white mb-1">{t.landing.pricing.pro.name}</h3>
                  <p className="text-xs text-[#425466] dark:text-gray-400 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">{t.landing.pricing.pro.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-4xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-white">{t.landing.pricing.pro.price}</span>
                    <span className="text-base font-medium text-[#425466] dark:text-gray-300">{t.landing.pricing.perMonth}</span>
                  </div>
                </div>

                {/* CTA — rounded-full with yellow glow (April 23rd, 2026) */}
                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-bold uppercase tracking-wide mb-6 rounded-full transition-all duration-200 bg-[#ffbf23] text-[#0f172a] shadow-[0_10px_24px_-6px_rgba(255,191,35,0.55)] hover:bg-[#e5ac20] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-6px_rgba(255,191,35,0.65)] cursor-pointer"
                >
                  {t.landing.pricing.pro.cta}
                </button>

                {/* Features — rounded-full checkmarks (April 23rd, 2026) */}
                <div className="space-y-3 flex-1">
                  {t.landing.pricing.pro.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className="mt-0.5 w-4 h-4 bg-[#ffbf23] text-[#0f172a] rounded-full flex items-center justify-center shrink-0 shadow-[0_0_0_3px_rgba(255,191,35,0.18)]">
                        <CheckCircle2 size={10} strokeWidth={3} />
                      </div>
                      <span className="text-xs leading-relaxed text-[#425466] dark:text-gray-300 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Growth Plan — soft card with subtle lift on hover (April 23rd, 2026) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative bg-white dark:bg-[#111] rounded-2xl ring-1 ring-[#e6ebf1] dark:ring-gray-800 flex flex-col shadow-[0_4px_12px_-2px_rgba(16,24,40,0.06)] hover:shadow-[0_16px_40px_-12px_rgba(16,24,40,0.15)] hover:-translate-y-0.5 transition-all duration-300"
            >
              {/* Spacer to align with Pro card's banner */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="font-display text-lg font-bold text-[#0f172a] dark:text-white mb-1">{t.landing.pricing.growth.name}</h3>
                  <p className="text-xs text-[#425466] dark:text-gray-400 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">{t.landing.pricing.growth.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-4xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-white">{t.landing.pricing.growth.price}</span>
                    <span className="text-base font-medium text-[#425466] dark:text-gray-300">{t.landing.pricing.perMonth}</span>
                  </div>
                </div>

                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-bold uppercase tracking-wide mb-6 rounded-full transition-all duration-200 bg-[#0f172a] text-white shadow-[0_6px_16px_-4px_rgba(16,24,40,0.25)] hover:bg-[#1a2234] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-4px_rgba(16,24,40,0.3)] cursor-pointer"
                >
                  {t.landing.pricing.growth.cta}
                </button>

                <div className="space-y-3 flex-1">
                  {t.landing.pricing.growth.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#ffbf23] text-[#0f172a] shadow-[0_0_0_3px_rgba(255,191,35,0.18)]'}`}>
                        {idx !== 0 && <CheckCircle2 size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-bold text-[#0f172a] dark:text-white' : 'text-[#425466] dark:text-gray-300 font-medium'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Trust Note — soft (April 23rd, 2026) */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-sm text-[#8898aa] dark:text-gray-400 mt-8 font-medium"
          >
            {t.landing.pricing.trustNote}
          </motion.p>
        </div>
      </section>

      {/* ==========================================================================
          CTA SECTION — "SMOOVER" (April 23rd, 2026)
          Was: sharp rectangle with offset yellow shadow + border-2 black.
          Now: rounded-3xl container, soft ambient yellow glow shadow, no hard
          border. Kept the dot-grid pattern + ambient blur blobs (they look
          great). Primary CTA is rounded-full with yellow glow; secondary is
          ghost with rounded-full border. */}
      <section className="py-24 px-6 bg-white dark:bg-[#0a0a0a]">
         <div className="max-w-4xl mx-auto bg-[#0f172a] rounded-3xl p-10 md:p-16 text-center relative overflow-hidden shadow-[0_30px_80px_-20px_rgba(255,191,35,0.3),0_20px_40px_-15px_rgba(16,24,40,0.4)]">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#ffbf23_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#ffbf23]/25 blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#ffbf23]/10 blur-3xl"></div>

            <div className="relative z-10 space-y-6">
              {/* Heading — Archivo display (April 23rd, 2026) */}
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-[-0.02em] leading-[1.05]">
                {t.landing.cta.title}
              </h2>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                {t.landing.cta.subtitle}
              </p>
              {/* Buttons — rounded-full (April 23rd, 2026) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  onClick={onSignupClick}
                  className="px-6 py-3 bg-[#ffbf23] text-[#0f172a] text-base font-bold uppercase tracking-wide rounded-full shadow-[0_10px_30px_-6px_rgba(255,191,35,0.55)] hover:bg-[#e5ac20] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-6px_rgba(255,191,35,0.65)] transition-all duration-200 w-full sm:w-auto cursor-pointer"
                >
                  {t.landing.cta.ctaPrimary}
                </button>
                <button className="px-6 py-3 bg-transparent border border-white/60 text-white text-base font-bold uppercase tracking-wide rounded-full hover:bg-white hover:text-[#0f172a] hover:border-white transition-all duration-200 w-full sm:w-auto cursor-pointer">
                  {t.landing.cta.ctaSecondary}
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-2 font-medium">{t.landing.cta.trustNote}</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
