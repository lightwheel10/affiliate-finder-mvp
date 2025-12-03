'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingOnboardingScreen = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F0F2F5] font-sans p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-sm p-6 text-center">
        
        {/* Animated Loader Icon */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Outer Glow Ring */}
          <div className="absolute inset-0 bg-[#D4E815]/20 rounded-full blur-xl animate-pulse" />
          
          {/* Middle Ring */}
          <div className="absolute inset-3 bg-[#D4E815]/30 rounded-full opacity-60" />
          
          {/* Inner Circle with Spinner */}
          <div className="relative w-12 h-12 bg-[#D4E815] rounded-full flex items-center justify-center shadow-inner">
             <Loader2 className="w-6 h-6 text-[#1A1D21] animate-spin" />
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-xl text-slate-900 font-medium tracking-tight mb-3">
          Creating your <span className="text-[#1A1D21] font-serif italic">space!</span>
        </h1>

        {/* Description Text */}
        <div className="space-y-2 max-w-sm mx-auto">
           <p className="text-slate-500 text-sm leading-relaxed">
            This may take up to 90 seconds before your first affiliates start loading.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            It can take up to 1-2 hours to finish finding all your potential affiliates, so grab a coffee, and come back to hundreds of perfect-fit partners.
          </p>
        </div>

      </div>
    </div>
  );
};

