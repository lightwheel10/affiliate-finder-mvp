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
              <Sparkles size={14} fill="currentColor" className="text-[#D4E815]" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#111827] to-[#333333]">Affiliate Finder</span>
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
                v2.0 is now live
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold text-[#111827] tracking-tight mb-6 leading-[1]">
                Scout affiliates <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4E815] to-[#a8bc10]">faster than humanly possible.</span>
              </h1>

              <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-md">
                Automate your recruitment pipeline. Find, vet, and contact high-converting creators in seconds—not days.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button 
                  onClick={onLoginClick}
                  className="w-full sm:w-auto px-6 py-3 bg-[#D4E815] text-[#1A1D21] text-sm font-bold rounded-lg hover:bg-[#c5d913] transition-all shadow-xl shadow-[#D4E815]/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                >
                  Start Scouting
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  className="w-full sm:w-auto px-6 py-3 bg-[#333333] text-white text-sm font-bold rounded-lg hover:bg-[#444444] transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Play size={14} fill="currentColor" className="opacity-50" />
                  View Demo
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
                   <span className="text-slate-700 ml-1">500+ active teams</span>
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-8">Trusted by market leaders</span>
          <div className="scale-90 origin-right">
            <LogoMarquee />
          </div>
        </div>
      </section>

      {/* Feature Grid - The Real Linear Bento */}
      <section id="features" className="py-20 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6">
           <div className="mb-16 max-w-2xl">
             <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-4 tracking-tight">Everything you need to scale.</h2>
             <p className="text-base text-slate-500 leading-relaxed">
               We've stripped away the complexity of traditional affiliate tools. No more spreadsheets, no more manual vetting. Just results.
             </p>
           </div>

           <BentoGrid>
              {/* Large Main Feature */}
              <BentoCard 
                title="AI Discovery Engine"
                description="Our proprietary algorithms scan millions of data points across YouTube, TikTok, and Instagram to find creators who actually convert."
                className="md:col-span-2 md:row-span-2 bg-white border-[#E5E7EB]"
                fade="bottom"
                graphic={<DiscoveryGraphic />}
              >
                <div className="mt-4 flex gap-2">
                  <div className="px-3 py-1 rounded-full bg-[#D4E815]/20 text-[#1A1D21] text-xs font-medium border border-[#D4E815]/40">High Engagement</div>
                  <div className="px-3 py-1 rounded-full bg-[#1A1D21]/10 text-[#1A1D21] text-xs font-medium border border-[#1A1D21]/20">Verified Growth</div>
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
      <section className="py-20 border-t border-[#E5E7EB] bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
           <div className="text-center mb-24">
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5 }}
               className="text-3xl md:text-4xl font-bold text-[#111827] mb-4 tracking-tight"
             >
               From search to signed in 3 steps.
             </motion.h2>
             <motion.p 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-slate-500 text-lg"
             >
               A streamlined workflow designed for high-growth teams.
             </motion.p>
           </div>

           <div className="space-y-24">
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
                      {[1, 2, 3].map((_, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#D4E815]"></div>
                          <span>Key feature point or benefit goes here</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="relative group">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${idx % 2 === 0 ? 'from-blue-100 to-violet-100' : 'from-orange-100 to-rose-100'} rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60 aspect-[4/3] transform group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/0 transition-colors duration-500" />
                        <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
                        
                        {/* Floating Elements Overlay */}
                        <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/90 backdrop-blur-md rounded-xl border border-white/20 shadow-lg transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#D4E815]/20 flex items-center justify-center text-[#1A1D21]">
                              <Sparkles size={14} />
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
                SIMPLE PRICING
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4 tracking-tight">
                Start free. Scale when ready.
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                No hidden fees. No credit card required. Cancel anytime.
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
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For serious affiliate program growth</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-medium tracking-tight text-[#1A1D21]">$99</span>
                    <span className="text-base font-serif italic text-[#333333]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md"
                >
                  Start 7-day free trial
                </button>

                <div className="space-y-3 flex-1">
                  {[
                    'Unlimited Affiliate Discovery',
                    '150 Verified Emails/month',
                    '150 AI Outreach Emails',
                    'Advanced Search & Filtering',
                    '2 Team Seats',
                    'Priority Support'
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
                  <h3 className="text-lg font-medium text-[#111827] mb-1">Business</h3>
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For teams managing multiple programs</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-medium tracking-tight text-[#111827]">$249</span>
                    <span className="text-base font-serif italic text-[#333333]">/month</span>
                  </div>
                </div>

                <button
                  onClick={onLoginClick}
                  className="w-full py-3 rounded-full text-sm font-semibold mb-6 transition-all duration-200 bg-[#333333] text-white hover:bg-[#444444] shadow-sm hover:shadow-md"
                >
                  Start 7-day free trial
                </button>

                <div className="space-y-3 flex-1">
                  {[
                    'Everything in Pro +',
                    '500 Verified Emails/month',
                    '5 Brands',
                    '5 Team Seats',
                    'Advanced Analytics',
                    'Dedicated Account Manager'
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
                  <p className="text-xs text-slate-500 mb-4 h-8 flex items-center justify-center px-4 leading-tight">For large organizations with custom requirements</p>
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
                    'Everything in Business +',
                    'Unlimited Verified Emails',
                    'Unlimited Brands',
                    'Unlimited Team Access',
                    'Custom AI Training',
                    'API Access & Webhooks'
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
                Ready to scale your revenue?
              </h2>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Join 2,000+ modern brands using Affiliate Finder AI to build their dream partner network.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button 
                  onClick={onLoginClick}
                  className="px-6 py-3 bg-[#D4E815] text-[#1A1D21] text-base font-bold rounded-xl hover:bg-[#c5d913] transition-colors w-full sm:w-auto shadow-xl"
                >
                  Get Started for Free
                </button>
                <button className="px-6 py-3 bg-transparent border border-slate-600 text-white text-base font-bold rounded-xl hover:bg-white/10 transition-colors w-full sm:w-auto">
                  Talk to Sales
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-2">No credit card required • 14-day free trial</p>
            </div>
         </div>
      </section>

      {/* Footer */}
      <Footer />

    </div>
  );
};
