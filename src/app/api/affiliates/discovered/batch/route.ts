/**
 * Bulk Operations API for Discovered Affiliates
 * Updated: December 2025
 * 
 * This endpoint handles bulk operations for discovered affiliates:
 * - POST: Batch save multiple discovered affiliates (existing functionality)
 * - DELETE: Bulk remove multiple discovered affiliates (added Dec 2025)
 * 
 * Used by:
 * - Find New page: Auto-saves search results in batch
 * - Find New page: "Delete Selected" button (Dec 2025)
 * - Discovered page: "Delete Selected" button (Dec 2025)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// POST /api/affiliates/discovered/batch - Batch save discovered affiliates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, searchKeyword, affiliates } = body;

    if (!userId || !searchKeyword || !affiliates || !Array.isArray(affiliates)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const insertedIds: number[] = [];

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

      // Check for duplicate
      const existing = await sql`
        SELECT id FROM discovered_affiliates 
        WHERE user_id = ${userId} AND link = ${link}
      `;

      if (existing.length === 0) {
        const newAffiliates = await sql`
          INSERT INTO discovered_affiliates (
            user_id, search_keyword, title, link, domain, snippet, source,
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
            ${userId}, ${searchKeyword}, ${title}, ${link}, ${domain}, ${snippet}, ${source},
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
    }

    return NextResponse.json({ insertedIds, count: insertedIds.length });
  } catch (error) {
    console.error('Error batch saving discovered affiliates:', error);
    return NextResponse.json({ error: 'Failed to batch save affiliates' }, { status: 500 });
  }
}

/**
 * DELETE /api/affiliates/discovered/batch
 * Bulk remove multiple discovered affiliates
 * Added: December 2025
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
      DELETE FROM discovered_affiliates 
      WHERE user_id = ${userId} AND link = ANY(${links})
    `;

    return NextResponse.json({ 
      success: true, 
      count: links.length 
    });
  } catch (error) {
    console.error('Error batch removing discovered affiliates:', error);
    return NextResponse.json({ error: 'Failed to batch remove affiliates' }, { status: 500 });
  }
}

