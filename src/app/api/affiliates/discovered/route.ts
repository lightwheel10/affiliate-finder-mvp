import { NextRequest, NextResponse } from 'next/server';
import { sql, DbDiscoveredAffiliate } from '@/lib/db';
import {
  affiliateRequestErrorResponse,
  resolveAffiliateReadRequestContext,
  resolveAffiliateRequestContext,
} from '@/lib/affiliates/server';

// GET /api/affiliates/discovered?userId=xxx - Get all discovered affiliates for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const context = await resolveAffiliateReadRequestContext({
      legacyAccountId: searchParams.get('userId'),
      requestedBrandLocationIds: searchParams.getAll('brandLocationId'),
    });

    const affiliates = await sql`
      SELECT * FROM crewcast.discovered_affiliates
      WHERE user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ANY(${context.brandLocationIds}::bigint[])
      ORDER BY discovered_at DESC
    `;

    // 2026-05-25 (paras): derive is_new per-request from the user's most
    // recent auto-scan time. The stored is_new column was set to true on
    // every insert and never reset, so every row showed the "NEW" badge
    // forever. Now the badge means "discovered in the most recent scan"
    // and auto-expires when the next scan runs — no cron, no DB writes.
    // 1-hour buffer because updateScanSchedule() runs AFTER inserts in
    // auto-scan/route.ts (~minutes later), so just-inserted rows have a
    // discovered_at slightly before last_auto_scan_at.
    const locations = await sql`
      SELECT id::text AS id, last_auto_scan_at
      FROM crewcast.brand_locations
      WHERE id = ANY(${context.brandLocationIds}::bigint[])
        AND brand_id = ${context.brandId}::bigint
        AND user_id = ${context.accountId}
    `;
    const cutoffByLocationId = new Map(
      (locations as Array<{ id: string; last_auto_scan_at: string | null }>).map((location) => [
        location.id,
        location.last_auto_scan_at
          ? new Date(location.last_auto_scan_at).getTime() - 60 * 60 * 1000
          : null,
      ]),
    );
    const result = (affiliates as DbDiscoveredAffiliate[]).map((a) => ({
      ...a,
      is_new: (() => {
        const cutoffMs = cutoffByLocationId.get(String(a.brand_location_id)) ?? null;
        return cutoffMs !== null && new Date(a.discovered_at).getTime() >= cutoffMs;
      })(),
    }));

    return NextResponse.json({ affiliates: result });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error fetching discovered affiliates:', error);
    return NextResponse.json({ error: 'Failed to fetch discovered affiliates' }, { status: 500 });
  }
}

// POST /api/affiliates/discovered - Save a discovered affiliate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      searchKeyword,
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
      // YouTube fields
      youtubeVideoLikes,
      youtubeVideoComments,
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
      // NEW SimilarWeb fields (Dec 2025)
      similarwebSiteTitle,
      similarwebSiteDescription,
      similarwebScreenshot,
      similarwebCategoryRank,
      similarwebMonthlyVisitsHistory,
      similarwebTopKeywords,
      similarwebSnapshotDate,
      brandLocationId,
    } = body;

    if (!userId || !searchKeyword || !title || !link || !domain || !snippet || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: userId,
      requestedBrandLocationId: brandLocationId,
    });

    const newAffiliates = await sql`
      INSERT INTO crewcast.discovered_affiliates (
        user_id, brand_id, brand_location_id,
        search_keyword, title, link, domain, snippet, source,
        is_affiliate, person_name, summary, email, thumbnail,
        views, date, rank, keyword, highlighted_words,
        discovery_method_type, discovery_method_value,
        is_already_affiliate, is_new, channel_name, channel_link,
        channel_thumbnail, channel_verified, channel_subscribers, duration,
        youtube_video_likes, youtube_video_comments,
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
        similarweb_time_on_site, similarweb_category, similarweb_traffic_sources, similarweb_top_countries,
        similarweb_site_title, similarweb_site_description, similarweb_screenshot,
        similarweb_category_rank, similarweb_monthly_visits_history, similarweb_top_keywords, similarweb_snapshot_date
      )
      VALUES (
        ${context.accountId}, ${context.brandId}::bigint, ${context.brandLocationId}::bigint,
        ${searchKeyword}, ${title}, ${link}, ${domain}, ${snippet}, ${source},
        ${isAffiliate ?? null}, ${personName ?? null}, ${summary ?? null}, 
        ${email ?? null}, ${thumbnail ?? null}, ${views ?? null}, 
        ${date ?? null}, ${rank ?? null}, ${keyword ?? null}, 
        ${highlightedWords ?? null}, ${discoveryMethodType ?? null}, 
        ${discoveryMethodValue ?? null}, ${isAlreadyAffiliate ?? null}, 
        ${isNew ?? null}, ${channelName ?? null}, ${channelLink ?? null},
        ${channelThumbnail ?? null}, ${channelVerified ?? null}, 
        ${channelSubscribers ?? null}, ${duration ?? null},
        ${youtubeVideoLikes ?? null}, ${youtubeVideoComments ?? null},
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
        ${similarwebTopCountries ? JSON.stringify(similarwebTopCountries) : null},
        ${similarwebSiteTitle ?? null}, ${similarwebSiteDescription ?? null}, ${similarwebScreenshot ?? null},
        ${similarwebCategoryRank ?? null}, 
        ${similarwebMonthlyVisitsHistory ? JSON.stringify(similarwebMonthlyVisitsHistory) : null},
        ${similarwebTopKeywords ? JSON.stringify(similarwebTopKeywords) : null},
        ${similarwebSnapshotDate ?? null}
      )
      ON CONFLICT (brand_location_id, link) DO NOTHING
      RETURNING id
    `;

    if (newAffiliates.length > 0) {
      return NextResponse.json({ id: newAffiliates[0].id, duplicate: false });
    }

    const existing = await sql`
      SELECT id
      FROM crewcast.discovered_affiliates
      WHERE user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND link = ${link}
      LIMIT 1
    `;
    if (existing.length !== 1) {
      throw new Error('The location-scoped affiliate conflict could not be resolved.');
    }
    return NextResponse.json({ id: existing[0].id, duplicate: true });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error saving discovered affiliate:', error);
    return NextResponse.json({ error: 'Failed to save discovered affiliate' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/affiliates/discovered - Update SimilarWeb data for existing affiliates
// 
// Added December 16, 2025 - CRITICAL BUG FIX
// 
// PROBLEM: SimilarWeb data arrives AFTER the initial save via enrichment_update
// events. The original flow only inserted new records and returned early for
// duplicates, meaning SimilarWeb data was never persisted.
// 
// SOLUTION: This PATCH endpoint updates SimilarWeb fields for all affiliates
// matching a domain (for a given user). Called from the client when
// enrichment_update events arrive.
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      brandLocationId,
      domain,
      similarWeb, // The full SimilarWebData object from enrichment_update
    } = body;

    if (!userId || !domain) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: userId,
      requestedBrandLocationId: brandLocationId,
    });

    if (!similarWeb) {
      return NextResponse.json({ error: 'similarWeb data is required' }, { status: 400 });
    }

    // Update all discovered affiliates for this user + domain with SimilarWeb data
    const result = await sql`
      UPDATE crewcast.discovered_affiliates
      SET 
        similarweb_monthly_visits = ${similarWeb.monthlyVisits ?? null},
        similarweb_global_rank = ${similarWeb.globalRank ?? null},
        similarweb_country_rank = ${similarWeb.countryRank ?? null},
        similarweb_country_code = ${similarWeb.countryCode ?? null},
        similarweb_bounce_rate = ${similarWeb.bounceRate ?? null},
        similarweb_pages_per_visit = ${similarWeb.pagesPerVisit ?? null},
        similarweb_time_on_site = ${similarWeb.timeOnSite ?? null},
        similarweb_category = ${similarWeb.category ?? null},
        similarweb_traffic_sources = ${similarWeb.trafficSources ? JSON.stringify(similarWeb.trafficSources) : null},
        similarweb_top_countries = ${similarWeb.topCountries ? JSON.stringify(similarWeb.topCountries) : null},
        similarweb_site_title = ${similarWeb.siteTitle ?? null},
        similarweb_site_description = ${similarWeb.siteDescription ?? null},
        similarweb_screenshot = ${similarWeb.screenshot ?? null},
        similarweb_category_rank = ${similarWeb.categoryRank ?? null},
        similarweb_monthly_visits_history = ${similarWeb.monthlyVisitsHistory ? JSON.stringify(similarWeb.monthlyVisitsHistory) : null},
        similarweb_top_keywords = ${similarWeb.topKeywords ? JSON.stringify(similarWeb.topKeywords) : null},
        similarweb_snapshot_date = ${similarWeb.snapshotDate ?? null}
      WHERE user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND domain = ${domain}
        AND source = 'Web'
      RETURNING id
    `;

    console.log(`✅ Updated SimilarWeb data for ${result.length} affiliates (domain: ${domain})`);

    return NextResponse.json({ 
      success: true, 
      updatedCount: result.length,
      domain 
    });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error updating SimilarWeb data:', error);
    return NextResponse.json({ error: 'Failed to update SimilarWeb data' }, { status: 500 });
  }
}

// DELETE /api/affiliates/discovered - Remove or clear discovered affiliates
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');
    const clearAll = searchParams.get('clearAll');
    const context = await resolveAffiliateRequestContext({
      legacyAccountId: searchParams.get('userId'),
      requestedBrandLocationId: searchParams.get('brandLocationId'),
    });

    if (clearAll === 'true') {
      // Clear only the explicitly resolved location; other brands and markets
      // remain untouched even when an older client omitted brandLocationId.
      await sql`
        DELETE FROM crewcast.discovered_affiliates 
        WHERE user_id = ${context.accountId}
          AND brand_id = ${context.brandId}::bigint
          AND brand_location_id = ${context.brandLocationId}::bigint
      `;
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!link) {
      return NextResponse.json({ error: 'Link is required (or use clearAll=true)' }, { status: 400 });
    }

    await sql`
      DELETE FROM crewcast.discovered_affiliates 
      WHERE user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND link = ${link}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Error removing discovered affiliate:', error);
    return NextResponse.json({ error: 'Failed to remove affiliate' }, { status: 500 });
  }
}

