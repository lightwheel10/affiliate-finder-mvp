'use client';

// =============================================================================
// AFFILIATE HOOKS - January 3rd, 2026
// 
// Refactored to use SWR (Stale-While-Revalidate) for data fetching.
// 
// WHY SWR?
// - Global cache: All components using the same key share data (Sidebar + Pages)
// - When one component mutates data, ALL components update instantly
// - No more stale counts - user sees real-time updates without page refresh
// - Recommended by Next.js/Vercel for client-side data fetching
// - Handles caching, deduplication, and revalidation automatically
// 
// BEFORE: Sidebar and Page had separate state. Saving an affiliate in Page
//         didn't update Sidebar count until page refresh.
// AFTER:  Both use same SWR cache key. Saving triggers mutate(), all update.
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useNeonUser } from './useNeonUser';
import { ResultItem, SimilarWebData } from '../types';

// =============================================================================
// SWR FETCHER - January 3rd, 2026
// 
// Standard fetcher function for SWR. Handles API calls and error responses.
// Used by all SWR hooks in this file.
// =============================================================================
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

// Transform database affiliate to ResultItem format
// This function maps database columns (snake_case) to ResultItem fields (camelCase)
function transformAffiliate(dbAffiliate: any): ResultItem {
  // Build SimilarWeb data if available
  const similarWeb = dbAffiliate.similarweb_monthly_visits ? {
    domain: dbAffiliate.domain,
    monthlyVisits: dbAffiliate.similarweb_monthly_visits,
    monthlyVisitsFormatted: formatNumber(dbAffiliate.similarweb_monthly_visits),
    globalRank: dbAffiliate.similarweb_global_rank,
    countryRank: dbAffiliate.similarweb_country_rank,
    countryCode: dbAffiliate.similarweb_country_code,
    bounceRate: dbAffiliate.similarweb_bounce_rate || 0,
    pagesPerVisit: dbAffiliate.similarweb_pages_per_visit || 0,
    timeOnSite: dbAffiliate.similarweb_time_on_site || 0,
    trafficSources: parseJsonField(dbAffiliate.similarweb_traffic_sources) || {
      direct: 0, search: 0, social: 0, referrals: 0, mail: 0, paid: 0
    },
    topCountries: parseJsonField(dbAffiliate.similarweb_top_countries) || [],
    category: dbAffiliate.similarweb_category,
    // NEW FIELDS (Dec 2025)
    siteTitle: dbAffiliate.similarweb_site_title || null,
    siteDescription: dbAffiliate.similarweb_site_description || null,
    screenshot: dbAffiliate.similarweb_screenshot || null,
    categoryRank: dbAffiliate.similarweb_category_rank || null,
    monthlyVisitsHistory: parseJsonField(dbAffiliate.similarweb_monthly_visits_history) || null,
    topKeywords: parseJsonField(dbAffiliate.similarweb_top_keywords) || null,
    snapshotDate: dbAffiliate.similarweb_snapshot_date || null,
  } : undefined;

  // Build channel info (for YouTube/TikTok)
  // Priority: channel_name (YouTube) > tiktok_username (TikTok fallback)
  const channel = dbAffiliate.channel_name ? {
    name: dbAffiliate.channel_name,
    link: dbAffiliate.channel_link || '',
    thumbnail: dbAffiliate.channel_thumbnail,
    verified: dbAffiliate.channel_verified,
    subscribers: dbAffiliate.channel_subscribers,
  } : (dbAffiliate.tiktok_username ? {
    // Fallback to TikTok data for channel display (backward compatibility)
    name: dbAffiliate.tiktok_display_name || dbAffiliate.tiktok_username,
    link: `https://www.tiktok.com/@${dbAffiliate.tiktok_username}`,
    verified: dbAffiliate.tiktok_is_verified,
    subscribers: dbAffiliate.tiktok_followers ? formatNumber(dbAffiliate.tiktok_followers) : undefined,
  } : undefined);

  return {
    id: dbAffiliate.id,
    title: dbAffiliate.title,
    link: dbAffiliate.link,
    domain: dbAffiliate.domain,
    snippet: dbAffiliate.snippet,
    source: dbAffiliate.source,
    isAffiliate: dbAffiliate.is_affiliate,
    personName: dbAffiliate.person_name,
    summary: dbAffiliate.summary,
    email: dbAffiliate.email,
    thumbnail: dbAffiliate.thumbnail,
    views: dbAffiliate.views,
    date: dbAffiliate.date,
    rank: dbAffiliate.rank,
    keyword: dbAffiliate.keyword,
    savedAt: dbAffiliate.saved_at,
    discoveredAt: dbAffiliate.discovered_at,
    searchKeyword: dbAffiliate.search_keyword,
    highlightedWords: dbAffiliate.highlighted_words,
    discoveryMethod: dbAffiliate.discovery_method_type ? {
      type: dbAffiliate.discovery_method_type as 'competitor' | 'keyword' | 'topic' | 'tagged',
      value: dbAffiliate.discovery_method_value || '',
    } : undefined,
    isAlreadyAffiliate: dbAffiliate.is_already_affiliate,
    isNew: dbAffiliate.is_new,
    channel,
    duration: dbAffiliate.duration,
    similarWeb,
    // Email discovery fields
    emailStatus: dbAffiliate.email_status || 'not_searched',
    emailSearchedAt: dbAffiliate.email_searched_at,
    emailProvider: dbAffiliate.email_provider,
    
    // ==========================================================================
    // EMAIL RESULTS - Full enrichment data (CRITICAL FIX - Dec 17, 2025)
    // 
    // BUG FIXED: Previously, email_results was being saved to the database but
    // never loaded back into the frontend. This caused the UI to only show
    // "1 Found" after page refresh, even though Lusha may have returned multiple
    // emails and contacts.
    // 
    // The email_results JSONB column contains:
    // - emails: string[] - All emails found across all contacts
    // - contacts: Array - Full contact details (name, title, emails, phones)
    // - firstName, lastName, title, linkedinUrl, phoneNumbers - Primary contact
    // - provider: 'apollo' | 'lusha'
    // 
    // This data is used by the Email Results modal in AffiliateRow.tsx to show
    // all contacts and their emails, not just the primary email.
    // ==========================================================================
    emailResults: parseJsonField(dbAffiliate.email_results) || undefined,
    
    // ==========================================================================
    // Instagram fields (FIX: now properly reading from database)
    // Maps DB columns instagram_x → ResultItem.instagramX
    // ==========================================================================
    instagramUsername: dbAffiliate.instagram_username,
    instagramFullName: dbAffiliate.instagram_full_name,
    instagramBio: dbAffiliate.instagram_bio,
    instagramFollowers: dbAffiliate.instagram_followers,
    instagramFollowing: dbAffiliate.instagram_following,
    instagramPostsCount: dbAffiliate.instagram_posts_count,
    instagramIsBusiness: dbAffiliate.instagram_is_business,
    instagramIsVerified: dbAffiliate.instagram_is_verified,
    // Instagram post-level stats (Added Dec 2025)
    instagramPostLikes: dbAffiliate.instagram_post_likes,
    instagramPostComments: dbAffiliate.instagram_post_comments,
    instagramPostViews: dbAffiliate.instagram_post_views,
    
    // ==========================================================================
    // TikTok fields (FIX: now properly reading from database)
    // Maps DB columns tiktok_x → ResultItem.tiktokX
    // ==========================================================================
    tiktokUsername: dbAffiliate.tiktok_username,
    tiktokDisplayName: dbAffiliate.tiktok_display_name,
    tiktokBio: dbAffiliate.tiktok_bio,
    tiktokFollowers: dbAffiliate.tiktok_followers,
    tiktokFollowing: dbAffiliate.tiktok_following,
    tiktokLikes: dbAffiliate.tiktok_likes,
    tiktokVideosCount: dbAffiliate.tiktok_videos_count,
    tiktokIsVerified: dbAffiliate.tiktok_is_verified,
    tiktokVideoPlays: dbAffiliate.tiktok_video_plays,
    tiktokVideoLikes: dbAffiliate.tiktok_video_likes,
    tiktokVideoComments: dbAffiliate.tiktok_video_comments,
    tiktokVideoShares: dbAffiliate.tiktok_video_shares,
    
    // ==========================================================================
    // YouTube fields (Added Dec 2025)
    // Maps DB columns youtube_video_x → ResultItem.youtubeVideoX
    // ==========================================================================
    youtubeVideoLikes: dbAffiliate.youtube_video_likes,
    youtubeVideoComments: dbAffiliate.youtube_video_comments,
    
    // ==========================================================================
    // AI GENERATED MESSAGE (Added Dec 17, 2025)
    // 
    // These fields persist the AI-generated outreach email so it survives
    // page refreshes. Previously, generated messages were only stored in
    // React state and were lost on refresh.
    // ==========================================================================
    aiGeneratedMessage: dbAffiliate.ai_generated_message || undefined,
    aiGeneratedSubject: dbAffiliate.ai_generated_subject || undefined,
    aiGeneratedAt: dbAffiliate.ai_generated_at || undefined,
    
    // ==========================================================================
    // AI GENERATED MESSAGES - Per-contact (Added Dec 25, 2025)
    // 
    // When Lusha returns multiple contacts, users can generate personalized
    // emails for each. This stores all messages keyed by contact email.
    // ==========================================================================
    aiGeneratedMessages: parseJsonField(dbAffiliate.ai_generated_messages) || undefined,
  };
}

// Helper to format numbers (e.g., 5700 -> "5.7K")
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// Helper to safely parse JSON fields from database
function parseJsonField(value: any): any {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Build affiliate payload for API calls (without userId for batch)
// This function maps ResultItem fields to the API payload format expected by the backend
function buildAffiliatePayloadWithoutUserId(a: ResultItem) {
  return {
    title: a.title,
    link: a.link,
    domain: a.domain,
    snippet: a.snippet,
    source: a.source,
    isAffiliate: a.isAffiliate,
    personName: a.personName,
    summary: a.summary,
    email: a.email,
    thumbnail: a.thumbnail,
    views: a.views,
    date: a.date,
    rank: a.rank,
    keyword: a.keyword,
    highlightedWords: a.highlightedWords,
    discoveryMethodType: a.discoveryMethod?.type,
    discoveryMethodValue: a.discoveryMethod?.value,
    isAlreadyAffiliate: a.isAlreadyAffiliate,
    isNew: a.isNew,
    channelName: a.channel?.name,
    channelLink: a.channel?.link,
    channelThumbnail: a.channel?.thumbnail,
    channelVerified: a.channel?.verified,
    channelSubscribers: a.channel?.subscribers,
    duration: a.duration,
    
    // ==========================================================================
    // Instagram fields (FIX: these were missing, causing NULL values in database)
    // Maps ResultItem.instagramX → API payload instagramX → DB column instagram_x
    // ==========================================================================
    instagramUsername: a.instagramUsername,
    instagramFullName: a.instagramFullName,
    instagramBio: a.instagramBio,
    instagramFollowers: a.instagramFollowers,
    instagramFollowing: a.instagramFollowing,
    instagramPostsCount: a.instagramPostsCount,
    instagramIsBusiness: a.instagramIsBusiness,
    instagramIsVerified: a.instagramIsVerified,
    // Instagram post-level stats (Added Dec 2025)
    instagramPostLikes: a.instagramPostLikes,
    instagramPostComments: a.instagramPostComments,
    instagramPostViews: a.instagramPostViews,
    
    // ==========================================================================
    // TikTok fields (FIX: these were missing, causing NULL values in database)
    // Maps ResultItem.tiktokX → API payload tiktokX → DB column tiktok_x
    // ==========================================================================
    tiktokUsername: a.tiktokUsername,
    tiktokDisplayName: a.tiktokDisplayName,
    tiktokBio: a.tiktokBio,
    tiktokFollowers: a.tiktokFollowers,
    tiktokFollowing: a.tiktokFollowing,
    tiktokLikes: a.tiktokLikes,
    tiktokVideosCount: a.tiktokVideosCount,
    tiktokIsVerified: a.tiktokIsVerified,
    tiktokVideoPlays: a.tiktokVideoPlays,
    tiktokVideoLikes: a.tiktokVideoLikes,
    tiktokVideoComments: a.tiktokVideoComments,
    tiktokVideoShares: a.tiktokVideoShares,
    
    // YouTube fields (Added Dec 2025)
    youtubeVideoLikes: a.youtubeVideoLikes,
    youtubeVideoComments: a.youtubeVideoComments,
    
    // SimilarWeb fields
    similarwebMonthlyVisits: a.similarWeb?.monthlyVisits,
    similarwebGlobalRank: a.similarWeb?.globalRank,
    similarwebCountryRank: a.similarWeb?.countryRank,
    similarwebCountryCode: a.similarWeb?.countryCode,
    similarwebBounceRate: a.similarWeb?.bounceRate,
    similarwebPagesPerVisit: a.similarWeb?.pagesPerVisit,
    similarwebTimeOnSite: a.similarWeb?.timeOnSite,
    similarwebCategory: a.similarWeb?.category,
    similarwebTrafficSources: a.similarWeb?.trafficSources,
    similarwebTopCountries: a.similarWeb?.topCountries,
    // NEW SimilarWeb fields (Dec 2025)
    similarwebSiteTitle: a.similarWeb?.siteTitle,
    similarwebSiteDescription: a.similarWeb?.siteDescription,
    similarwebScreenshot: a.similarWeb?.screenshot,
    similarwebCategoryRank: a.similarWeb?.categoryRank,
    similarwebMonthlyVisitsHistory: a.similarWeb?.monthlyVisitsHistory,
    similarwebTopKeywords: a.similarWeb?.topKeywords,
    similarwebSnapshotDate: a.similarWeb?.snapshotDate,
  };
}

// Build affiliate payload for API calls (with userId)
function buildAffiliatePayload(userId: number, a: ResultItem) {
  return {
    userId,
    ...buildAffiliatePayloadWithoutUserId(a),
  };
}

// =============================================================================
// SAVED AFFILIATES HOOK - January 3rd, 2026
// 
// Refactored to use SWR for global cache sharing between components.
// All components using useSavedAffiliates() now share the same cached data.
// When any component calls mutate(), all other components update instantly.
// 
// KEY BENEFIT: Sidebar count updates immediately when Page saves/removes affiliate
// =============================================================================
export function useSavedAffiliates() {
  const { userId, isLoading: userLoading } = useNeonUser();
  
  // ===========================================================================
  // SWR DATA FETCHING - January 3rd, 2026
  // 
  // The cache key `/api/affiliates/saved?userId=${userId}` is shared globally.
  // Any component using this key gets the same data from SWR's cache.
  // When we call mutate() after save/remove, ALL components update.
  // 
  // Pass null as key when userId is not available to skip fetching.
  // ===========================================================================
  const swrKey = userId ? `/api/affiliates/saved?userId=${userId}` : null;
  const { data, error, isLoading: swrLoading, mutate } = useSWR(swrKey, fetcher);
  
  // ===========================================================================
  // MEMOIZED TRANSFORM - January 3rd, 2026
  // 
  // CRITICAL: Use useMemo to prevent creating a new array on every render.
  // Without this, components that depend on savedAffiliates in useEffect would
  // trigger infinite loops because the array reference changes every render.
  // 
  // Bug fixed: Outreach page had "Maximum update depth exceeded" error because
  // its useEffect depended on savedAffiliates and re-ran on every render.
  // ===========================================================================
  const savedAffiliates: ResultItem[] = useMemo(() => {
    return data?.affiliates?.map(transformAffiliate) || [];
  }, [data]);
  
  // Combined loading state (user loading OR SWR loading)
  const isLoading = userLoading || swrLoading;

  // ===========================================================================
  // SAVE AFFILIATE - January 3rd, 2026
  // 
  // After saving, we call mutate() with optimistic data. This:
  // 1. Immediately updates ALL components using this cache key (including Sidebar)
  // 2. Revalidates in background to ensure data consistency
  // ===========================================================================
  const saveAffiliate = useCallback(async (affiliate: ResultItem) => {
    if (!userId) return;

    try {
      await fetch('/api/affiliates/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAffiliatePayload(userId, affiliate)),
      });

      // Optimistic update + revalidate: Updates ALL components instantly
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: [
            { ...affiliate, saved_at: new Date().toISOString() },
            ...(currentData?.affiliates || [])
          ]
        }),
        { revalidate: true }
      );
    } catch (err) {
      console.error('Error saving affiliate:', err);
    }
  }, [userId, mutate]);

  // ===========================================================================
  // REMOVE AFFILIATE - January 3rd, 2026
  // 
  // After removing, mutate() updates all components using this cache key.
  // ===========================================================================
  const removeAffiliate = useCallback(async (link: string) => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/saved?userId=${userId}&link=${encodeURIComponent(link)}`, {
        method: 'DELETE',
      });

      // Optimistic update + revalidate: Updates ALL components instantly
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).filter((a: any) => a.link !== link)
        }),
        { revalidate: true }
      );
    } catch (err) {
      console.error('Error removing affiliate:', err);
    }
  }, [userId, mutate]);

  // Check if an affiliate is saved
  const isAffiliateSaved = useCallback((link: string) => {
    return savedAffiliates.some(a => a.link === link);
  }, [savedAffiliates]);

  /**
   * Find email for an affiliate using the enrichment service
   * 
   * Uses the multi-provider enrichment service (Apollo/Lusha) with
   * configurable fallback strategy.
   * 
   * This function extracts ALL available data from the affiliate item
   * to maximize the chances of finding an email:
   * - Web: domain, personName
   * - YouTube: channel name, channel link
   * - Instagram: username, full name, bio (may contain email/links)
   * - TikTok: username, display name, bio
   * 
   * @param affiliate - The full ResultItem with all available data
   * @param options - Additional options (provider override)
   * @returns Enrichment result or null on error
   */
  const findEmail = useCallback(async (
    affiliate: ResultItem,
    options?: {
      provider?: 'apollo' | 'lusha';
    }
  ) => {
    if (!userId || !affiliate.id) return null;

    const affiliateId = affiliate.id;

    // Optimistic update - set status to searching (January 3rd, 2026: uses SWR mutate)
    mutate(
      (currentData: any) => ({
        ...currentData,
        affiliates: (currentData?.affiliates || []).map((a: any) =>
          a.id === affiliateId ? { ...a, email_status: 'searching' } : a
        )
      }),
      { revalidate: false }
    );

    try {
      // ==========================================================================
      // EXTRACT ALL AVAILABLE DATA FROM DIFFERENT SOURCES
      // ==========================================================================
      
      // Determine the best domain to search
      // For social media, we need to find the creator's actual website/company
      let searchDomain = affiliate.domain;
      
      // For YouTube/TikTok/Instagram, the domain might be youtube.com, tiktok.com, etc.
      // We should try to find a better domain from their bio or links
      const isSocialPlatform = ['youtube.com', 'tiktok.com', 'instagram.com', 'www.youtube.com', 'www.tiktok.com', 'www.instagram.com']
        .some(platform => affiliate.domain.toLowerCase().includes(platform));
      
      // If it's a social platform, try to extract a business domain from bio or use channel link
      if (isSocialPlatform) {
        // Try to extract domain from Instagram bio
        if (affiliate.instagramBio) {
          const domainMatch = affiliate.instagramBio.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
          if (domainMatch) {
            searchDomain = domainMatch[1];
          }
        }
        // Try to extract from TikTok bio
        if (affiliate.tiktokBio && searchDomain === affiliate.domain) {
          const domainMatch = affiliate.tiktokBio.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
          if (domainMatch) {
            searchDomain = domainMatch[1];
          }
        }
      }

      // ==========================================================================
      // EXTRACT PERSON NAME FROM ALL AVAILABLE SOURCES
      // Priority: personName > instagramFullName > tiktokDisplayName > channel.name
      // ==========================================================================
      const personName = affiliate.personName 
        || affiliate.instagramFullName 
        || affiliate.tiktokDisplayName 
        || affiliate.channel?.name
        || undefined;

      // ==========================================================================
      // EXTRACT LINKEDIN URL IF AVAILABLE
      // Could be in bio or snippet for some affiliates
      // ==========================================================================
      let linkedinUrl: string | undefined;
      
      // Check Instagram bio for LinkedIn
      if (affiliate.instagramBio) {
        const linkedinMatch = affiliate.instagramBio.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
        if (linkedinMatch) {
          linkedinUrl = `https://www.linkedin.com/in/${linkedinMatch[1]}`;
        }
      }
      
      // Check TikTok bio for LinkedIn
      if (!linkedinUrl && affiliate.tiktokBio) {
        const linkedinMatch = affiliate.tiktokBio.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
        if (linkedinMatch) {
          linkedinUrl = `https://www.linkedin.com/in/${linkedinMatch[1]}`;
        }
      }
      
      // Check snippet for LinkedIn
      if (!linkedinUrl && affiliate.snippet) {
        const linkedinMatch = affiliate.snippet.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
        if (linkedinMatch) {
          linkedinUrl = `https://www.linkedin.com/in/${linkedinMatch[1]}`;
        }
      }

      // ==========================================================================
      // BUILD REQUEST PAYLOAD WITH ALL AVAILABLE DATA
      // ==========================================================================
      const payload = {
        affiliateId,
        userId,
        // Domain info
        domain: searchDomain,
        originalDomain: affiliate.domain, // Keep original for reference
        // Person identification
        personName,
        // Social media usernames (useful for finding business emails)
        instagramUsername: affiliate.instagramUsername,
        tiktokUsername: affiliate.tiktokUsername,
        // Channel info
        channelName: affiliate.channel?.name,
        channelLink: affiliate.channel?.link,
        // LinkedIn if found
        linkedinUrl,
        // Source type (helps API choose best strategy)
        source: affiliate.source,
        // Provider override
        provider: options?.provider,
      };

      const res = await fetch('/api/enrich/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Update cache with result (January 3rd, 2026: uses SWR mutate for global update)
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).map((a: any) =>
            a.id === affiliateId
              ? {
                  ...a,
                  email: data.email || a.email,
                  email_results: {
                    emails: data.emails || (data.email ? [data.email] : []),
                    contacts: data.contacts,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    title: data.title,
                    linkedinUrl: data.linkedinUrl,
                    phoneNumbers: data.phoneNumbers,
                    provider: data.provider,
                  },
                  email_status: data.status,
                  email_searched_at: new Date().toISOString(),
                  email_provider: data.provider || 'apollo',
                }
              : a
          )
        }),
        { revalidate: true }
      );

      // ==========================================================================
      // CREDITS REFRESH - January 4th, 2026
      // 
      // After email lookup completes, backend has consumed email credits (if found).
      // Dispatch event to trigger useCredits hook to refetch from database.
      // 
      // SAFE: Does NOT modify credits - only triggers a refetch of existing DB value.
      // ==========================================================================
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }

      return data;
    } catch (err) {
      console.error('Error finding email:', err);
      
      // Update status to error (January 3rd, 2026: uses SWR mutate)
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).map((a: any) =>
            a.id === affiliateId ? { ...a, email_status: 'error' } : a
          )
        }),
        { revalidate: false }
      );
      
      return null;
    }
  }, [userId, mutate]);

  // ============================================================================
  // BULK SAVE AFFILIATES (Added Dec 2025, Updated January 3rd, 2026 for SWR)
  // Saves multiple affiliates to the pipeline in a single API call.
  // Used by Find New and Discovered pages for "Save Selected" bulk action.
  // 
  // Returns:
  // - savedCount: Number of affiliates successfully saved
  // - duplicateCount: Number of affiliates that were already in pipeline (skipped)
  // - error: Error object if request failed
  // 
  // The API checks for duplicates and only saves new affiliates.
  // January 3rd, 2026: Now uses SWR mutate() to update all components instantly.
  // ============================================================================
  const saveAffiliatesBulk = useCallback(async (affiliates: ResultItem[]): Promise<{
    savedCount: number;
    duplicateCount: number;
    error?: unknown;
  }> => {
    if (!userId || affiliates.length === 0) return { savedCount: 0, duplicateCount: 0 };

    try {
      const res = await fetch('/api/affiliates/saved/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          affiliates: affiliates.map(a => buildAffiliatePayloadWithoutUserId(a)),
        }),
      });

      const data = await res.json();
      const savedCount = data.count || 0;
      const duplicateCount = data.duplicateCount || 0;

      // Revalidate cache to get fresh data from server
      // This updates ALL components using this cache key (including Sidebar)
      if (savedCount > 0) {
        mutate();
      }

      return { savedCount, duplicateCount };
    } catch (err) {
      console.error('Error bulk saving affiliates:', err);
      return { savedCount: 0, duplicateCount: 0, error: err };
    }
  }, [userId, mutate]);

  // ============================================================================
  // BULK FIND EMAILS (Added Dec 2025, Updated January 3rd, 2026 for SWR)
  // Finds emails for multiple affiliates sequentially to respect rate limits.
  // Used by Saved page for "Find Emails" bulk action.
  // 
  // Returns:
  // - foundCount: Number of affiliates where email was found
  // - notFoundCount: Number of affiliates where no email was found
  // - errorCount: Number of affiliates that had errors
  // - skippedCount: Number of affiliates skipped (already had email/searching)
  // 
  // Progress callback allows UI to show real-time progress.
  // January 3rd, 2026: Now uses SWR mutate() to update all components.
  // ============================================================================
  const findEmailsBulk = useCallback(async (
    affiliates: ResultItem[],
    onProgress?: (progress: {
      current: number;
      total: number;
      currentAffiliate: ResultItem;
      status: 'searching' | 'found' | 'not_found' | 'error';
    }) => void
  ): Promise<{
    foundCount: number;
    notFoundCount: number;
    errorCount: number;
    skippedCount: number;
  }> => {
    if (!userId || affiliates.length === 0) {
      return { foundCount: 0, notFoundCount: 0, errorCount: 0, skippedCount: 0 };
    }

    // Filter out affiliates that already have emails or are currently searching
    const affiliatesToSearch = affiliates.filter(a => 
      a.id && 
      a.emailStatus !== 'found' && 
      a.emailStatus !== 'searching' &&
      !a.email
    );

    const skippedCount = affiliates.length - affiliatesToSearch.length;
    let foundCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    // Set all to searching status optimistically (uses SWR mutate)
    const idsToSearch = new Set(affiliatesToSearch.map(a => a.id));
    mutate(
      (currentData: any) => ({
        ...currentData,
        affiliates: (currentData?.affiliates || []).map((a: any) =>
          idsToSearch.has(a.id) ? { ...a, email_status: 'searching' } : a
        )
      }),
      { revalidate: false }
    );

    // Process affiliates sequentially to respect rate limits
    for (let i = 0; i < affiliatesToSearch.length; i++) {
      const affiliate = affiliatesToSearch[i];
      
      // Report progress (searching)
      onProgress?.({
        current: i + 1,
        total: affiliatesToSearch.length,
        currentAffiliate: affiliate,
        status: 'searching',
      });

      try {
        // Use the existing findEmail function logic but inline it here
        // to avoid recursive hook calls and allow better progress tracking
        const searchDomain = extractSearchDomain(affiliate);
        const personName = affiliate.personName 
          || affiliate.instagramFullName 
          || affiliate.tiktokDisplayName 
          || affiliate.channel?.name
          || undefined;

        // Extract LinkedIn URL if available
        let linkedinUrl: string | undefined;
        const bioSources = [affiliate.instagramBio, affiliate.tiktokBio, affiliate.snippet].filter(Boolean);
        for (const bio of bioSources) {
          if (bio) {
            const linkedinMatch = bio.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
            if (linkedinMatch) {
              linkedinUrl = `https://www.linkedin.com/in/${linkedinMatch[1]}`;
              break;
            }
          }
        }

        const payload = {
          affiliateId: affiliate.id,
          userId,
          domain: searchDomain,
          originalDomain: affiliate.domain,
          personName,
          instagramUsername: affiliate.instagramUsername,
          tiktokUsername: affiliate.tiktokUsername,
          channelName: affiliate.channel?.name,
          channelLink: affiliate.channel?.link,
          linkedinUrl,
          source: affiliate.source,
        };

        const res = await fetch('/api/enrich/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        // Determine result status
        const resultStatus = data.status as 'found' | 'not_found' | 'error';
        
        if (resultStatus === 'found') {
          foundCount++;
        } else if (resultStatus === 'error') {
          errorCount++;
        } else {
          notFoundCount++;
        }

        // Update cache with result (uses SWR mutate for global update)
        mutate(
          (currentData: any) => ({
            ...currentData,
            affiliates: (currentData?.affiliates || []).map((a: any) =>
              a.id === affiliate.id
                ? {
                    ...a,
                    email: data.email || a.email,
                    email_results: {
                      emails: data.emails || (data.email ? [data.email] : []),
                      contacts: data.contacts,
                      firstName: data.firstName,
                      lastName: data.lastName,
                      title: data.title,
                      linkedinUrl: data.linkedinUrl,
                      phoneNumbers: data.phoneNumbers,
                      provider: data.provider,
                    },
                    email_status: resultStatus,
                    email_searched_at: new Date().toISOString(),
                    email_provider: data.provider || 'apollo',
                  }
                : a
            )
          }),
          { revalidate: false }
        );

        // Report progress (with result)
        onProgress?.({
          current: i + 1,
          total: affiliatesToSearch.length,
          currentAffiliate: affiliate,
          status: resultStatus,
        });

        // Small delay between requests to be respectful to rate limits
        if (i < affiliatesToSearch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (err) {
        console.error(`Error finding email for affiliate ${affiliate.id}:`, err);
        errorCount++;
        
        // Update status to error (uses SWR mutate)
        mutate(
          (currentData: any) => ({
            ...currentData,
            affiliates: (currentData?.affiliates || []).map((a: any) =>
              a.id === affiliate.id ? { ...a, email_status: 'error' } : a
            )
          }),
          { revalidate: false }
        );

        // Report progress (error)
        onProgress?.({
          current: i + 1,
          total: affiliatesToSearch.length,
          currentAffiliate: affiliate,
          status: 'error',
        });
      }
    }

    // Revalidate at the end to ensure data consistency
    mutate();

    // ==========================================================================
    // CREDITS REFRESH - January 4th, 2026
    // 
    // After bulk email lookup completes, backend has consumed email credits.
    // Dispatch event to trigger useCredits hook to refetch from database.
    // 
    // SAFE: Does NOT modify credits - only triggers a refetch of existing DB value.
    // ==========================================================================
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('credits-updated'));
    }

    return { foundCount, notFoundCount, errorCount, skippedCount };
  }, [userId, mutate]);

  // Helper function to extract the best search domain from an affiliate
  function extractSearchDomain(affiliate: ResultItem): string {
    let searchDomain = affiliate.domain;
    
    const isSocialPlatform = ['youtube.com', 'tiktok.com', 'instagram.com', 'www.youtube.com', 'www.tiktok.com', 'www.instagram.com']
      .some(platform => affiliate.domain.toLowerCase().includes(platform));
    
    if (isSocialPlatform) {
      // Try to extract domain from Instagram bio
      if (affiliate.instagramBio) {
        const domainMatch = affiliate.instagramBio.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
        if (domainMatch) {
          searchDomain = domainMatch[1];
        }
      }
      // Try to extract from TikTok bio
      if (affiliate.tiktokBio && searchDomain === affiliate.domain) {
        const domainMatch = affiliate.tiktokBio.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
        if (domainMatch) {
          searchDomain = domainMatch[1];
        }
      }
    }
    
    return searchDomain;
  }

  // ============================================================================
  // BULK REMOVE AFFILIATES (Added Dec 2025, Updated January 3rd, 2026 for SWR)
  // Removes multiple saved affiliates in a single API call.
  // Used by Saved page for "Delete Selected" bulk action.
  // January 3rd, 2026: Now uses SWR mutate() to update all components instantly.
  // ============================================================================
  const removeAffiliatesBulk = useCallback(async (links: string[]) => {
    if (!userId || links.length === 0) return { removedCount: 0 };

    try {
      const res = await fetch('/api/affiliates/saved/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, links }),
      });

      const data = await res.json();

      // Check if API returned an error
      if (!res.ok || data.error) {
        console.error('API error during bulk remove:', data.error);
        return { removedCount: 0, error: data.error };
      }

      // Update cache after confirmed server success (updates ALL components)
      const linksSet = new Set(links);
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).filter((a: any) => !linksSet.has(a.link))
        }),
        { revalidate: true }
      );

      return { removedCount: data.count || 0 };
    } catch (err) {
      console.error('Error bulk removing affiliates:', err);
      return { removedCount: 0, error: err };
    }
  }, [userId, mutate]);

  // ===========================================================================
  // RETURN VALUES - January 3rd, 2026
  // 
  // The refetch function now uses SWR's mutate() which:
  // 1. Revalidates the cache by fetching fresh data from the server
  // 2. Updates ALL components using this cache key (including Sidebar)
  // ===========================================================================
  return {
    savedAffiliates,
    saveAffiliate,
    removeAffiliate,
    isAffiliateSaved,
    findEmail,
    // Bulk operations (Added Dec 2025)
    saveAffiliatesBulk,
    removeAffiliatesBulk,
    findEmailsBulk,  // Added Dec 2025: Bulk email finding
    isLoading,
    count: savedAffiliates.length,
    refetch: mutate,  // January 3rd, 2026: Now uses SWR mutate for global cache update
  };
}

// =============================================================================
// DISCOVERED AFFILIATES HOOK - January 3rd, 2026
// 
// Refactored to use SWR for global cache sharing between components.
// All components using useDiscoveredAffiliates() now share the same cached data.
// When any component calls mutate(), all other components update instantly.
// 
// KEY BENEFIT: Sidebar count updates immediately when affiliates are discovered
// =============================================================================
export function useDiscoveredAffiliates() {
  const { userId, isLoading: userLoading } = useNeonUser();
  
  // ===========================================================================
  // SWR DATA FETCHING - January 3rd, 2026
  // 
  // The cache key `/api/affiliates/discovered?userId=${userId}` is shared globally.
  // Any component using this key gets the same data from SWR's cache.
  // When we call mutate() after save/remove, ALL components update.
  // 
  // Pass null as key when userId is not available to skip fetching.
  // ===========================================================================
  const swrKey = userId ? `/api/affiliates/discovered?userId=${userId}` : null;
  const { data, error, isLoading: swrLoading, mutate } = useSWR(swrKey, fetcher);
  
  // ===========================================================================
  // MEMOIZED TRANSFORM - January 3rd, 2026
  // 
  // CRITICAL: Use useMemo to prevent creating a new array on every render.
  // Without this, components that depend on discoveredAffiliates in useEffect
  // would trigger infinite loops because the array reference changes every render.
  // ===========================================================================
  const discoveredAffiliates: ResultItem[] = useMemo(() => {
    return data?.affiliates?.map(transformAffiliate) || [];
  }, [data]);
  
  // Combined loading state (user loading OR SWR loading)
  const isLoading = userLoading || swrLoading;

  // ===========================================================================
  // SAVE SINGLE DISCOVERED AFFILIATE - January 3rd, 2026
  // 
  // After saving, we call mutate() with optimistic data. This updates ALL
  // components using this cache key (including Sidebar count).
  // ===========================================================================
  const saveDiscoveredAffiliate = useCallback(async (affiliate: ResultItem, searchKeyword: string) => {
    if (!userId) return;

    try {
      await fetch('/api/affiliates/discovered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildAffiliatePayload(userId, affiliate),
          searchKeyword,
        }),
      });

      // Optimistic update + revalidate: Updates ALL components instantly
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: [
            { ...affiliate, discovered_at: new Date().toISOString(), search_keyword: searchKeyword },
            ...(currentData?.affiliates || [])
          ]
        }),
        { revalidate: true }
      );
    } catch (err) {
      console.error('Error saving discovered affiliate:', err);
    }
  }, [userId, mutate]);

  // ===========================================================================
  // BATCH SAVE DISCOVERED AFFILIATES - January 3rd, 2026
  // 
  // After batch save, mutate() revalidates to get fresh data from server.
  // ===========================================================================
  const saveDiscoveredAffiliates = useCallback(async (affiliates: ResultItem[], searchKeyword: string) => {
    if (!userId || affiliates.length === 0) return;

    try {
      await fetch('/api/affiliates/discovered/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          searchKeyword,
          affiliates: affiliates.map(a => buildAffiliatePayloadWithoutUserId(a)),
        }),
      });

      // Revalidate cache to get fresh data (updates ALL components)
      mutate();
    } catch (err) {
      console.error('Error batch saving discovered affiliates:', err);
    }
  }, [userId, mutate]);

  // ===========================================================================
  // REMOVE DISCOVERED AFFILIATE - January 3rd, 2026
  // 
  // After removing, mutate() updates all components using this cache key.
  // ===========================================================================
  const removeDiscoveredAffiliate = useCallback(async (link: string) => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/discovered?userId=${userId}&link=${encodeURIComponent(link)}`, {
        method: 'DELETE',
      });

      // Optimistic update + revalidate: Updates ALL components instantly
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).filter((a: any) => a.link !== link)
        }),
        { revalidate: true }
      );
    } catch (err) {
      console.error('Error removing discovered affiliate:', err);
    }
  }, [userId, mutate]);

  // ===========================================================================
  // CLEAR ALL DISCOVERED - January 3rd, 2026
  // 
  // After clearing, mutate() updates all components using this cache key.
  // ===========================================================================
  const clearAllDiscovered = useCallback(async () => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/discovered?userId=${userId}&clearAll=true`, {
        method: 'DELETE',
      });

      // Optimistic update: Set to empty array, then revalidate
      mutate({ affiliates: [] }, { revalidate: true });
    } catch (err) {
      console.error('Error clearing discovered affiliates:', err);
    }
  }, [userId, mutate]);

  // ============================================================================
  // BULK REMOVE DISCOVERED AFFILIATES (Added Dec 2025, Updated January 3rd, 2026)
  // Removes multiple discovered affiliates in a single API call.
  // Used by Discovered and Find New pages for "Delete Selected" bulk action.
  // January 3rd, 2026: Now uses SWR mutate() to update all components instantly.
  // ============================================================================
  const removeDiscoveredAffiliatesBulk = useCallback(async (links: string[]) => {
    if (!userId || links.length === 0) return { removedCount: 0 };

    try {
      const res = await fetch('/api/affiliates/discovered/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, links }),
      });

      const data = await res.json();

      // Check if API returned an error
      if (!res.ok || data.error) {
        console.error('API error during bulk remove:', data.error);
        return { removedCount: 0, error: data.error };
      }

      // Update cache after confirmed server success (updates ALL components)
      const linksSet = new Set(links);
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).filter((a: any) => !linksSet.has(a.link))
        }),
        { revalidate: true }
      );

      return { removedCount: data.count || 0 };
    } catch (err) {
      console.error('Error bulk removing discovered affiliates:', err);
      return { removedCount: 0, error: err };
    }
  }, [userId, mutate]);

  // ============================================================================
  // UPDATE SIMILARWEB DATA (Added December 16, 2025, Updated January 3rd, 2026)
  // 
  // CRITICAL BUG FIX: SimilarWeb data was never persisted to the database.
  // 
  // When enrichment_update events arrive from the server, this function
  // updates the SimilarWeb fields for all discovered affiliates matching
  // the domain. This ensures data persists across page refreshes.
  // 
  // January 3rd, 2026: Now uses SWR mutate() for global cache update.
  // ============================================================================
  const updateDiscoveredAffiliateSimilarWeb = useCallback(async (
    domain: string, 
    similarWeb: SimilarWebData
  ) => {
    if (!userId) return;

    try {
      const response = await fetch('/api/affiliates/discovered', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          domain,
          similarWeb,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update SimilarWeb data');
      }

      // Update cache with SimilarWeb data (updates ALL components)
      mutate(
        (currentData: any) => ({
          ...currentData,
          affiliates: (currentData?.affiliates || []).map((affiliate: any) => {
            if (affiliate.domain === domain && affiliate.source === 'Web') {
              return {
                ...affiliate,
                similarweb_monthly_visits: similarWeb.monthlyVisits,
                similarweb_global_rank: similarWeb.globalRank,
                similarweb_country_rank: similarWeb.countryRank,
                similarweb_country_code: similarWeb.countryCode,
                similarweb_bounce_rate: similarWeb.bounceRate,
                similarweb_pages_per_visit: similarWeb.pagesPerVisit,
                similarweb_time_on_site: similarWeb.timeOnSite,
                similarweb_category: similarWeb.category,
                similarweb_traffic_sources: similarWeb.trafficSources,
                similarweb_top_countries: similarWeb.topCountries,
                is_enriching: false,
              };
            }
            return affiliate;
          })
        }),
        { revalidate: false }
      );
    } catch (err) {
      console.error('Error updating SimilarWeb data:', err);
    }
  }, [userId, mutate]);

  // ===========================================================================
  // RETURN VALUES - January 3rd, 2026
  // 
  // The refetch function now uses SWR's mutate() which:
  // 1. Revalidates the cache by fetching fresh data from the server
  // 2. Updates ALL components using this cache key (including Sidebar)
  // ===========================================================================
  return {
    discoveredAffiliates,
    saveDiscoveredAffiliate,
    saveDiscoveredAffiliates,
    removeDiscoveredAffiliate,
    clearAllDiscovered,
    // Bulk operations (Added Dec 2025)
    removeDiscoveredAffiliatesBulk,
    // SimilarWeb update (Added Dec 16, 2025 - Critical bug fix)
    updateDiscoveredAffiliateSimilarWeb,
    isLoading,
    count: discoveredAffiliates.length,
    refetch: mutate,  // January 3rd, 2026: Now uses SWR mutate for global cache update
  };
}
