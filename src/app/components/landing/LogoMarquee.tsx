/**
 * =============================================================================
 * LOGO MARQUEE — "SMOOVER" REFRESH
 * =============================================================================
 *
 * Last Updated: April 23rd, 2026
 *
 * Displays a scrolling marquee of trusted platform names in the Logo Cloud
 * section of the landing page.
 *
 * CHANGELOG:
 * - April 23rd, 2026: Softened typography as part of landing page refresh.
 *   Was: font-black uppercase, hard slate-800. Now: font-semibold with
 *   looser tracking and the softer muted slate #8898aa — reads like a
 *   refined "used by" strip rather than a heavy industrial stamp.
 *
 * - January 13th, 2026: Updated to platform logos (Serper, OpenAI, YouTube,
 *   Instagram, TikTok, Lusha) and tighter spacing.
 *
 * - January 9th, 2026: Neo-brutalist pass (font-black uppercase).
 *
 * =============================================================================
 */

import React from 'react';

export const LogoMarquee = () => {
  // Platform logos (January 13th, 2026)
  const logos = [
    "Serper", "OpenAI", "YouTube", "Instagram", "TikTok", "Lusha"
  ];

  return (
    // April 23rd, 2026: Softer opacity + gentle grayscale hover.
    <div className="relative w-full overflow-hidden mask-linear-fade py-6 opacity-80 grayscale hover:grayscale-0 transition-all duration-500">
      <div className="flex w-max animate-marquee gap-12">
        {[...logos, ...logos].map((logo, i) => (
          // April 23rd, 2026: font-semibold + #8898aa muted + wider tracking.
          <span
            key={i}
            className="text-sm font-semibold text-[#8898aa] dark:text-gray-400 font-mono whitespace-nowrap uppercase tracking-[0.18em]"
          >
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
};

