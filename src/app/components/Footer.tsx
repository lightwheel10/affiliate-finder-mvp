/**
 * =============================================================================
 * Footer Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * =============================================================================
 */

import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-white dark:bg-[#0a0a0a] border-t-4 border-black dark:border-gray-700 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Section */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-black text-lg text-gray-900 dark:text-white mb-4 uppercase">
              <img 
                src="/logo.jpg" 
                alt="CrewCast Studio" 
                className="w-7 h-7 border-2 border-black dark:border-gray-600 object-cover"
              />
              <span>CrewCast Studio</span>
            </Link>
            <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
              The new standard for affiliate discovery. Backed by selecdoo AI.
              Helping brands scale their partner networks 10x faster.
            </p>
          </div>
          
          {/* Product Links */}
          <div>
            <h4 className="font-black text-gray-900 dark:text-white text-sm mb-4 uppercase">Product</h4>
            <ul className="space-y-2.5 text-xs text-gray-500">
              <li><a href="#features" className="hover:text-black dark:hover:text-white transition-colors font-medium">Features</a></li>
              <li><a href="#pricing" className="hover:text-black dark:hover:text-white transition-colors font-medium">Pricing</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-black text-gray-900 dark:text-white text-sm mb-4 uppercase">Legal</h4>
            <ul className="space-y-2.5 text-xs text-gray-500">
              <li><Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors font-medium">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors font-medium">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-black dark:hover:text-white transition-colors font-medium">Cookie Policy</Link></li>
              <li><Link href="/security" className="hover:text-black dark:hover:text-white transition-colors font-medium">Security</Link></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar - NEO-BRUTALIST */}
        <div className="pt-8 border-t-2 border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <p className="text-[10px] text-gray-400 font-medium">© 2025 CrewCast Studio. All rights reserved.</p>
             <span className="hidden md:block text-[10px] text-gray-300">•</span>
             <a href="https://www.spectrumailabs.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-[#ffbf23] transition-colors font-medium">Made by Spectrum AI Labs</a>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold">
            <div className="w-2 h-2 bg-[#ffbf23] border border-black"></div>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
};
