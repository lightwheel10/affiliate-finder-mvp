import React from 'react';
import { Sparkles, Globe, Users, Twitter, Linkedin, Github } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-4">
              <Sparkles size={16} className="text-blue-600" fill="currentColor" />
              <span>Affiliate Finder</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mb-6">
              The new standard for affiliate discovery. Powered by AI, designed for humans.
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
            <h4 className="font-bold text-slate-900 text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#features" className="hover:text-blue-600 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">API</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">About</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Customers</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Resources</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Guides</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <p className="text-[10px] text-slate-400">© 2025 Affiliate Finder AI Inc. All rights reserved.</p>
             <span className="hidden md:block text-[10px] text-slate-300">•</span>
             <p className="text-[10px] text-slate-400">Made by Spectrum AI Labs</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
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

