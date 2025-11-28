import React from 'react';
import { Sparkles, Globe, Users, Twitter, Linkedin, Github } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200 pt-12 sm:pt-14 md:pt-16 pb-6 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-6 gap-6 sm:gap-8 mb-8 sm:mb-10 md:mb-12">
          <div className="col-span-1 xs:col-span-2">
            <div className="flex items-center gap-2 font-bold text-base sm:text-lg text-slate-900 mb-3 sm:mb-4">
              <Sparkles size={14} className="text-blue-600 sm:w-4 sm:h-4" fill="currentColor" />
              <span>Affiliate Finder</span>
            </div>
            <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed max-w-xs mb-4 sm:mb-6">
              The new standard for affiliate discovery. Powered by AI, designed for humans.
              Helping brands scale their partner networks 10x faster.
            </p>
            <div className="flex gap-3 sm:gap-4">
              <a href="#" className="p-2 text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:bg-slate-100 touch-manipulation" aria-label="Twitter">
                <Twitter size={16} className="sm:w-[18px] sm:h-[18px]" />
              </a>
              <a href="#" className="p-2 text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:bg-slate-100 touch-manipulation" aria-label="LinkedIn">
                <Linkedin size={16} className="sm:w-[18px] sm:h-[18px]" />
              </a>
              <a href="#" className="p-2 text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:bg-slate-100 touch-manipulation" aria-label="GitHub">
                <Github size={16} className="sm:w-[18px] sm:h-[18px]" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-3 sm:mb-4">Product</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs text-slate-500">
              <li><a href="#features" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Features</a></li>
              <li><a href="#pricing" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Pricing</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">API</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Integrations</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-3 sm:mb-4">Company</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs text-slate-500">
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">About</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Blog</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Careers</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Customers</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-3 sm:mb-4">Resources</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs text-slate-500">
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Documentation</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Community</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Help Center</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Guides</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-3 sm:mb-4">Legal</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs text-slate-500">
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Privacy Policy</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Terms of Service</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Cookie Policy</a></li>
              <li><a href="#" className="block py-1 hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-6 sm:pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-4 text-center md:text-left">
             <p className="text-[9px] sm:text-[10px] text-slate-400">© 2025 Affiliate Finder AI Inc. All rights reserved.</p>
             <span className="hidden md:block text-[10px] text-slate-300">•</span>
             <p className="text-[9px] sm:text-[10px] text-slate-400">Made by Spectrum AI Labs</p>
          </div>
          <div className="flex flex-col xs:flex-row items-center gap-3 sm:gap-4 md:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-slate-500 font-medium">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></div>
              All systems operational
            </div>
            <div className="flex gap-3 sm:gap-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:bg-slate-100 touch-manipulation" aria-label="Change language">
                <Globe size={12} className="sm:w-[14px] sm:h-[14px]" />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:bg-slate-100 touch-manipulation" aria-label="User settings">
                <Users size={12} className="sm:w-[14px] sm:h-[14px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

