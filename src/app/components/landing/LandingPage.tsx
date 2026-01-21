'use client';

/**
 * =============================================================================
 * LANDING PAGE - NEO-BRUTALIST
 * =============================================================================
 * 
 * Last Updated: January 9th, 2026
 * 
 * CHANGELOG:
 * - January 9th, 2026: Updated hero section to neo-brutalist design
 *   - Sharp edges on navbar, buttons, badges
 *   - Updated color from #D4E815 to #ffbf23 (brand yellow)
 *   - Bold typography with font-black uppercase accents
 *   - Offset shadows on buttons
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
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] font-sans text-[#111827] dark:text-white selection:bg-[#ffbf23]/30 selection:text-[#1A1D21] overflow-x-hidden">
      
      {/* Background Texture */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-[0.03]" />

      {/* ==========================================================================
          NAVBAR - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Sharp edges on all elements (removed rounded-full, rounded-lg)
          - Bold borders (border-2 border-black when scrolled)
          - Brand yellow (#ffbf23) accent color
          - Neo-brutalist logo with sharp container
          ========================================================================== */}
      <nav 
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b-2 border-black dark:border-white py-2.5' : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo - NEO-BRUTALIST with original image (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
          <div className="flex items-center gap-2 font-black text-lg tracking-tight z-50">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-7 h-7 object-cover border-2 border-black dark:border-white"
            />
            <span className="text-[#111827] dark:text-white">CrewCast<span className="text-[#ffbf23]">Studio</span></span>
          </div>

          {/* Desktop Links - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
          <div className="hidden md:flex items-center gap-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-1.5 py-1 border-2 border-gray-200 dark:border-gray-700">
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
                className="px-3.5 py-1.5 text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-[#ffbf23]/20 transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Auth Buttons - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher (January 9th, 2026) - i18n support */}
            <LanguageSwitcher variant="navbar" />
            {/* Theme Switcher (January 22nd, 2026) - Dark mode toggle */}
            <ThemeSwitcher variant="navbar" />
            <button 
              onClick={onLoginClick}
              className="text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 transition-colors cursor-pointer border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600"
            >
              {t.nav.login}
            </button>
            <button 
              onClick={onSignupClick}
              className="px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
            >
              {t.nav.startFreeTrial}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden z-50 p-2 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown - NEO-BRUTALIST (January 9th, 2026) */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0a0a0a] border-b-2 border-black dark:border-white shadow-lg">
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
                  className="block px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-[#ffbf23]/20 transition-all"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t-2 border-gray-200 dark:border-gray-700 space-y-2">
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
                  className="w-full px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left cursor-pointer"
                >
                  {t.nav.login}
                </button>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignupClick();
                  }}
                  className="w-full px-4 py-2.5 bg-[#ffbf23] text-black text-sm font-black uppercase border-2 border-black transition-all text-center cursor-pointer"
                >
                  {t.nav.startFreeTrial}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ==========================================================================
          HERO SECTION - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Sharp badge (removed rounded-full)
          - Bold headline with brand yellow (#ffbf23)
          - Neo-brutalist CTA buttons with offset shadows
          - Sharp avatar borders
          ========================================================================== */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Hero Content - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Badge - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23]/10 border-2 border-[#ffbf23] text-[11px] font-black uppercase tracking-wide text-[#1A1D21] dark:text-white mb-6 cursor-default">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full bg-[#ffbf23] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 bg-[#ffbf23]"></span>
                </span>
                {t.landing.hero.badge}
              </div>
              
              {/* Headline - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
              <h1 className="text-5xl md:text-6xl font-black text-[#111827] dark:text-white tracking-tight mb-6 leading-[1]">
                {t.landing.hero.title} <br />
                <span className="text-[#ffbf23]">{t.landing.hero.titleHighlight}</span>
              </h1>

              <p className="text-lg text-slate-500 dark:text-gray-400 mb-8 leading-relaxed max-w-md">
                {t.landing.hero.subtitle}
              </p>

              {/* CTA Button - NEO-BRUTALIST (January 9th, 2026) */}
              {/* January 13th, 2026: Removed "Get Demo" button as per request */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button 
                  onClick={onSignupClick}
                  className="w-full sm:w-auto px-6 py-3 bg-[#ffbf23] text-black text-sm font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {t.landing.hero.ctaPrimary}
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Social Proof - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
              <div className="mt-8 flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 font-bold">
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
                      className="w-7 h-7 border-2 border-white dark:border-gray-800 object-cover" 
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                   <div className="flex text-[#ffbf23]">
                     {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                   </div>
                   <span className="text-slate-700 dark:text-gray-300 ml-1">{t.landing.hero.socialProof}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="relative lg:h-[480px] flex items-center justify-center scale-90 origin-center">
             <motion.div 
               style={{ y: y1 }}
               className="absolute inset-0 bg-gradient-to-tr from-[#ffbf23]/20 to-[#ffbf23]/10 blur-3xl animate-blob mix-blend-multiply"
             />
             <InteractiveSearchDemo />
          </div>

        </div>
      </section>

      {/* ==========================================================================
          LOGO CLOUD - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Bold border (border-y-2 border-black)
          - Sharp background (removed backdrop-blur)
          ========================================================================== */}
      {/* Logo Cloud - Dark mode: January 22nd, 2026 */}
      <section className="border-y-2 border-black dark:border-white bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap mr-8">{t.landing.trustedBy}</span>
          <div className="scale-90 origin-right">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* ==========================================================================
          FEATURE GRID / BENTO - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Bold section border (border-b-2 border-black)
          - Sharp header typography (font-black)
          - Sharp feature badges (removed rounded-full)
          - Updated colors from #D4E815 to #ffbf23
          
          Note: BentoGrid and BentoCard components handle their own styling
          ========================================================================== */}
      {/* Features Section - Dark mode: January 22nd, 2026 */}
      <section id="features" className="py-20 bg-white dark:bg-[#0a0a0a] border-b-2 border-black dark:border-white">
        <div className="max-w-7xl mx-auto px-6">
           {/* Section Header - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
           <div className="mb-16 max-w-2xl mx-auto text-center">
             <h2 className="text-2xl md:text-3xl font-black text-[#111827] dark:text-white mb-4 tracking-tight">{t.landing.features.sectionTitle}</h2>
             <p className="text-base text-slate-500 dark:text-gray-400 leading-relaxed">
               {t.landing.features.sectionSubtitle}
             </p>
           </div>

           <BentoGrid>
              {/* Large Main Feature */}
              <BentoCard 
                title={t.landing.features.mainFeature.title}
                description={t.landing.features.mainFeature.description}
                className="md:col-span-2 md:row-span-2 bg-white border-[#E5E7EB]"
                fade="bottom"
                graphic={<DiscoveryGraphic />}
              >
                {/* Feature Badges - NEO-BRUTALIST (January 9th, 2026) */}
                <div className="mt-4 flex gap-2">
                  <div className="px-3 py-1 bg-[#ffbf23]/20 text-[#1A1D21] text-xs font-black border-2 border-[#ffbf23]">{t.landing.features.mainFeature.badge1}</div>
                  <div className="px-3 py-1 bg-[#1A1D21]/10 text-[#1A1D21] text-xs font-black border-2 border-[#1A1D21]/30">{t.landing.features.mainFeature.badge2}</div>
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
          "HOW IT WORKS" STEPS - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Bold section border (border-t-2 border-black)
          - Sharp typography (font-black)
          - Sharp step numbers (removed rounded-2xl)
          - Sharp bullet points (removed rounded-full)
          - Sharp image containers (removed rounded-2xl)
          - Sharp overlay cards (removed rounded-xl)
          - Updated colors from #D4E815 to #ffbf23
          ========================================================================== */}
      {/* How It Works Section - Dark mode: January 22nd, 2026 */}
      <section id="how-it-works" className="py-20 border-t-2 border-black dark:border-white bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
           {/* Section Header - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
           <div className="text-center mb-24">
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="text-3xl md:text-4xl font-black text-[#111827] dark:text-white mb-4 tracking-tight"
             >
               {t.landing.howItWorks.sectionTitle}
             </motion.h2>
             <motion.p 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-slate-500 dark:text-gray-400 text-lg"
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
                    {/* Step Number - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center justify-center w-12 h-12 bg-[#ffbf23] text-[#1A1D21] text-lg font-black font-mono border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        {item.step}
                      </span>
                      <div className="h-[2px] flex-1 bg-black dark:bg-white"></div>
                    </div>
                    
                    {/* Title & Description - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
                    <h3 className="text-2xl font-black text-[#111827] dark:text-white">{item.title}</h3>
                    <p className="text-lg text-slate-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                    
                    {/* Bullet Points - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
                    <ul className="space-y-3 pt-2">
                      {item.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-300 font-medium">
                          <div className="w-2 h-2 bg-[#ffbf23] border border-black"></div>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Image Container - NEO-BRUTALIST (January 9th, 2026) */}
                  <div className="flex-1 w-full">
                    <div className="relative group">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${idx % 2 === 0 ? 'from-[#ffbf23]/20 to-[#ffbf23]/10' : 'from-[#ffbf23]/10 to-[#ffbf23]/20'} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                      <div className="relative overflow-hidden border-2 border-black aspect-[4/3] transform group-hover:translate-x-[-4px] group-hover:translate-y-[-4px] transition-transform duration-300 shadow-[6px_6px_0px_0px_#000000] group-hover:shadow-[10px_10px_0px_0px_#000000]">
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/0 transition-colors duration-500" />
                        <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
                        
                        {/* Floating Overlay - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
                        <div className="absolute bottom-4 left-4 right-4 p-4 bg-white dark:bg-[#111] border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_#ffbf23] transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-3">
                            <img 
                              src="/logo.jpg" 
                              alt="CrewCast Studio" 
                              className="w-8 h-8 object-cover border border-black dark:border-white"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-black text-[#111827] dark:text-white">{item.overlayTitle}</div>
                              <div className="text-xs text-slate-500 dark:text-gray-400 font-bold">{item.overlaySubtitle}</div>
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
          PRICING SECTION - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Bold section border (border-t-2 border-black)
          - Sharp badge (removed rounded-full)
          - Sharp pricing cards (removed rounded-2xl)
          - Neo-brutalist offset shadows
          - Sharp buttons (removed rounded-full)
          - Sharp checkmarks (removed rounded-full)
          - Updated colors from #D4E815 to #ffbf23
          ========================================================================== */}
      {/* Pricing Section - Dark mode: January 22nd, 2026 */}
      <section id="pricing" className="py-20 px-6 bg-white dark:bg-[#0a0a0a] border-t-2 border-black dark:border-white">
        <div className="max-w-6xl mx-auto">
          {/* Section Header - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffbf23]/20 border-2 border-[#ffbf23] text-[11px] font-black text-[#1A1D21] dark:text-white mb-4 uppercase">
                <Zap size={12} fill="currentColor" />
                {t.landing.pricing.badge}
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-[#111827] dark:text-white mb-4 tracking-tight">
                {t.landing.pricing.sectionTitle}
              </h2>
              <p className="text-slate-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
                {t.landing.pricing.sectionSubtitle}
              </p>
            </motion.div>
          </div>

          {/* Pricing Cards - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pro Plan - Featured Card - Dark mode: January 22nd, 2026 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="relative bg-white dark:bg-[#111] border-2 border-[#ffbf23] flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_#ffbf23]"
            >
              {/* Popular Badge - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="bg-[#1A1D21] text-white text-xs font-black tracking-wider uppercase text-center py-2 flex items-center justify-center gap-1.5">
                <Zap size={12} fill="currentColor" className="text-[#ffbf23]" />
                {t.landing.pricing.mostPopular}
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] dark:text-white mb-1">{t.landing.pricing.pro.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">{t.landing.pricing.pro.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#1A1D21] dark:text-white">{t.landing.pricing.pro.price}</span>
                    <span className="text-base font-bold text-[#333333] dark:text-gray-300">{t.landing.pricing.perMonth}</span>
                  </div>
                </div>

                {/* CTA Button - NEO-BRUTALIST (January 9th, 2026) */}
                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-[#ffbf23] text-[#1A1D21] border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  {t.landing.pricing.pro.cta}
                </button>

                {/* Features - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
                <div className="space-y-3 flex-1">
                  {t.landing.pricing.pro.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className="mt-0.5 w-4 h-4 bg-[#1A1D21] text-[#ffbf23] flex items-center justify-center shrink-0 border border-black">
                        <CheckCircle2 size={10} strokeWidth={3} />
                      </div>
                      <span className="text-xs leading-relaxed text-slate-600 dark:text-gray-300 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Growth Plan - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative bg-white dark:bg-[#111] border-2 border-black dark:border-white flex flex-col shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:shadow-[6px_6px_0px_0px_#000000] dark:hover:shadow-[6px_6px_0px_0px_#ffffff] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] dark:text-white mb-1">{t.landing.pricing.growth.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">{t.landing.pricing.growth.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#111827] dark:text-white">{t.landing.pricing.growth.price}</span>
                    <span className="text-base font-bold text-[#333333] dark:text-gray-300">{t.landing.pricing.perMonth}</span>
                  </div>
                </div>

                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-[#333333] text-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  {t.landing.pricing.growth.cta}
                </button>

                <div className="space-y-3 flex-1">
                  {t.landing.pricing.growth.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#ffbf23] border border-black'}`}>
                        {idx !== 0 && <CheckCircle2 size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-black text-[#111827] dark:text-white' : 'text-slate-600 dark:text-gray-300 font-medium'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Enterprise Plan - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative bg-white dark:bg-[#111] border-2 border-black dark:border-white flex flex-col shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:shadow-[6px_6px_0px_0px_#000000] dark:hover:shadow-[6px_6px_0px_0px_#ffffff] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] dark:text-white mb-1">{t.landing.pricing.enterprise.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">{t.landing.pricing.enterprise.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#111827] dark:text-white">{t.landing.pricing.enterprise.price}</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-white dark:bg-[#222] text-[#111827] dark:text-white border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:shadow-[2px_2px_0px_0px_#000000] dark:hover:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  {t.landing.pricing.enterprise.cta}
                </button>

                <div className="space-y-3 flex-1">
                  {t.landing.pricing.enterprise.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#ffbf23] border border-black'}`}>
                        {idx !== 0 && <CheckCircle2 size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-black text-[#111827] dark:text-white' : 'text-slate-600 dark:text-gray-300 font-medium'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Trust Note - NEO-BRUTALIST (January 9th, 2026) - Dark mode: January 22nd, 2026 */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-sm text-slate-500 dark:text-gray-400 mt-8 font-bold"
          >
            {t.landing.pricing.trustNote}
          </motion.p>
        </div>
      </section>

      {/* ==========================================================================
          CTA SECTION - NEO-BRUTALIST (Updated January 9th, 2026)
          
          Design changes:
          - Sharp container (removed rounded-[2rem])
          - Bold border
          - Sharp buttons (removed rounded-xl)
          - Neo-brutalist offset shadows
          - Updated colors from #D4E815 to #ffbf23
          ========================================================================== */}
      {/* CTA Section - Dark mode: January 22nd, 2026 */}
      <section className="py-20 px-6 bg-white dark:bg-[#0a0a0a]">
         <div className="max-w-4xl mx-auto bg-[#1A1D21] border-2 border-black p-10 md:p-16 text-center relative overflow-hidden shadow-[8px_8px_0px_0px_#ffbf23]">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#ffbf23_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#ffbf23]/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#ffbf23]/10 blur-3xl"></div>
            
            <div className="relative z-10 space-y-6">
              {/* Heading - NEO-BRUTALIST (January 9th, 2026) */}
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                {t.landing.cta.title}
              </h2>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                {t.landing.cta.subtitle}
              </p>
              {/* Buttons - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button 
                  onClick={onSignupClick}
                  className="px-6 py-3 bg-[#ffbf23] text-[#1A1D21] text-base font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 w-full sm:w-auto cursor-pointer"
                >
                  {t.landing.cta.ctaPrimary}
                </button>
                <button className="px-6 py-3 bg-transparent border-2 border-white text-white text-base font-black uppercase hover:bg-white hover:text-[#1A1D21] transition-all duration-200 w-full sm:w-auto cursor-pointer">
                  {t.landing.cta.ctaSecondary}
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-2 font-bold">{t.landing.cta.trustNote}</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
