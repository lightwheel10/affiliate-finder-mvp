import React from 'react';
import Link from 'next/link';
import { Globe, Users } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-[#111827] mb-4">
              <img 
                src="/logo.jpg" 
                alt="CrewCast Studio" 
                className="w-6 h-6 rounded-md object-cover"
              />
              <span>CrewCast Studio</span>
            </Link>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs">
              The new standard for affiliate discovery. Backed by selecdoo AI.
              Helping brands scale their partner networks 10x faster.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#features" className="hover:text-[#1A1D21] transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#1A1D21] transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><Link href="/privacy" className="hover:text-[#1A1D21] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[#1A1D21] transition-colors">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-[#1A1D21] transition-colors">Cookie Policy</Link></li>
              <li><Link href="/security" className="hover:text-[#1A1D21] transition-colors">Security</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-[#E5E7EB] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <p className="text-[10px] text-slate-400">© 2025 CrewCast Studio. All rights reserved.</p>
             <span className="hidden md:block text-[10px] text-slate-300">•</span>
             <a href="https://www.spectrumailabs.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:text-[#D4E815] transition-colors">Made by Spectrum AI Labs</a>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
              <div className="w-2 h-2 rounded-full bg-[#D4E815]"></div>
              All systems operational
            </div>
            <div className="flex gap-4">
              <Globe size={14} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              <Users size={14} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

