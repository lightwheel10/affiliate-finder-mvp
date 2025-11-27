import React from 'react';

export const LogoMarquee = () => {
  const logos = [
    "SaaS Master", "TechFlow", "Growth.io", "ScaleUp", "Founders Inc", 
    "IndieHackers", "ProductHunt", "Y Combinator", "TechCrunch"
  ];
  
  return (
    <div className="relative w-full overflow-hidden mask-linear-fade py-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
      <div className="flex w-max animate-marquee gap-16">
        {[...logos, ...logos].map((logo, i) => (
          <span key={i} className="text-xl font-bold text-slate-800 font-mono whitespace-nowrap">
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
};

