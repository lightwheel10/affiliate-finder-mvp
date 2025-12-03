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
  Play,
  Target,
  Radar
} from 'lucide-react';

// Selecdoo "S" Logo Icon
const SelecdooIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
  >
    <path 
      d="M12 4C8.5 4 6 6 6 8.5C6 11 8 12.5 12 13.5C16 14.5 18 16 18 18.5C18 21 15.5 23 12 23C8.5 23 6 21 6 18.5M12 1V4M12 23V20" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);
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

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-[#111827] selection:bg-[#D4E815]/30 selection:text-[#1A1D21] overflow-x-hidden">
      
      {/* Background Texture */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-[0.03]" />

      {/* Navbar */}
      <nav 
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 py-2.5' : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight z-50">
            <div className="w-7 h-7 bg-[#1A1D21] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#1A1D21]/20">
              <SelecdooIcon size={14} className="text-[#D4E815]" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#111827] to-[#333333]">CrewCast Studio</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1 bg-white/50 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-200/60 shadow-sm">
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
                className="px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm rounded-full transition-all"
              >
                {item.label}
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
              onClick={onSignupClick}
              className="px-4 py-2 bg-[#D4E815] text-[#1A1D21] text-xs font-semibold rounded-lg hover:bg-[#c5d913] transition-all shadow-lg shadow-[#D4E815]/30 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-none"
            >
              Start Free Trial
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden z-50 p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-lg">
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
                  className="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all text-left"
                >
                  Log in
                </button>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignupClick();
                  }}
                  className="w-full px-4 py-2.5 bg-[#D4E815] text-[#1A1D21] text-sm font-semibold rounded-lg hover:bg-[#c5d913] transition-all text-center"
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Hero Content */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4E815]/10 border border-[#D4E815]/30 shadow-sm text-[11px] font-medium text-[#1A1D21] mb-6 cursor-default hover:border-[#D4E815]/50 transition-colors">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4E815] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4E815]"></span>
                </span>
                Trusted by 1,300+ brands
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold text-[#111827] tracking-tight mb-6 leading-[1]">
                Find Affiliates Already <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4E815] to-[#a8bc10]">Promoting Your Competitors</span>
              </h1>

              <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-md">
                Get 500+ active affiliates with verified contacts in minutes. Stop wasting 20 hours a week on manual research. Land your first new partner in 7 days.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button 
                  onClick={onSignupClick}
                  className="w-full sm:w-auto px-6 py-3 bg-[#D4E815] text-[#1A1D21] text-sm font-bold rounded-lg hover:bg-[#c5d913] transition-all shadow-xl shadow-[#D4E815]/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                >
                  Try for Free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  className="w-full sm:w-auto px-6 py-3 bg-[#333333] text-white text-sm font-bold rounded-lg hover:bg-[#444444] transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Play size={14} fill="currentColor" className="opacity-50" />
                  Get a Demo
                </button>
              </div>

              <div className="mt-8 flex items-center gap-3 text-xs text-slate-500 font-medium">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                   <div className="flex text-yellow-400">
                     {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                   </div>
                   <span className="text-slate-700 ml-1">Loved by 1,300+ SaaS & e-commerce brands</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual */}
          <div className="relative lg:h-[480px] flex items-center justify-center scale-90 origin-center">
             <div className="absolute inset-0 bg-gradient-to-tr from-[#D4E815]/20 to-[#D4E815]/10 rounded-full blur-3xl animate-blob mix-blend-multiply"></div>
             <InteractiveSearchDemo />
          </div>

        </div>
      </section>

      {/* Logo Cloud */}
      <section className="border-y border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-8">Trusted by top brands</span>
          <div className="scale-90 origin-right">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* Feature Grid - The Real Linear Bento */}
      <section id="features" className="py-20 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6">
           <div className="mb-16 max-w-2xl">
             <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-4 tracking-tight">How Smart Brands 3X Their Affiliate Growth</h2>
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
                <div className="mt-4 flex gap-2">
                  <div className="px-3 py-1 rounded-full bg-[#D4E815]/20 text-[#1A1D21] text-xs font-medium border border-[#D4E815]/40">500+ Instant Matches</div>
                  <div className="px-3 py-1 rounded-full bg-[#1A1D21]/10 text-[#1A1D21] text-xs font-medium border border-[#1A1D21]/20">Weekly Fresh Leads</div>
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

      {/* "How it Works" Steps */}
      <section id="how-it-works" className="py-20 border-t border-[#E5E7EB] bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
           <div className="text-center mb-24">
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="text-3xl md:text-4xl font-bold text-[#111827] mb-4 tracking-tight"
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
                 image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426",
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
                 image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2340",
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
                 image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=2664",
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
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#D4E815] text-[#1A1D21] text-lg font-bold font-mono shadow-lg shadow-[#D4E815]/30">
                        {item.step}
                      </span>
                      <div className="h-px flex-1 bg-[#E5E7EB]"></div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-[#111827]">{item.title}</h3>
                    <p className="text-lg text-slate-500 leading-relaxed">{item.desc}</p>
                    
                    <ul className="space-y-3 pt-2">
                      {item.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#D4E815]"></div>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="relative group">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${idx % 2 === 0 ? 'from-[#D4E815]/20 to-[#D4E815]/10' : 'from-[#D4E815]/10 to-[#D4E815]/20'} rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60 aspect-[4/3] transform group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/0 transition-colors duration-500" />
                        <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
                        
                        {/* Floating Elements Overlay */}
                        <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/90 backdrop-blur-md rounded-xl border border-white/20 shadow-lg transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#D4E815]/20 flex items-center justify-center text-[#1A1D21]">
                              <SelecdooIcon size={14} className="text-[#1A1D21]" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-[#111827]">{item.overlayTitle}</div>
                              <div className="text-xs text-slate-500 font-medium">{item.overlaySubtitle}</div>
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
      <section id="pricing" className="py-20 px-6 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4E815]/20 border border-[#D4E815]/40 text-[11px] font-bold text-[#1A1D21] mb-4">
                <Zap size={12} fill="currentColor" />
                SIMPLE, TRANSPARENT PRICING
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4 tracking-tight">
                Find the Perfect Plan for Your Growth
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                All plans include weekly affiliate discovery to keep your pipeline full. 7-day free trial, no credit card required.
              </p>
            </motion.div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pro Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="relative rounded-2xl bg-white border-2 border-[#D4E815] shadow-xl shadow-[#D4E815]/20 flex flex-col overflow-hidden"
            >
              {/* Popular Badge */}
              <div className="bg-[#1A1D21] text-white text-xs font-bold tracking-wider uppercase text-center py-2 flex items-center justify-center gap-1.5">
                <Zap size={12} fill="currentColor" className="text-[#D4E815]" />
                Most Popular
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-[#111827] mb-1">Pro</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For growing SaaS & e-commerce brands</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-medium tracking-tight text-[#1A1D21]">$99</span>
                    <span className="text-base font-serif italic text-[#333333]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onSignupClick}
                  className="w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md"
                >
                  Start 7-Day Free Trial
                </button>

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
                      <div className="mt-0.5 w-3.5 h-3.5 rounded-full bg-[#1A1D21] text-[#D4E815] flex items-center justify-center shrink-0">
                        <CheckCircle2 size={8} strokeWidth={3} />
                      </div>
                      <span className="text-xs leading-relaxed text-slate-600">{feature}</span>
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
              className="relative rounded-2xl bg-white border border-[#E5E7EB] shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-[#111827] mb-1">Growth</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For agencies & multi-brand companies</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-medium tracking-tight text-[#111827]">$249</span>
                    <span className="text-base font-serif italic text-[#333333]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onSignupClick}
                  className="w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 bg-[#333333] text-white hover:bg-[#444444] shadow-sm hover:shadow-md"
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
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#D4E815]'}`}>
                        {idx !== 0 && <CheckCircle2 size={8} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-semibold text-[#111827]' : 'text-slate-600'}`}>{feature}</span>
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
              className="relative rounded-2xl bg-white border border-[#E5E7EB] shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Spacer to align with Pro card's badge */}
              <div className="h-[34px]" />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-[#111827] mb-1">Enterprise</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For large organizations with custom needs</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-medium tracking-tight text-[#111827]">Custom</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 bg-white text-[#111827] border border-[#E5E7EB] hover:bg-slate-50 shadow-sm hover:shadow-md"
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
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-transparent' : 'bg-[#1A1D21] text-[#D4E815]'}`}>
                        {idx !== 0 && <CheckCircle2 size={8} strokeWidth={3} />}
                      </div>
                      <span className={`text-xs leading-relaxed ${idx === 0 ? 'font-semibold text-[#111827]' : 'text-slate-600'}`}>{feature}</span>
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
      <section className="py-20 px-6">
         <div className="max-w-4xl mx-auto bg-[#1A1D21] rounded-[2rem] p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#D4E815]/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#D4E815]/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                Ready to Find Your Perfect Affiliates?
              </h2>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Join 1,300+ brands that have found their ideal affiliate partners in minutes, not months.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button 
                  onClick={onSignupClick}
                  className="px-6 py-3 bg-[#D4E815] text-[#1A1D21] text-base font-bold rounded-xl hover:bg-[#c5d913] transition-colors w-full sm:w-auto shadow-xl"
                >
                  Start Your 7-Day Free Trial
                </button>
                <button className="px-6 py-3 bg-transparent border border-slate-600 text-white text-base font-bold rounded-xl hover:bg-white/10 transition-colors w-full sm:w-auto">
                  Get a Demo
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-2">No credit card required • Cancel anytime</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
