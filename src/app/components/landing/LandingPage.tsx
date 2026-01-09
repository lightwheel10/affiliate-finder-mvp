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
  Play,
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

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Parallax scroll tracking
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, -150]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-[#111827] selection:bg-[#ffbf23]/30 selection:text-[#1A1D21] overflow-x-hidden">
      
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
          isScrolled ? 'bg-white/95 backdrop-blur-xl border-b-2 border-black py-2.5' : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo - NEO-BRUTALIST with original image (January 9th, 2026) */}
          <div className="flex items-center gap-2 font-black text-lg tracking-tight z-50">
            <img 
              src="/logo.jpg" 
              alt="CrewCast Studio" 
              className="w-7 h-7 object-cover border-2 border-black"
            />
            <span className="text-[#111827]">CrewCast<span className="text-[#ffbf23]">Studio</span></span>
          </div>

          {/* Desktop Links - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="hidden md:flex items-center gap-1 bg-white/80 backdrop-blur-md px-1.5 py-1 border-2 border-gray-200">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Pricing', href: '#pricing' },
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
                className="px-3.5 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-[#ffbf23]/20 transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Auth Buttons - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={onLoginClick}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors cursor-pointer border-2 border-transparent hover:border-gray-300"
            >
              Log in
            </button>
            <button 
              onClick={onSignupClick}
              className="px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
            >
              Start Free Trial
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden z-50 p-2 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown - NEO-BRUTALIST (January 9th, 2026) */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b-2 border-black shadow-lg">
            <div className="px-6 py-4 space-y-1">
              {[
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
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
                  className="block px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-[#ffbf23]/20 transition-all"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t-2 border-gray-200 space-y-2">
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-gray-50 transition-all text-left cursor-pointer"
                >
                  Log in
                </button>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignupClick();
                  }}
                  className="w-full px-4 py-2.5 bg-[#ffbf23] text-black text-sm font-black uppercase border-2 border-black transition-all text-center cursor-pointer"
                >
                  Start Free Trial
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
              {/* Badge - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23]/10 border-2 border-[#ffbf23] text-[11px] font-black uppercase tracking-wide text-[#1A1D21] mb-6 cursor-default">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full bg-[#ffbf23] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 bg-[#ffbf23]"></span>
                </span>
                Trusted by 1,300+ brands
              </div>
              
              {/* Headline - NEO-BRUTALIST (January 9th, 2026) */}
              <h1 className="text-5xl md:text-6xl font-black text-[#111827] tracking-tight mb-6 leading-[1]">
                Discover Affiliates <br />
                <span className="text-[#ffbf23]">Promoting Competitors</span>
              </h1>

              <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-md">
                Find 500+ active affiliates with verified contacts instantly. Skip weeks of manual research.
              </p>

              {/* CTA Buttons - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button 
                  onClick={onSignupClick}
                  className="w-full sm:w-auto px-6 py-3 bg-[#ffbf23] text-black text-sm font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  Try for Free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  className="w-full sm:w-auto px-6 py-3 bg-[#1A1D21] text-white text-sm font-black uppercase border-2 border-black hover:bg-[#333333] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play size={14} fill="currentColor" className="opacity-50" />
                  Get a Demo
                </button>
              </div>

              {/* Social Proof - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="mt-8 flex items-center gap-3 text-xs text-slate-500 font-bold">
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
                      className="w-7 h-7 border-2 border-white object-cover" 
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                   <div className="flex text-[#ffbf23]">
                     {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                   </div>
                   <span className="text-slate-700 ml-1">Loved by 1,300+ SaaS & e-commerce brands</span>
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
      <section className="border-y-2 border-black bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap mr-8">Trusted by top brands</span>
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
      <section id="features" className="py-20 bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6">
           {/* Section Header - NEO-BRUTALIST (January 9th, 2026) */}
           <div className="mb-16 max-w-2xl mx-auto text-center">
             <h2 className="text-2xl md:text-3xl font-black text-[#111827] mb-4 tracking-tight">How Smart Brands 3X Their Affiliate Growth</h2>
             <p className="text-base text-slate-500 leading-relaxed">
               Stop wasting 20+ hours a week manually searching for affiliates. Find every creator and publisher in your niche in minutes.
             </p>
           </div>

           <BentoGrid>
              {/* Large Main Feature */}
              <BentoCard 
                title="Reverse-Engineer Competitor Programs"
                description="Find all their top affiliates across 100+ networks."
                className="md:col-span-2 md:row-span-2 bg-white border-[#E5E7EB]"
                fade="bottom"
                graphic={<DiscoveryGraphic />}
              >
                {/* Feature Badges - NEO-BRUTALIST (January 9th, 2026) */}
                <div className="mt-4 flex gap-2">
                  <div className="px-3 py-1 bg-[#ffbf23]/20 text-[#1A1D21] text-xs font-black border-2 border-[#ffbf23]">500+ Instant Matches</div>
                  <div className="px-3 py-1 bg-[#1A1D21]/10 text-[#1A1D21] text-xs font-black border-2 border-[#1A1D21]/30">Weekly Fresh Leads</div>
                </div>
              </BentoCard>

              {/* Standard Cards */}
              <BentoCard 
                title="Get Emails Nobody Else Can Find"
                description="90%+ contact rate including LinkedIn profiles."
                graphic={<VerifiedEmailGraphic />}
              />

              <BentoCard 
                title="Start Recruiting Today"
                description="Export to CRM and start outreach immediately."
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
      <section id="how-it-works" className="py-20 border-t-2 border-black bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
           {/* Section Header - NEO-BRUTALIST (January 9th, 2026) */}
           <div className="text-center mb-24">
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="text-3xl md:text-4xl font-black text-[#111827] mb-4 tracking-tight"
             >
               From Zero to 500+ Affiliates in Minutes
             </motion.h2>
             <motion.p 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-slate-500 text-lg"
             >
               Watch your dashboard fill with qualified partners ready to promote your brand.
             </motion.p>
           </div>

           <div className="space-y-24">
             {[
               {
                 step: "01",
                 title: "Find Your Competitors' Top Affiliates",
                 desc: "Enter your competitors and we'll reverse-engineer their affiliate programs across 100+ networks to find all their top affiliates — even the hidden ones.",
                 image: "/Find Your Competitors' Top Affiliates.jpeg",
                 overlayTitle: "Competitor Analysis",
                 overlaySubtitle: "Found 1,243 affiliates",
                 bullets: [
                   "Scan across YouTube, Instagram, TikTok, and blogs",
                   "Find affiliates promoting similar products",
                   "No more digging through Ahrefs or Semrush"
                 ]
               },
               {
                 step: "02",
                 title: "Get 500-2,500 Qualified Prospects",
                 desc: "Watch your dashboard fill with qualified affiliates. Sort by traffic volume, Google rankings, follower count, or engagement rates to find your perfect partners fast.",
                 image: "/Get 500-2,500 Qualified Prospects.jpeg",
                 overlayTitle: "High-Quality Matches",
                 overlaySubtitle: "Sorted by engagement rate",
                 bullets: [
                   "Filter by traffic, rankings, and engagement",
                   "View audience demographics and location data",
                   "Track previous brand partnerships"
                 ]
               },
               {
                 step: "03",
                 title: "Start Recruiting Immediately",
                 desc: "Export verified emails, use our proven-to-convert templates, and start building partnerships today. Get 150+ fresh leads delivered every week.",
                 image: "/Start Recruiting Immediately.jpeg",
                 overlayTitle: "Outreach Ready",
                 overlaySubtitle: "150+ new leads weekly",
                 bullets: [
                   "90%+ email deliverability rate",
                   "Proven outreach templates included",
                   "One-click CRM export"
                 ]
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
                    {/* Step Number - NEO-BRUTALIST (January 9th, 2026) */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center justify-center w-12 h-12 bg-[#ffbf23] text-[#1A1D21] text-lg font-black font-mono border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        {item.step}
                      </span>
                      <div className="h-[2px] flex-1 bg-black"></div>
                    </div>
                    
                    {/* Title & Description - NEO-BRUTALIST (January 9th, 2026) */}
                    <h3 className="text-2xl font-black text-[#111827]">{item.title}</h3>
                    <p className="text-lg text-slate-500 leading-relaxed">{item.desc}</p>
                    
                    {/* Bullet Points - NEO-BRUTALIST (January 9th, 2026) */}
                    <ul className="space-y-3 pt-2">
                      {item.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
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
                        
                        {/* Floating Overlay - NEO-BRUTALIST (January 9th, 2026) */}
                        <div className="absolute bottom-4 left-4 right-4 p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#ffbf23] transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-3">
                            <img 
                              src="/logo.jpg" 
                              alt="CrewCast Studio" 
                              className="w-8 h-8 object-cover border border-black"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-black text-[#111827]">{item.overlayTitle}</div>
                              <div className="text-xs text-slate-500 font-bold">{item.overlaySubtitle}</div>
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
      <section id="pricing" className="py-20 px-6 bg-white border-t-2 border-black">
        <div className="max-w-6xl mx-auto">
          {/* Section Header - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffbf23]/20 border-2 border-[#ffbf23] text-[11px] font-black text-[#1A1D21] mb-4 uppercase">
                <Zap size={12} fill="currentColor" />
                Simple, Transparent Pricing
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-[#111827] mb-4 tracking-tight">
                Find the Perfect Plan for Your Growth
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                All plans include weekly affiliate discovery to keep your pipeline full. Start with a 7-day free trial.
              </p>
            </motion.div>
          </div>

          {/* Pricing Cards - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pro Plan - Featured Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="relative bg-white border-2 border-[#ffbf23] flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_#ffbf23]"
            >
              {/* Popular Badge - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="bg-[#1A1D21] text-white text-xs font-black tracking-wider uppercase text-center py-2 flex items-center justify-center gap-1.5">
                <Zap size={12} fill="currentColor" className="text-[#ffbf23]" />
                Most Popular
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] mb-1">Pro</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">For growing SaaS & e-commerce brands</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#1A1D21]">$99</span>
                    <span className="text-base font-bold text-[#333333]">/month</span>
                  </div>
                </div>

                {/* CTA Button - NEO-BRUTALIST (January 9th, 2026) */}
                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-[#ffbf23] text-[#1A1D21] border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  Start 7-Day Free Trial
                </button>

                {/* Features - NEO-BRUTALIST (January 9th, 2026) */}
                <div className="space-y-3 flex-1">
                  {[
                    'Unlimited affiliate discovery (500+ matches)',
                    'Weekly new affiliate discoveries',
                    '150 verified email credits/month',
                    'Advanced search & filtering tools',
                    '2 Team Seats',
                    'One-click CRM export'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className="mt-0.5 w-4 h-4 bg-[#1A1D21] text-[#ffbf23] flex items-center justify-center shrink-0 border border-black">
                        <CheckCircle2 size={10} strokeWidth={3} />
                      </div>
                      <span className="text-xs leading-relaxed text-slate-600 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Growth Plan - NEO-BRUTALIST (January 9th, 2026) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative bg-white border-2 border-black flex flex-col shadow-[4px_4px_0px_0px_#000000] hover:shadow-[6px_6px_0px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] mb-1">Growth</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">For agencies & multi-brand companies</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#111827]">$249</span>
                    <span className="text-base font-bold text-[#333333]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onSignupClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-[#333333] text-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  Start 7-Day Free Trial
                </button>

                <div className="space-y-3 flex-1">
                  {[
                    'Everything in Pro +',
                    '500 verified email credits/month',
                    '5 brands or geographical markets',
                    '5 Team Seats',
                    'Advanced analytics dashboard',
                    'Dedicated account manager'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#ffbf23] border border-black'}`}>
                        {idx !== 0 && <CheckCircle2 size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-black text-[#111827]' : 'text-slate-600 font-medium'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Enterprise Plan - NEO-BRUTALIST (January 9th, 2026) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative bg-white border-2 border-black flex flex-col shadow-[4px_4px_0px_0px_#000000] hover:shadow-[6px_6px_0px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[#111827] mb-1">Enterprise</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight font-medium">For large organizations with custom needs</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#111827]">Custom</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 text-sm font-black uppercase mb-6 transition-all duration-200 bg-white text-[#111827] border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer"
                >
                  Let's Talk
                </button>

                <div className="space-y-3 flex-1">
                  {[
                    'Everything in Growth +',
                    'Unlimited verified emails',
                    'Unlimited brand portfolio',
                    'Unlimited team access',
                    'API access & webhooks',
                    '24/7 priority support'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#ffbf23] border border-black'}`}>
                        {idx !== 0 && <CheckCircle2 size={10} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-black text-[#111827]' : 'text-slate-600 font-medium'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Trust Note - NEO-BRUTALIST (January 9th, 2026) */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-sm text-slate-500 mt-8 font-bold"
          >
            ✨ 7-day free trial • Cancel anytime • 30-day money-back guarantee
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
      <section className="py-20 px-6">
         <div className="max-w-4xl mx-auto bg-[#1A1D21] border-2 border-black p-10 md:p-16 text-center relative overflow-hidden shadow-[8px_8px_0px_0px_#ffbf23]">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#ffbf23_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#ffbf23]/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#ffbf23]/10 blur-3xl"></div>
            
            <div className="relative z-10 space-y-6">
              {/* Heading - NEO-BRUTALIST (January 9th, 2026) */}
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                Ready to Find Your Perfect Affiliates?
              </h2>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Join 1,300+ brands that have found their ideal affiliate partners in minutes, not months.
              </p>
              {/* Buttons - NEO-BRUTALIST (January 9th, 2026) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button 
                  onClick={onSignupClick}
                  className="px-6 py-3 bg-[#ffbf23] text-[#1A1D21] text-base font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 w-full sm:w-auto cursor-pointer"
                >
                  Start Your 7-Day Free Trial
                </button>
                <button className="px-6 py-3 bg-transparent border-2 border-white text-white text-base font-black uppercase hover:bg-white hover:text-[#1A1D21] transition-all duration-200 w-full sm:w-auto cursor-pointer">
                  Get a Demo
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-2 font-bold">7-day free trial • Cancel anytime</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
