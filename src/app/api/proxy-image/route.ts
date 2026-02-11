import { NextRequest, NextResponse } from 'next/server';

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

    // Validate URL is from allowed domains
    const allowedDomains = [
      'cdninstagram.com',
      'instagram.com',
      'fbcdn.net', // Instagram also uses Facebook CDN
      'tiktokcdn.com',
      'tiktok.com',
      'ggpht.com', // YouTube
      'ytimg.com', // YouTube
      'googleusercontent.com',
    ];

    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Security fix: Use exact match or proper subdomain check to prevent SSRF bypass
    // e.g. "instagram.com.evil.com" no longer passes the check
    const isAllowed = allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // Fetch the image server-side
    const response = await fetch(imageUrl, {
      headers: {
        // Mimic a browser request
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': url.origin,
      },
      // Set a timeout - use 8 seconds for Vercel serverless functions
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      // Return a transparent 1x1 pixel as fallback
      return new NextResponse(
        Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
        {
          status: 200,
          headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'public, max-age=60',
          },
        }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.arrayBuffer();

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', // Cache for 1 day
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image proxy error:', errorMessage);
    
    // Return a transparent 1x1 pixel as fallback instead of error
    return new NextResponse(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
      {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  }
}

