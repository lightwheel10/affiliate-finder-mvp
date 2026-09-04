import 'server-only';
import { createHash } from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  BOUNDED_IMAGE_MAX_CONCURRENCY,
  createConcurrencyLimiter,
  downloadBoundedImage,
  isAllowedHttpsImageUrl,
} from '@/lib/network/bounded-image';

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

// Production/staging storage evidence on 2026-09-04 showed a 1.65 MB p99 and
// a 5.46 MB maximum across 7,115 inspected objects. Eight MiB preserves every
// observed legitimate image while making memory use finite. The shared gate is
// deliberately below caller batch sizes, so manual, saved and weekly flows all
// obey the same process-level resource boundary.
export const IMAGE_REHOST_LIMITS = Object.freeze({
  maxBytes: 8 * 1_024 * 1_024,
  maxConcurrency: BOUNDED_IMAGE_MAX_CONCURRENCY,
  maxRedirects: 3,
  timeoutMs: 8_000,
});

// Keep each downloaded Buffer inside the slot until its storage upload has
// finished. Limiting fetches alone would still allow many completed 8 MiB
// Buffers to pile up while their uploads are waiting.
const withImageRehostSlot = createConcurrencyLimiter(IMAGE_REHOST_LIMITS.maxConcurrency);

/**
 * True only for Instagram/TikTok CDN URLs that expire and therefore need
 * re-hosting. Returns false for empty values, non-URLs, already-permanent
 * Supabase URLs, YouTube avatars/thumbnails, and web images.
 */
export function needsRehosting(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return isAllowedHttpsImageUrl(url, EXPIRING_CDN_HOSTS);
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
    return await withImageRehostSlot(async () => {
      const parsed = new URL(url);
      const downloaded = await downloadBoundedImage(url, {
        allowedHostSuffixes: EXPIRING_CDN_HOSTS,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/png,image/gif,image/jpeg',
        },
        maxBytes: IMAGE_REHOST_LIMITS.maxBytes,
        maxRedirects: IMAGE_REHOST_LIMITS.maxRedirects,
        timeoutMs: IMAGE_REHOST_LIMITS.timeoutMs,
      });
      const supabase = getSupabaseServerClient();
      await ensureBucket(supabase);
      const path = storagePathFor(parsed, downloaded.extension);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, downloaded.bytes, {
          contentType: downloaded.contentType,
          upsert: true,
        });
      if (uploadError) return url;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data?.publicUrl || url;
    });
  } catch {
    // Network/timeout/permission — never let image hosting break a scrape.
    return url;
  }
}
