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
    const { userId, affiliates } = body;

    if (!userId || !affiliates || !Array.isArray(affiliates)) {
      return NextResponse.json({ error: 'Missing required fields: userId and affiliates array' }, { status: 400 });
    }

    const insertedIds: number[] = [];
    let duplicateCount = 0;

    // Process each affiliate
    for (const affiliate of affiliates) {
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
        thumbnail,
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
        channelThumbnail,
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
        SELECT id FROM saved_affiliates 
        WHERE user_id = ${userId} AND link = ${link}
      `;

      if (existing.length > 0) {
        duplicateCount++;
        continue; // Skip duplicates
      }

      // Insert new affiliate
      const newAffiliates = await sql`
        INSERT INTO saved_affiliates (
          user_id, title, link, domain, snippet, source,
          is_affiliate, person_name, summary, email, thumbnail,
          views, date, rank, keyword, highlighted_words,
          discovery_method_type, discovery_method_value,
          is_already_affiliate, is_new, channel_name, channel_link,
          channel_thumbnail, channel_verified, channel_subscribers, duration,
          instagram_username, instagram_full_name, instagram_bio,
          instagram_followers, instagram_following, instagram_posts_count,
          instagram_is_business, instagram_is_verified,
          tiktok_username, tiktok_display_name, tiktok_bio,
          tiktok_followers, tiktok_following, tiktok_likes,
          tiktok_videos_count, tiktok_is_verified,
          tiktok_video_plays, tiktok_video_likes, tiktok_video_comments, tiktok_video_shares,
          similarweb_monthly_visits, similarweb_global_rank, similarweb_country_rank,
          similarweb_country_code, similarweb_bounce_rate, similarweb_pages_per_visit,
          similarweb_time_on_site, similarweb_category, similarweb_traffic_sources, similarweb_top_countries
        )
        VALUES (
          ${userId}, ${title}, ${link}, ${domain}, ${snippet || ''}, ${source},
          ${isAffiliate ?? null}, ${personName ?? null}, ${summary ?? null}, 
          ${email ?? null}, ${thumbnail ?? null}, ${views ?? null}, 
          ${date ?? null}, ${rank ?? null}, ${keyword ?? null}, 
          ${highlightedWords ?? null}, ${discoveryMethodType ?? null}, 
          ${discoveryMethodValue ?? null}, ${isAlreadyAffiliate ?? null}, 
          ${isNew ?? null}, ${channelName ?? null}, ${channelLink ?? null},
          ${channelThumbnail ?? null}, ${channelVerified ?? null}, 
          ${channelSubscribers ?? null}, ${duration ?? null},
          ${instagramUsername ?? null}, ${instagramFullName ?? null}, ${instagramBio ?? null},
          ${instagramFollowers ?? null}, ${instagramFollowing ?? null}, ${instagramPostsCount ?? null},
          ${instagramIsBusiness ?? null}, ${instagramIsVerified ?? null},
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
        RETURNING id
      `;
      insertedIds.push(newAffiliates[0].id as number);
    }

    return NextResponse.json({ 
      insertedIds, 
      count: insertedIds.length,
      duplicateCount 
    });
  } catch (error) {
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
    const { userId, links } = body;

    if (!userId || !links || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: userId and links array' }, { status: 400 });
    }

    // Delete all matching affiliates in one query using ANY
    await sql`
      DELETE FROM saved_affiliates 
      WHERE user_id = ${userId} AND link = ANY(${links})
    `;

    return NextResponse.json({ 
      success: true, 
      count: links.length 
    });
  } catch (error) {
    console.error('Error batch removing saved affiliates:', error);
    return NextResponse.json({ error: 'Failed to batch remove affiliates' }, { status: 500 });
  }
}

