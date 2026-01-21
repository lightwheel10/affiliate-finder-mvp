/**
 * =============================================================================
 * THEME SWITCHER COMPONENT
 * =============================================================================
 *
 * Created: January 22nd, 2026
 * Updated: January 22nd, 2026 - Smooth orbital spin animation
 *
 * A toggle button component for switching between light and dark mode.
 * Uses an elegant spinning animation inspired by popular theme toggles.
 *
 * ANIMATION:
 * ----------
 * - Sun rotates with animated rays that expand/contract
 * - Moon slides in with a smooth arc motion
 * - Whole toggle spins during transition
 *
 * =============================================================================
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Monitor } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface ThemeSwitcherProps {
  variant?: 'sidebar' | 'navbar' | 'minimal' | 'compact';
  className?: string;
}

// =============================================================================
// ANIMATED SUN/MOON ICON COMPONENT
// =============================================================================

const ThemeIcon = ({ isDark, size = 16 }: { isDark: boolean; size?: number }) => {
  const sunRays = 8;
  
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Smooth 360° rotation during transition
      animate={{ rotate: isDark ? 360 : 0 }}
      transition={{ 
        duration: 0.8, 
        ease: [0.4, 0, 0.2, 1] // Custom cubic-bezier for buttery smooth feel
      }}
    >
      {/* Sun core / Moon body */}
      <motion.circle
        cx="12"
        cy="12"
        r="5"
        fill="currentColor"
        initial={false}
        animate={{
          r: isDark ? 5 : 5,
        }}
        transition={{ 
          duration: 0.6, 
          ease: [0.4, 0, 0.2, 1]
        }}
      />
      
      {/* Moon shadow overlay (creates crescent effect) */}
      <motion.circle
        cx="15"
        cy="9"
        r="4"
        fill="currentColor"
        className="text-white dark:text-gray-900"
        initial={false}
        animate={{
          // Smooth slide: shadow moves in for moon, slides out for sun
          x: isDark ? 0 : 10,
          y: isDark ? 0 : -2,
          opacity: isDark ? 1 : 0,
          scale: isDark ? 1 : 0.5,
        }}
        transition={{ 
          duration: 0.6, 
          ease: [0.4, 0, 0.2, 1],
          opacity: { duration: 0.4 }
        }}
      />
      
      {/* Sun rays - smooth staggered animation */}
      {[...Array(sunRays)].map((_, i) => {
        const angle = (i * 360) / sunRays;
        const x1 = 12 + Math.cos((angle * Math.PI) / 180) * 8;
        const y1 = 12 + Math.sin((angle * Math.PI) / 180) * 8;
        const x2 = 12 + Math.cos((angle * Math.PI) / 180) * 11;
        const y2 = 12 + Math.sin((angle * Math.PI) / 180) * 11;
        
        return (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            initial={false}
            animate={{
              // Rays contract for moon, expand for sun
              scale: isDark ? 0 : 1,
              opacity: isDark ? 0 : 1,
            }}
            transition={{ 
              duration: 0.5, 
              // Staggered delay creates a wave effect
              delay: isDark ? i * 0.02 : i * 0.04,
              ease: [0.4, 0, 0.2, 1]
            }}
            style={{ transformOrigin: `${x1}px ${y1}px` }}
          />
        );
      })}
    </motion.svg>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'sidebar',
  className,
}) => {
  const { theme, setTheme, toggleTheme, isDark, isLoading } = useTheme();

  if (isLoading) {
    return null;
  }

  // =========================================================================
  // SIDEBAR VARIANT
  // =========================================================================
  if (variant === 'sidebar') {
    return (
      <div className={cn(
        "flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700",
        className
      )}>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <ThemeIcon isDark={isDark} size={12} />
          <span>Theme</span>
        </div>
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-700">
          {[
            { key: 'light', icon: <ThemeIcon isDark={false} size={12} /> },
            { key: 'dark', icon: <ThemeIcon isDark={true} size={12} /> },
            { key: 'system', icon: <Monitor size={12} /> },
          ].map(({ key, icon }) => (
            <motion.button
              key={key}
              onClick={() => setTheme(key as 'light' | 'dark' | 'system')}
              className={cn(
                "p-1.5 transition-colors",
                theme === key
                  ? "bg-[#ffbf23] text-black border border-black"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}
              whileTap={{ scale: 0.9 }}
              aria-label={`${key} mode`}
              title={key.charAt(0).toUpperCase() + key.slice(1)}
            >
              {icon}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // NAVBAR VARIANT - Smooth spinning toggle
  // =========================================================================
  if (variant === 'navbar') {
    return (
      <motion.button
        onClick={toggleTheme}
        className={cn(
          "relative p-2 border-2 border-gray-200 dark:border-gray-700",
          "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md",
          "text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white",
          "hover:bg-[#ffbf23]/20 hover:border-[#ffbf23]",
          "transition-colors overflow-hidden",
          className
        )}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        <ThemeIcon isDark={isDark} size={16} />
      </motion.button>
    );
  }

  // =========================================================================
  // COMPACT VARIANT - Just icons, no label, for tight spaces
  // January 22nd, 2026: Added for sidebar combined row
  // =========================================================================
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-700", className)}>
        {[
          { key: 'light', icon: <ThemeIcon isDark={false} size={12} /> },
          { key: 'dark', icon: <ThemeIcon isDark={true} size={12} /> },
        ].map(({ key, icon }) => (
          <motion.button
            key={key}
            onClick={() => setTheme(key as 'light' | 'dark')}
            className={cn(
              "p-1.5 transition-colors",
              theme === key || (theme === 'system' && key === (isDark ? 'dark' : 'light'))
                ? "bg-[#ffbf23] text-black border border-black"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            whileTap={{ scale: 0.9 }}
            aria-label={`${key} mode`}
            title={key.charAt(0).toUpperCase() + key.slice(1)}
          >
            {icon}
          </motion.button>
        ))}
      </div>
    );
  }

  // =========================================================================
  // MINIMAL VARIANT
  // =========================================================================
  return (
    <motion.button
      onClick={toggleTheme}
      className={cn(
        "flex items-center justify-center w-8 h-8 overflow-hidden",
        "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
        "border-2 border-gray-200 dark:border-gray-700 hover:border-[#ffbf23]",
        "transition-colors",
        className
      )}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <ThemeIcon isDark={isDark} size={14} />
    </motion.button>
  );
};

export default ThemeSwitcher;
