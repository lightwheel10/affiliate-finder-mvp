import { NextRequest, NextResponse } from 'next/server';
import { sql, DbSavedAffiliate } from '@/lib/db';

// GET /api/affiliates/saved?userId=xxx - Get all saved affiliates for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const affiliates = await sql`
      SELECT * FROM saved_affiliates 
      WHERE user_id = ${parseInt(userId)}
      ORDER BY saved_at DESC
    `;

    return NextResponse.json({ affiliates: affiliates as DbSavedAffiliate[] });
  } catch (error) {
    console.error('Error fetching saved affiliates:', error);
    return NextResponse.json({ error: 'Failed to fetch saved affiliates' }, { status: 500 });
  }
}

// POST /api/affiliates/saved - Save an affiliate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
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
    } = body;

    if (!userId || !title || !link || !domain || !snippet || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await sql`
      SELECT id FROM saved_affiliates 
      WHERE user_id = ${userId} AND link = ${link}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ id: existing[0].id, duplicate: true });
    }

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
        ${userId}, ${title}, ${link}, ${domain}, ${snippet}, ${source},
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

    return NextResponse.json({ id: newAffiliates[0].id, duplicate: false });
  } catch (error) {
    console.error('Error saving affiliate:', error);
    return NextResponse.json({ error: 'Failed to save affiliate' }, { status: 500 });
  }
}

// DELETE /api/affiliates/saved - Remove a saved affiliate
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const link = searchParams.get('link');

    if (!userId || !link) {
      return NextResponse.json({ error: 'User ID and link are required' }, { status: 400 });
    }

    await sql`
      DELETE FROM saved_affiliates 
      WHERE user_id = ${parseInt(userId)} AND link = ${link}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing saved affiliate:', error);
    return NextResponse.json({ error: 'Failed to remove affiliate' }, { status: 500 });
  }
}

