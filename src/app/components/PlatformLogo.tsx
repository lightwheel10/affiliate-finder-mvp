import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformLogoProps {
  platform: string;
  size?: number;
  className?: string;
  label?: string;
}

const PLATFORM_ASSETS: Readonly<Record<string, string>> = {
  instagram: '/platforms/instagram.svg',
  tiktok: '/platforms/tiktok.svg',
  youtube: '/platforms/youtube.svg',
};

export function getPlatformLogoAsset(platform: string): string | undefined {
  return PLATFORM_ASSETS[platform.trim().toLowerCase()];
}

/**
 * One visual source of truth for platform marks across the product.
 * Callers that use the mark as the only platform identifier provide `label`;
 * callers that already show the platform name leave it decorative.
 */
export function PlatformLogo({ platform, size = 16, className, label }: PlatformLogoProps) {
  const normalizedPlatform = platform.trim().toLowerCase();
  const asset = getPlatformLogoAsset(normalizedPlatform);
  const accessibilityProps = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };

  if (!asset) {
    return (
      <Globe2
        {...accessibilityProps}
        size={size}
        strokeWidth={2}
        className={cn('shrink-0 text-blue-500', className)}
      />
    );
  }

  if (normalizedPlatform === 'tiktok') {
    return (
      <span
        {...accessibilityProps}
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="block size-full">
          <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      {...accessibilityProps}
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Bundled SVGs are tiny, immutable UI marks; an optimized image request
          would add runtime work without improving these vector assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset}
        alt=""
        width={size}
        height={size}
        className="block size-full object-contain"
      />
    </span>
  );
}
