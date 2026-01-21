/**
 * =============================================================================
 * LOGO MARQUEE - NEO-BRUTALIST
 * =============================================================================
 * 
 * Last Updated: January 13th, 2026
 * 
 * Displays a scrolling marquee of trusted platform names in the Logo Cloud section.
 * 
 * CHANGELOG:
 * - January 13th, 2026: Updated to show platform logos
 *   - Changed from brand names to platforms: Serper, OpenAI, YouTube, Instagram, TikTok, Lusha
 * 
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Bold typography (font-black uppercase)
 *   - Tighter spacing
 * 
 * =============================================================================
 */

import React from 'react';

export const LogoMarquee = () => {
  // Updated to platform names (January 13th, 2026)
  const logos = [
    "Serper", "OpenAI", "YouTube", "Instagram", "TikTok", "Lusha"
  ];
  
  // January 22nd, 2026: Added dark mode support
  return (
    // NEO-BRUTALIST: Simplified styling (January 9th, 2026) - Dark mode: January 22nd, 2026
    <div className="relative w-full overflow-hidden mask-linear-fade py-6 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
      <div className="flex w-max animate-marquee gap-12">
        {[...logos, ...logos].map((logo, i) => (
          // NEO-BRUTALIST: Bold uppercase typography (January 9th, 2026) - Dark mode: January 22nd, 2026
          <span key={i} className="text-sm font-black text-slate-800 dark:text-gray-200 font-mono whitespace-nowrap uppercase tracking-wide">
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
};

