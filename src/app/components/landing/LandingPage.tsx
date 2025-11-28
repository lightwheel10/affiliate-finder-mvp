'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Sparkles,
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
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      
      {/* Background Texture */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-[0.03]" />

      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 py-2' : 'bg-transparent border-transparent py-3 md:py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight z-50">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
              <Sparkles size={12} fill="currentColor" className="text-blue-400 sm:w-[14px] sm:h-[14px]" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 truncate">Affiliate Finder</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1 bg-white/50 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-200/60 shadow-sm">
            {['Product', 'Solutions', 'Pricing', 'Company'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm rounded-full transition-all"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLoginClick}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              Log in
            </button>
            <button
              onClick={onLoginClick}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-none"
            >
              Start Free Trial
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden z-50 p-2 -mr-2 hover:bg-slate-100 rounded-lg transition-colors active:bg-slate-200"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 bottom-0 w-[280px] bg-white shadow-2xl z-40 md:hidden overflow-y-auto"
          >
            <div className="pt-20 px-6 pb-6 flex flex-col h-full">
              {/* Navigation Links */}
              <nav className="space-y-1 mb-8">
                {['Product', 'Solutions', 'Pricing', 'Company'].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-all active:bg-slate-100"
                  >
                    {item}
                  </a>
                ))}
              </nav>

              {/* CTA Buttons */}
              <div className="mt-auto space-y-3 pt-6 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full px-4 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:bg-slate-100"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full px-4 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:shadow-none"
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Hero Section */}
      <section className="pt-20 pb-12 sm:pt-24 sm:pb-16 md:pt-36 md:pb-24 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">

          {/* Hero Content */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-[10px] sm:text-[11px] font-medium text-slate-600 mb-4 sm:mb-6 cursor-default hover:border-blue-300 transition-colors">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                v2.0 is now live
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1]">
                Scout affiliates <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">faster than humanly possible.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 mb-6 sm:mb-8 leading-relaxed max-w-md">
                Automate your recruitment pipeline. Find, vet, and contact high-converting creators in seconds—not days.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={onLoginClick}
                  className="w-full sm:w-auto px-6 py-3 sm:py-3 min-h-[48px] bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 active:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group touch-manipulation"
                >
                  Start Scouting
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-white text-slate-700 text-sm font-bold rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition-all shadow-sm flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Play size={14} fill="currentColor" className="opacity-50" />
                  View Demo
                </button>
              </div>

              <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row items-start xs:items-center gap-3 text-xs text-slate-500 font-medium">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                   <div className="flex text-yellow-400">
                     {[1,2,3,4,5].map(i => <Star key={i} size={11} fill="currentColor" className="sm:w-3 sm:h-3" />)}
                   </div>
                   <span className="text-slate-700 ml-1">500+ active teams</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual */}
          <div className="relative lg:h-[480px] flex items-center justify-center scale-95 sm:scale-90 origin-center">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/40 to-purple-100/40 rounded-full blur-3xl animate-blob mix-blend-multiply"></div>
             <InteractiveSearchDemo />
          </div>

        </div>
      </section>

      {/* Logo Cloud */}
      <section className="border-y border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Trusted by market leaders</span>
          <div className="scale-75 sm:scale-90 origin-center sm:origin-right w-full sm:w-auto overflow-hidden">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* Feature Grid - The Real Linear Bento */}
      <section id="features" className="py-12 sm:py-16 md:py-20 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
           <div className="mb-10 sm:mb-12 md:mb-16 max-w-2xl">
             <h2 className="text-2xl sm:text-2xl md:text-3xl font-bold text-slate-900 mb-3 sm:mb-4 tracking-tight">Everything you need to scale.</h2>
             <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
               We've stripped away the complexity of traditional affiliate tools. No more spreadsheets, no more manual vetting. Just results.
             </p>
           </div>

           <BentoGrid>
              {/* Large Main Feature */}
              <BentoCard 
                title="AI Discovery Engine"
                description="Our proprietary algorithms scan millions of data points across YouTube, TikTok, and Instagram to find creators who actually convert."
                className="md:col-span-2 md:row-span-2 bg-white border-slate-200"
                fade="bottom"
                graphic={<DiscoveryGraphic />}
              >
                <div className="mt-4 flex gap-2">
                  <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30">High Engagement</div>
                  <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">Verified Growth</div>
                </div>
              </BentoCard>

              {/* Standard Cards */}
              <BentoCard 
                title="Verified Emails"
                description="Direct access to personal and business addresses with 98% deliverability."
                graphic={<VerifiedEmailGraphic />}
              />

              <BentoCard 
                title="Smart Pipelines"
                description="Kanban-style tracking for your recruitment outreach."
                graphic={<PipelineGraphic />}
              />
           </BentoGrid>
        </div>
      </section>

      {/* "How it Works" Steps */}
      <section className="py-12 sm:py-16 md:py-20 border-t border-slate-200 bg-slate-50 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
           <div className="text-center mb-12 sm:mb-16 md:mb-24">
             <motion.h2
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 sm:mb-4 tracking-tight"
             >
               From search to signed in 3 steps.
             </motion.h2>
             <motion.p
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-slate-500 text-base sm:text-lg"
             >
               A streamlined workflow designed for high-growth teams.
             </motion.p>
           </div>

           <div className="space-y-12 sm:space-y-16 md:space-y-24">
             {[
               {
                 step: "01",
                 title: "Define your ideal partner",
                 desc: "Input your niche, competitors, or even a moodboard. Our AI understands context, not just keywords, to find creators that align with your brand values.",
                 image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426",
                 overlayTitle: "Niche Analysis",
                 overlaySubtitle: "Found 1,240 matches"
               },
               {
                 step: "02",
                 title: "Review matched profiles",
                 desc: "Get a curated list of creators with deep insights into their audience demographics, engagement quality, and past brand collaborations.",
                 image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2340",
                 overlayTitle: "High Engagement",
                 overlaySubtitle: "8.5% Avg. Engagement Rate"
               },
               {
                 step: "03",
                 title: "Automated outreach",
                 desc: "Connect your email and let our sequences handle the initial conversation. Personalized templates ensure high response rates while you sleep.",
                 image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=2664",
                 overlayTitle: "Outreach Sent",
                 overlaySubtitle: "Opened by creator • Just now"
               }
             ].map((item, idx) => (
               <motion.div
                 key={idx}
                 initial={{ opacity: 0, y: 40 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, margin: "-50px" }}
                 transition={{ duration: 0.7, delay: idx * 0.2 }}
                 className={`flex flex-col md:flex-row items-center gap-6 sm:gap-8 md:gap-12 lg:gap-20 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
               >
                  <div className="flex-1 space-y-4 sm:space-y-6">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-600 text-white text-base sm:text-lg font-bold font-mono shadow-lg shadow-blue-600/20 shrink-0">
                        {item.step}
                      </span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{item.title}</h3>
                    <p className="text-base sm:text-lg text-slate-500 leading-relaxed">{item.desc}</p>

                    <ul className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
                      {idx === 0 ? (
                        <>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>AI analyzes competitor affiliates and content themes</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Scan across YouTube, Instagram, TikTok, and blogs</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Filter by follower count, niche, and engagement rate</span>
                          </li>
                        </>
                      ) : idx === 1 ? (
                        <>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>View audience demographics and location data</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Track previous brand partnerships and sponsored content</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Score creators based on authenticity and conversion potential</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>AI-generated personalized pitch templates</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Automated follow-ups and response tracking</span>
                          </li>
                          <li className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span>Integration with Gmail, Outlook, and custom SMTP</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div className="flex-1 w-full">
                    <div className="relative group">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${idx % 2 === 0 ? 'from-blue-100 to-violet-100' : 'from-orange-100 to-rose-100'} rounded-[2rem] opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-xl sm:shadow-2xl border border-slate-200/60 aspect-[16/10] sm:aspect-[4/3] transform sm:group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="absolute inset-0 bg-slate-900/0 sm:group-hover:bg-slate-900/0 transition-colors duration-500" />
                        <img src={item.image} alt={item.title} className="object-cover w-full h-full" loading="lazy" />

                        {/* Floating Elements Overlay */}
                        <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 p-3 sm:p-4 bg-white/90 backdrop-blur-md rounded-lg sm:rounded-xl border border-white/20 shadow-lg transform translate-y-2 opacity-0 sm:translate-y-4 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                              <Sparkles size={12} className="sm:w-[14px] sm:h-[14px]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">{item.overlayTitle}</div>
                              <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{item.overlaySubtitle}</div>
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

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-[#D1FAE5] border border-[#A7F3D0] text-[10px] sm:text-[11px] font-bold text-[#065F46] mb-3 sm:mb-4">
                <Zap size={10} fill="currentColor" className="sm:w-3 sm:h-3" />
                SIMPLE PRICING
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 sm:mb-4 tracking-tight px-4">
                Start free. Scale when ready.
              </h2>
              <p className="text-slate-500 text-sm sm:text-base md:text-lg max-w-xl mx-auto px-4">
                No hidden fees. No credit card required. Cancel anytime.
              </p>
            </motion.div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Pro Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="relative rounded-xl sm:rounded-2xl bg-white border border-[#0EA5E9] shadow-xl shadow-blue-100/50 flex flex-col overflow-hidden"
            >
              {/* Popular Badge */}
              <div className="bg-[#0F4C5C] text-white text-[10px] sm:text-xs font-bold tracking-wider uppercase text-center py-2 flex items-center justify-center gap-1.5">
                <Zap size={10} fill="currentColor" className="sm:w-3 sm:h-3" />
                Most Popular
              </div>

              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="text-center mb-5 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">Pro</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 min-h-[32px] sm:h-8 flex items-center justify-center px-2 sm:px-4 leading-tight">For serious affiliate program growth</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0F4C5C]">$99</span>
                    <span className="text-sm sm:text-base font-serif italic text-[#0EA5E9]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 min-h-[48px] rounded-full text-xs sm:text-sm font-semibold mb-5 sm:mb-6 transition-all duration-200 bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] active:bg-[#A7F3D0] border border-[#A7F3D0] shadow-sm hover:shadow-md touch-manipulation"
                >
                  Start 7-day free trial
                </button>

                <div className="space-y-2.5 sm:space-y-3 flex-1">
                  {[
                    'Unlimited Affiliate Discovery',
                    '150 Verified Emails/month',
                    '150 AI Outreach Emails',
                    'Advanced Search & Filtering',
                    '2 Team Seats',
                    'Priority Support'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 sm:gap-2.5">
                      <div className="mt-0.5 w-3.5 h-3.5 rounded-full bg-[#0F4C5C] text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 size={8} strokeWidth={3} />
                      </div>
                      <span className="text-[11px] sm:text-xs leading-relaxed text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Business Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="text-center mb-5 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">Business</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 min-h-[32px] sm:h-8 flex items-center justify-center px-2 sm:px-4 leading-tight">For teams managing multiple programs</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900">$249</span>
                    <span className="text-sm sm:text-base font-serif italic text-[#0F4C5C]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 min-h-[48px] rounded-full text-xs sm:text-sm font-semibold mb-5 sm:mb-6 transition-all duration-200 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-sm hover:shadow-md touch-manipulation"
                >
                  Start 7-day free trial
                </button>

                <div className="space-y-2.5 sm:space-y-3 flex-1">
                  {[
                    'Everything in Pro +',
                    '500 Verified Emails/month',
                    '5 Brands',
                    '5 Team Seats',
                    'Advanced Analytics',
                    'Dedicated Account Manager'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 sm:gap-2.5">
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#0F4C5C] text-white'}`}>
                        {idx !== 0 && <CheckCircle2 size={8} strokeWidth={3} />}
                      </div>
                      <span className={`text-[11px] sm:text-xs leading-relaxed ${idx === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="text-center mb-5 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">Enterprise</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 min-h-[32px] sm:h-8 flex items-center justify-center px-2 sm:px-4 leading-tight">For large organizations with custom requirements</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900">Custom</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 min-h-[48px] rounded-full text-xs sm:text-sm font-semibold mb-5 sm:mb-6 transition-all duration-200 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-sm hover:shadow-md touch-manipulation"
                >
                  Let's Talk
                </button>

                <div className="space-y-2.5 sm:space-y-3 flex-1">
                  {[
                    'Everything in Business +',
                    'Unlimited Verified Emails',
                    'Unlimited Brands',
                    'Unlimited Team Access',
                    'Custom AI Training',
                    'API Access & Webhooks'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 sm:gap-2.5">
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#0F4C5C] text-white'}`}>
                        {idx !== 0 && <CheckCircle2 size={8} strokeWidth={3} />}
                      </div>
                      <span className={`text-[11px] sm:text-xs leading-relaxed ${idx === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Trust Note */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-sm text-slate-500 mt-8"
          >
            💳 No credit card required • Cancel anytime • 30-day money-back guarantee
          </motion.p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6">
         <div className="max-w-4xl mx-auto bg-slate-900 rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl"></div>

            <div className="relative z-10 space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white tracking-tight px-4">
                Ready to scale your revenue?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl mx-auto px-4">
                Join 2,000+ modern brands using Affiliate Finder AI to build their dream partner network.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                <button
                  onClick={onLoginClick}
                  className="px-6 py-3 min-h-[48px] bg-white text-slate-900 text-sm sm:text-base font-bold rounded-lg sm:rounded-xl hover:bg-blue-50 active:bg-blue-50 transition-colors w-full sm:w-auto shadow-xl touch-manipulation"
                >
                  Get Started for Free
                </button>
                <button className="px-6 py-3 min-h-[48px] bg-transparent border border-slate-700 text-white text-sm sm:text-base font-bold rounded-lg sm:rounded-xl hover:bg-slate-800 active:bg-slate-800 transition-colors w-full sm:w-auto touch-manipulation">
                  Talk to Sales
                </button>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 pt-2">No credit card required • 14-day free trial</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
