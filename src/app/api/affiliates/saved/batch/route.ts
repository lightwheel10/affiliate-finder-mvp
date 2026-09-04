/**
 * Bulk Operations API for Saved Affiliates (Pipeline)
 * Created: December 2025
 * 
 * This endpoint handles bulk operations for saved affiliates:
 * - POST: Bulk save multiple affiliates to the pipeline
 * - DELETE: Bulk remove multiple affiliates from the pipeline
 * 
 * Used by:
 * - Find New page: "Save Selected to Pipeline" button
 * - Discovered page: "Save Selected to Pipeline" button  
 * - Saved page: "Delete Selected" button
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  affiliateRequestErrorResponse,
  resolveAffiliateRequestContext,
} from '@/lib/affiliates/server';
// 2026-07-27 13:23 IST (Paras): defensive image re-hosting on save — see the
// comment above the rehost block in POST for the full WHY.
import { rehostImageIfNeeded } from '@/lib/image-storage';

// 2026-07-27 13:23 IST (Paras): image re-hosting can add up to ~8s (one CDN
// fetch timeout) on top of the existing per-row INSERT loop for large batches.
// Pin the function duration instead of relying on Vercel's default.
export const maxDuration = 60;

/**
 * POST /api/affiliates/saved/batch
 * Bulk save multiple affiliates to the pipeline
 * 
 * Request body:
 * {
 *   userId: number,
 *   affiliates: Array<AffiliatePayload>
 * }
 * 
 * Response:
 * {
 *   insertedIds: number[],
 *   count: number,
 *   duplicateCount: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, brandLocationId, affiliates } = body;

    if (!userId || !affiliates || !Array.isArray(affiliates)) {
      return NextResponse.json({ error: 'Missing required fields: userId and affiliates array' }, { status: 400 });
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: userId,
      requestedBrandLocationId: brandLocationId,
    });

    const insertedIds: number[] = [];
    let duplicateCount = 0;

    // =========================================================================
    // 2026-07-27 13:23 IST (Paras): re-host IG/TikTok images before saving.
    //
    // WHY: this endpoint stores whatever thumbnail URLs the client sends. For
    // Instagram/TikTok those are SIGNED CDN URLs that expire after ~3-4 days
    // and then 403 forever. Verified against the live DB today: ALL 2,313
    // saved_affiliates rows had raw CDN URLs (zero permanent ones) — the save
    // flow was the leak. rehostImageIfNeeded() uploads a permanent copy to
    // Supabase Storage; fast no-op for already-permanent URLs and falls back
    // to the original on any failure, so saving can never break over images.
    //
    // Done in ONE parallel pass BEFORE the sequential insert loop below so the
    // added wall-time is bounded by the slowest single image fetch (~8s cap),
    // not fetches × rows — this route must stay inside Vercel's function
    // timeout for large batch saves. Duplicates get re-hosted needlessly, but
    // the storage path is a deterministic hash (upsert), so no bloat.
    // =========================================================================
    const rehostedImages = await Promise.all(
      affiliates.map(async (a: { thumbnail?: string | null; channelThumbnail?: string | null }) => {
        const [thumb, chanThumb] = await Promise.all([
          rehostImageIfNeeded(a.thumbnail),
          rehostImageIfNeeded(a.channelThumbnail),
        ]);
        return { thumb, chanThumb };
      })
    );

    // Process each affiliate
    for (let affiliateIndex = 0; affiliateIndex < affiliates.length; affiliateIndex++) {
      const affiliate = affiliates[affiliateIndex];
      const {
        title,
        link,
        domain,
        snippet,
        source,
        isAffiliate,
        personName,
        summary,
        email,
        // 2026-07-27 13:23 IST (Paras): thumbnail + channelThumbnail no longer
        // destructured here — the re-hosted versions from rehostedImages[] are
        // used instead (see the parallel pass above the loop).
        views,
        date,
        rank,
        keyword,
        highlightedWords,
        discoveryMethodType,
        discoveryMethodValue,
        isAlreadyAffiliate,
        isNew,
        channelName,
        channelLink,
        channelVerified,
        channelSubscribers,
        duration,
        // Instagram fields
        instagramUsername,
        instagramFullName,
        instagramBio,
        instagramFollowers,
        instagramFollowing,
        instagramPostsCount,
        instagramIsBusiness,
        instagramIsVerified,
        instagramPostLikes,
        instagramPostComments,
        instagramPostViews,
        // TikTok fields
        tiktokUsername,
        tiktokDisplayName,
        tiktokBio,
        tiktokFollowers,
        tiktokFollowing,
        tiktokLikes,
        tiktokVideosCount,
        tiktokIsVerified,
        tiktokVideoPlays,
        tiktokVideoLikes,
        tiktokVideoComments,
        tiktokVideoShares,
        // SimilarWeb fields
        similarwebMonthlyVisits,
        similarwebGlobalRank,
        similarwebCountryRank,
        similarwebCountryCode,
        similarwebBounceRate,
        similarwebPagesPerVisit,
        similarwebTimeOnSite,
        similarwebCategory,
        similarwebTrafficSources,
        similarwebTopCountries,
      } = affiliate;

      // Skip if missing required fields
      if (!title || !link || !domain || !source) {
        console.warn('Skipping affiliate with missing required fields:', { title, link, domain, source });
        continue;
      }

      // Check for duplicate (same user + same link)
      const existing = await sql`
        SELECT id FROM crewcast.saved_affiliates 
        WHERE user_id = ${context.accountId}
          AND brand_id = ${context.brandId}::bigint
          AND brand_location_id = ${context.brandLocationId}::bigint
          AND link = ${link}
      `;

      if (existing.length > 0) {
        duplicateCount++;
        continue; // Skip duplicates
      }

      // 2026-07-27 13:23 IST (Paras): permanent URLs from the parallel
      // re-host pass above (index-aligned with `affiliates`).
      const { thumb: permThumbnail, chanThumb: permChannelThumbnail } = rehostedImages[affiliateIndex];

      // Insert new affiliate
      const newAffiliates = await sql`
        INSERT INTO crewcast.saved_affiliates (
          user_id, brand_id, brand_location_id,
          title, link, domain, snippet, source,
          is_affiliate, person_name, summary, email, thumbnail,
          views, date, rank, keyword, highlighted_words,
          discovery_method_type, discovery_method_value,
          is_already_affiliate, is_new, channel_name, channel_link,
          channel_thumbnail, channel_verified, channel_subscribers, duration,
          instagram_username, instagram_full_name, instagram_bio,
          instagram_followers, instagram_following, instagram_posts_count,
          instagram_is_business, instagram_is_verified,
          instagram_post_likes, instagram_post_comments, instagram_post_views,
          tiktok_username, tiktok_display_name, tiktok_bio,
          tiktok_followers, tiktok_following, tiktok_likes,
          tiktok_videos_count, tiktok_is_verified,
          tiktok_video_plays, tiktok_video_likes, tiktok_video_comments, tiktok_video_shares,
          similarweb_monthly_visits, similarweb_global_rank, similarweb_country_rank,
          similarweb_country_code, similarweb_bounce_rate, similarweb_pages_per_visit,
          similarweb_time_on_site, similarweb_category, similarweb_traffic_sources, similarweb_top_countries
        )
        VALUES (
          ${context.accountId}, ${context.brandId}::bigint, ${context.brandLocationId}::bigint,
          ${title}, ${link}, ${domain}, ${snippet || ''}, ${source},
          ${isAffiliate ?? null}, ${personName ?? null}, ${summary ?? null}, 
          ${email ?? null}, ${permThumbnail ?? null}, ${views ?? null},
          ${date ?? null}, ${rank ?? null}, ${keyword ?? null},
          ${highlightedWords ?? null}, ${discoveryMethodType ?? null},
          ${discoveryMethodValue ?? null}, ${isAlreadyAffiliate ?? null},
          ${isNew ?? null}, ${channelName ?? null}, ${channelLink ?? null},
          ${permChannelThumbnail ?? null}, ${channelVerified ?? null},
          ${channelSubscribers ?? null}, ${duration ?? null},
          ${instagramUsername ?? null}, ${instagramFullName ?? null}, ${instagramBio ?? null},
          ${instagramFollowers ?? null}, ${instagramFollowing ?? null}, ${instagramPostsCount ?? null},
          ${instagramIsBusiness ?? null}, ${instagramIsVerified ?? null},
          ${instagramPostLikes ?? null}, ${instagramPostComments ?? null}, ${instagramPostViews ?? null},
          ${tiktokUsername ?? null}, ${tiktokDisplayName ?? null}, ${tiktokBio ?? null},
          ${tiktokFollowers ?? null}, ${tiktokFollowing ?? null}, ${tiktokLikes ?? null},
          ${tiktokVideosCount ?? null}, ${tiktokIsVerified ?? null},
          ${tiktokVideoPlays ?? null}, ${tiktokVideoLikes ?? null}, ${tiktokVideoComments ?? null}, ${tiktokVideoShares ?? null},
          ${similarwebMonthlyVisits ?? null}, ${similarwebGlobalRank ?? null}, ${similarwebCountryRank ?? null},
          ${similarwebCountryCode ?? null}, ${similarwebBounceRate ?? null}, ${similarwebPagesPerVisit ?? null},
          ${similarwebTimeOnSite ?? null}, ${similarwebCategory ?? null}, 
          ${similarwebTrafficSources ? JSON.stringify(similarwebTrafficSources) : null}, 
          ${similarwebTopCountries ? JSON.stringify(similarwebTopCountries) : null}
        )
        ON CONFLICT (brand_location_id, link) DO NOTHING
        RETURNING id
      `;
      if (newAffiliates.length === 1) {
        insertedIds.push(newAffiliates[0].id as number);
      } else {
        // A concurrent request inserted the same location/link after the
        // optimization check above. The unique key is authoritative.
        duplicateCount++;
      }
    }

    return NextResponse.json({ 
      insertedIds, 
      count: insertedIds.length,
      duplicateCount 
    });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error batch saving affiliates to pipeline:', error);
    return NextResponse.json({ error: 'Failed to batch save affiliates' }, { status: 500 });
  }
}

/**
 * DELETE /api/affiliates/saved/batch
 * Bulk remove multiple affiliates from the pipeline
 * 
 * Request body:
 * {
 *   userId: number,
 *   links: string[]  // Array of affiliate links to delete
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   count: number  // Number of deleted records
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, brandLocationId, links } = body;

    if (!userId || !links || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: userId and links array' }, { status: 400 });
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: userId,
      requestedBrandLocationId: brandLocationId,
    });

    // Delete all matching affiliates in one query using ANY
    // RETURNING * gives us the actual deleted rows so we can count them accurately
    const deletedRows = await sql`
      DELETE FROM crewcast.saved_affiliates 
      WHERE user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND link = ANY(${links})
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      count: deletedRows.length  // Actual count of deleted rows
    });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error batch removing saved affiliates:', error);
    return NextResponse.json({ error: 'Failed to batch remove affiliates' }, { status: 500 });
  }
}

