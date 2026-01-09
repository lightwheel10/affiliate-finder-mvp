/**
 * =============================================================================
 * LOGO MARQUEE - NEO-BRUTALIST
 * =============================================================================
 * 
 * Last Updated: January 9th, 2026
 * 
 * Displays a scrolling marquee of trusted brand names in the Logo Cloud section.
 * 
 * CHANGELOG:
 * - January 9th, 2026: Updated to neo-brutalist design
 *   - Bold typography (font-black uppercase)
 *   - Tighter spacing
 * 
 * =============================================================================
 */

import React from 'react';

export const LogoMarquee = () => {
  const logos = [
    "SaaS Master", "TechFlow", "Growth.io", "ScaleUp", "Founders Inc", 
    "IndieHackers", "ProductHunt", "Y Combinator", "TechCrunch"
  ];
  
  return (
    // NEO-BRUTALIST: Simplified styling (January 9th, 2026)
    <div className="relative w-full overflow-hidden mask-linear-fade py-6 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
      <div className="flex w-max animate-marquee gap-12">
        {[...logos, ...logos].map((logo, i) => (
          // NEO-BRUTALIST: Bold uppercase typography (January 9th, 2026)
          <span key={i} className="text-sm font-black text-slate-800 font-mono whitespace-nowrap uppercase tracking-wide">
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
};

