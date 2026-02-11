import { NextRequest, NextResponse } from 'next/server';
import { sql, DbDiscoveredAffiliate } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// GET /api/affiliates/discovered?userId=xxx - Get all discovered affiliates for a user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userIdNum}`;
    if (userCheck.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (authUser.email !== (userCheck[0] as { email: string }).email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    const affiliates = await sql`
      SELECT * FROM crewcast.discovered_affiliates 
      WHERE user_id = ${userIdNum}
      ORDER BY discovered_at DESC
    `;

    return NextResponse.json({ affiliates: affiliates as DbDiscoveredAffiliate[] });
  } catch (error) {
    console.error('Error fetching discovered affiliates:', error);
    return NextResponse.json({ error: 'Failed to fetch discovered affiliates' }, { status: 500 });
  }
}

// POST /api/affiliates/discovered - Save a discovered affiliate
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    } = body;

    if (!userId || !searchKeyword || !title || !link || !domain || !snippet || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userId}`;
    if (userCheck.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (authUser.email !== (userCheck[0] as { email: string }).email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    // Check for duplicate
    const existing = await sql`
      SELECT id FROM crewcast.discovered_affiliates 
      WHERE user_id = ${userId} AND link = ${link}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ id: existing[0].id, duplicate: true });
    }

    const newAffiliates = await sql`
      INSERT INTO crewcast.discovered_affiliates (
        user_id, search_keyword, title, link, domain, snippet, source,
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
        ${userId}, ${searchKeyword}, ${title}, ${link}, ${domain}, ${snippet}, ${source},
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
      RETURNING id
    `;

    return NextResponse.json({ id: newAffiliates[0].id, duplicate: false });
  } catch (error) {
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
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId,
      domain,
      similarWeb, // The full SimilarWebData object from enrichment_update
    } = body;

    if (!userId || !domain) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userId}`;
    if (userCheck.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (authUser.email !== (userCheck[0] as { email: string }).email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

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
      WHERE user_id = ${userId} AND domain = ${domain} AND source = 'Web'
      RETURNING id
    `;

    console.log(`✅ Updated SimilarWeb data for ${result.length} affiliates (domain: ${domain})`);

    return NextResponse.json({ 
      success: true, 
      updatedCount: result.length,
      domain 
    });
  } catch (error) {
    console.error('Error updating SimilarWeb data:', error);
    return NextResponse.json({ error: 'Failed to update SimilarWeb data' }, { status: 500 });
  }
}

// DELETE /api/affiliates/discovered - Remove or clear discovered affiliates
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const link = searchParams.get('link');
    const clearAll = searchParams.get('clearAll');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userIdNum}`;
    if (userCheck.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (authUser.email !== (userCheck[0] as { email: string }).email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    if (clearAll === 'true') {
      // Clear all discovered affiliates for the user
      await sql`
        DELETE FROM crewcast.discovered_affiliates 
        WHERE user_id = ${userIdNum}
      `;
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!link) {
      return NextResponse.json({ error: 'Link is required (or use clearAll=true)' }, { status: 400 });
    }

    await sql`
      DELETE FROM crewcast.discovered_affiliates 
      WHERE user_id = ${userIdNum} AND link = ${link}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing discovered affiliate:', error);
    return NextResponse.json({ error: 'Failed to remove affiliate' }, { status: 500 });
  }
}

