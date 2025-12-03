import React from 'react';
import { Globe, Users, Twitter, Linkedin, Github } from 'lucide-react';

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

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-bold text-lg text-[#111827] mb-4">
              <div className="w-6 h-6 bg-[#1A1D21] rounded-md flex items-center justify-center">
                <SelecdooIcon size={14} className="text-[#D4E815]" />
              </div>
              <span>CrewCast Studio</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mb-6">
              The new standard for affiliate discovery. Backed by selecdoo AI.
              Helping brands scale their partner networks 10x faster.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                <Linkedin size={18} />
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                <Github size={18} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#features" className="hover:text-[#1A1D21] transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#1A1D21] transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">API</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">About</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Customers</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Resources</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Guides</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#111827] text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-[#1A1D21] transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-[#E5E7EB] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <p className="text-[10px] text-slate-400">© 2025 CrewCast Studio. All rights reserved.</p>
             <span className="hidden md:block text-[10px] text-slate-300">•</span>
             <p className="text-[10px] text-slate-400">Backed by selecdoo AI</p>
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

