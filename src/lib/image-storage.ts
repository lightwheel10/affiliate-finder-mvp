import 'server-only';
import { createHash } from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * =============================================================================
 * PERMANENT IMAGE HOSTING FOR SOCIAL CDN IMAGES
 * =============================================================================
 *
 * 2026-06-15 (paras): WHY THIS EXISTS
 * -----------------------------------
 * Instagram and TikTok hand us *signed* CDN image URLs (creator avatars + post/
 * video thumbnails) that carry an expiry baked into the query string
 * (Instagram: oe/oh, TikTok: x-expires/x-signature). After ~3-4 days the
 * signature expires, the URL 404s, and the dashboard renders an empty black
 * image. Until now we stored those raw expiring URLs straight into
 * discovered_affiliates / saved_affiliates and never refreshed them, so saved
 * creators went black and stayed black.
 *
 * THE FIX: at scrape time, download the image once (while the signed URL is
 * still valid) and re-host it in a PUBLIC Supabase Storage bucket, then store
 * that permanent URL instead. Supabase public URLs never expire, so the image
 * stays forever.
 *
 * SCOPE: only Instagram/TikTok CDN hosts are re-hosted. YouTube (banner.yt /
 * ytimg) and plain web images are already stable, so they pass through
 * untouched. Everything here is BEST-EFFORT: any download/upload failure
 * returns the ORIGINAL url, so image hosting can never block or break a scrape.
 * =============================================================================
 */

// Public bucket that holds the re-hosted images. Created on first use.
const BUCKET = 'affiliate-images';

// CDN hosts whose URLs are signed and expire. Matched against the exact host or
// any subdomain (e.g. "scontent-fra3-1.cdninstagram.com").
const EXPIRING_CDN_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net', // Instagram also serves images via the Facebook CDN
  'tiktokcdn.com',
  'tiktokcdn-us.com',
];

/**
 * True only for Instagram/TikTok CDN URLs that expire and therefore need
 * re-hosting. Returns false for empty values, non-URLs, already-permanent
 * Supabase URLs, YouTube avatars/thumbnails, and web images.
 */
export function needsRehosting(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return EXPIRING_CDN_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

// Attempt bucket creation at most once per warm serverless instance.
let bucketReady = false;

async function ensureBucket(
  supabase: ReturnType<typeof getSupabaseServerClient>
): Promise<void> {
  if (bucketReady) return;
  // Check first, then create only if missing. public:true so a plain <img src>
  // loads with no signing/expiry. The /exist/i guard covers the race where the
  // bucket is created between getBucket and createBucket.
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/exist/i.test(error.message)) {
      // A real failure (permissions/network): bubble up so the caller's
      // try/catch falls back to the original URL instead of assuming success.
      throw error;
    }
  }
  bucketReady = true;
}

// Map a content-type to a file extension for the stored object.
function extFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

// Deterministic storage path so the SAME source image always maps to the SAME
// object (upsert overwrites instead of accumulating duplicates). We hash the
// URL WITHOUT its query string, because the query holds the rotating signature
// while the path part identifies the actual asset.
function storagePathFor(parsed: URL, ext: string): string {
  const platform = parsed.hostname.includes('tiktok') ? 'tiktok' : 'instagram';
  const hash = createHash('sha1').update(parsed.origin + parsed.pathname).digest('hex');
  return `${platform}/${hash}.${ext}`;
}

/**
 * Download an Instagram/TikTok CDN image and re-host it in Supabase Storage,
 * returning a permanent public URL. For any non-social / already-permanent /
 * empty url, or on ANY failure, returns the input url unchanged (best-effort).
 */
export async function rehostImageIfNeeded(
  url?: string | null
): Promise<string | undefined> {
  if (!url || !needsRehosting(url)) return url ?? undefined;

  try {
    const parsed = new URL(url);
    const supabase = getSupabaseServerClient();
    await ensureBucket(supabase);

    // Fetch the live (still-valid) CDN image. Browser-like headers mirror the
    // proxy-image route so the CDN doesn't reject us; 8s timeout matches Vercel.
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: parsed.origin,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return url; // CDN already rejected/expired — keep the original

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = storagePathFor(parsed, extFor(contentType));

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (uploadError) return url;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || url;
  } catch {
    // Network/timeout/permission — never let image hosting break a scrape.
    return url;
  }
}
