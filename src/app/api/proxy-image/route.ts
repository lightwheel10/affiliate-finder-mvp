import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import {
  BoundedImageDownloadError,
  downloadBoundedImage,
  isAllowedHttpsImageUrl,
} from '@/lib/network/bounded-image';

const ALLOWED_IMAGE_HOSTS = [
  'cdninstagram.com',
  'instagram.com',
  'fbcdn.net',
  'tiktokcdn.com',
  'tiktok.com',
  'ggpht.com',
  'ytimg.com',
  'googleusercontent.com',
] as const;

const PROXY_IMAGE_LIMITS = Object.freeze({
  maxBytes: 8 * 1_024 * 1_024,
  maxRedirects: 3,
  timeoutMs: 8_000,
});

const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function fallbackImageResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

/**
 * Image Proxy API
 * 
 * Proxies images from Instagram/TikTok CDNs to avoid CORS issues.
 * These platforms block direct cross-origin image loading.
 * 
 * Usage: /api/proxy-image?url=<encoded_image_url>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!isAllowedHttpsImageUrl(url.href, ALLOWED_IMAGE_HOSTS)) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // This shares the same process-level concurrency gate as permanent image
    // re-hosting. Redirects stay on approved HTTPS hosts, and both declared and
    // streamed response sizes are capped before bytes reach this response.
    const image = await downloadBoundedImage(imageUrl, {
      allowedHostSuffixes: ALLOWED_IMAGE_HOSTS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/png,image/gif,image/jpeg',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxBytes: PROXY_IMAGE_LIMITS.maxBytes,
      maxRedirects: PROXY_IMAGE_LIMITS.maxRedirects,
      timeoutMs: PROXY_IMAGE_LIMITS.timeoutMs,
    });

    // Return the image with appropriate headers
    return new NextResponse(Uint8Array.from(image.bytes), {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', // Cache for 1 day
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: unknown) {
    // Expected CDN expiry, size/type rejection and timeout use the fallback
    // quietly. Unexpected programming/runtime failures still reach the logs.
    if (!(error instanceof BoundedImageDownloadError)) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Image proxy error:', errorMessage);
    }
    return fallbackImageResponse();
  }
}

