import { NextRequest, NextResponse } from 'next/server';
import { sql, DbSavedAffiliate } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';

// =============================================================================
// CREDIT ENFORCEMENT CHECK - January 16, 2026
// 
// Check if credit enforcement is enabled via environment variable.
// When enabled, email lookups (including bio extraction) consume credits.
// =============================================================================
function isCreditEnforcementEnabled(): boolean {
  const flag = process.env.ENFORCE_CREDITS;
  if (!flag) return false;
  return flag.toLowerCase() === 'true' || flag === '1';
}

// GET /api/affiliates/saved?userId=xxx - Get all saved affiliates for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const affiliates = await sql`
      SELECT * FROM crewcast.saved_affiliates 
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
    } = body;

    if (!userId || !title || !link || !domain || !snippet || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await sql`
      SELECT id FROM crewcast.saved_affiliates 
      WHERE user_id = ${userId} AND link = ${link}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ id: existing[0].id, duplicate: true });
    }

    const newAffiliates = await sql`
      INSERT INTO crewcast.saved_affiliates (
        user_id, title, link, domain, snippet, source,
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
      DELETE FROM crewcast.saved_affiliates 
      WHERE user_id = ${parseInt(userId)} AND link = ${link}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing saved affiliate:', error);
    return NextResponse.json({ error: 'Failed to remove affiliate' }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/affiliates/saved - Update email status for a saved affiliate
// 
// Added: January 14, 2026
// Updated: January 16, 2026 - Now consumes credits for bio emails (client request)
// 
// PURPOSE:
// This endpoint updates the email discovery status for social media affiliates
// (TikTok, Instagram, YouTube) WITHOUT calling the paid Lusha/Apollo enrichment.
// 
// WHY THIS EXISTS:
// For social media affiliates, we extract emails directly from their public bios
// during the initial search (see apify.ts extractEmailFromText function).
// When user clicks "Find Email", we check if a bio email already exists:
// - If YES: Update status to 'found' using THIS endpoint (1 credit charged)
// - If NO: Update status to 'not_found' using THIS endpoint (FREE, no charge)
// 
// CREDIT POLICY UPDATE - January 16, 2026:
// Previously bio emails were free. Client decided to charge 1 credit for ALL
// email discoveries, including bio-extracted emails from social media profiles.
// This ensures consistent pricing across all email lookup methods.
// 
// For Web results, we still use the /api/enrich/email endpoint with Lusha/Apollo.
// 
// Request body:
// - affiliateId: number (required) - The saved_affiliates.id to update
// - userId: number (required) - For authorization check
// - emailStatus: 'found' | 'not_found' (required) - New status
// - email?: string (optional) - The bio email if found
// - provider?: string (optional) - Source of email (default: 'bio_extraction')
// 
// Returns:
// - success: boolean
// - email?: string (if found)
// - status: 'found' | 'not_found'
// - creditsConsumed?: boolean - Whether credits were deducted
// - creditsRemaining?: number - Remaining email credits after deduction
// 
// Error Responses:
// - 400: Missing required fields
// - 402: Insufficient email credits (only when emailStatus === 'found')
// - 500: Server error
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      affiliateId, 
      userId, 
      emailStatus, 
      email,
      provider = 'bio_extraction' 
    } = body;

    // Validate required fields
    if (!affiliateId || !userId) {
      return NextResponse.json(
        { error: 'affiliateId and userId are required' }, 
        { status: 400 }
      );
    }

    if (!emailStatus || !['found', 'not_found'].includes(emailStatus)) {
      return NextResponse.json(
        { error: 'emailStatus must be "found" or "not_found"' }, 
        { status: 400 }
      );
    }

    // ==========================================================================
    // CREDIT CHECK - January 16, 2026
    // 
    // If an email was found (bio extraction succeeded), we charge 1 credit.
    // If no email found, no credit is consumed (user shouldn't pay for failure).
    // ==========================================================================
    const enforceCredits = isCreditEnforcementEnabled();
    let creditsConsumed = false;
    let creditsRemaining = 0;

    if (enforceCredits && emailStatus === 'found') {
      // Check if user has sufficient email credits
      const creditCheck = await checkCredits(userId, 'email', 1);
      
      if (!creditCheck.allowed) {
        console.log(`[PATCH /api/affiliates/saved] User ${userId} has insufficient email credits`);
        return NextResponse.json(
          { 
            error: 'Insufficient email credits',
            message: creditCheck.message || 'You need more email credits to find this email.',
            remaining: creditCheck.remaining,
            isUnlimited: creditCheck.isUnlimited,
          }, 
          { status: 402 }
        );
      }
    }

    // Update the affiliate's email AND status in database
    // CRITICAL FIX January 14, 2026: Must persist email to database!
    // Without this, email only shows via optimistic update and is lost on refresh.
    await sql`
      UPDATE crewcast.saved_affiliates 
      SET 
        email = COALESCE(${email || null}, email),
        email_status = ${emailStatus},
        email_searched_at = NOW(),
        email_provider = ${provider}
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    // ==========================================================================
    // CREDIT CONSUMPTION - January 16, 2026
    // 
    // Consume 1 email credit AFTER successful database update.
    // Only consume if email was found (not for 'not_found' status).
    // ==========================================================================
    if (enforceCredits && emailStatus === 'found') {
      const consumeResult = await consumeCredits(
        userId,
        'email',
        1,
        affiliateId.toString(),
        'bio_extraction'
      );
      
      if (consumeResult.success) {
        creditsConsumed = true;
        creditsRemaining = consumeResult.newBalance;
        console.log(`[PATCH /api/affiliates/saved] User ${userId}: Consumed 1 email credit for bio extraction. Remaining: ${creditsRemaining}`);
      } else {
        // This shouldn't happen since we checked above, but log it
        console.error(`[PATCH /api/affiliates/saved] Failed to consume credit for user ${userId} after check passed`);
      }
    }

    return NextResponse.json({ 
      success: true,
      email: email || null,
      status: emailStatus,
      provider: provider,
      creditsConsumed,
      creditsRemaining,
    });
  } catch (error) {
    console.error('Error updating email status:', error);
    return NextResponse.json(
      { error: 'Failed to update email status' }, 
      { status: 500 }
    );
  }
}
