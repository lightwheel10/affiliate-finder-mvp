'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNeonUser } from './useNeonUser';
import { ResultItem } from '../types';

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
  };
}

// Build affiliate payload for API calls (with userId)
function buildAffiliatePayload(userId: number, a: ResultItem) {
  return {
    userId,
    ...buildAffiliatePayloadWithoutUserId(a),
  };
}

/**
 * Hook for managing saved affiliates (pipeline)
 */
export function useSavedAffiliates() {
  const { userId, isLoading: userLoading } = useNeonUser();
  const [savedAffiliates, setSavedAffiliates] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch saved affiliates
  const fetchSavedAffiliates = useCallback(async () => {
    if (!userId) {
      setSavedAffiliates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/affiliates/saved?userId=${userId}`);
      const data = await res.json();
      if (data.affiliates) {
        setSavedAffiliates(data.affiliates.map(transformAffiliate));
      }
    } catch (err) {
      console.error('Error fetching saved affiliates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchSavedAffiliates();
  }, [fetchSavedAffiliates]);

  // Save an affiliate
  const saveAffiliate = useCallback(async (affiliate: ResultItem) => {
    if (!userId) return;

    try {
      await fetch('/api/affiliates/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAffiliatePayload(userId, affiliate)),
      });

      // Optimistic update
      setSavedAffiliates(prev => [{ ...affiliate, savedAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      console.error('Error saving affiliate:', err);
    }
  }, [userId]);

  // Remove a saved affiliate
  const removeAffiliate = useCallback(async (link: string) => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/saved?userId=${userId}&link=${encodeURIComponent(link)}`, {
        method: 'DELETE',
      });

      // Optimistic update
      setSavedAffiliates(prev => prev.filter(a => a.link !== link));
    } catch (err) {
      console.error('Error removing affiliate:', err);
    }
  }, [userId]);

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

    // Optimistic update - set status to searching
    setSavedAffiliates(prev => prev.map(a => 
      a.id === affiliateId ? { ...a, emailStatus: 'searching' as const } : a
    ));

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

      // Update local state with result (including all contacts for modal display)
      setSavedAffiliates(prev => prev.map(a => 
        a.id === affiliateId 
          ? { 
              ...a, 
              email: data.email || a.email,
              // Store all email results for display
              emailResults: {
                emails: data.emails || (data.email ? [data.email] : []),
                contacts: data.contacts,  // All contacts with full details
                firstName: data.firstName,
                lastName: data.lastName,
                title: data.title,
                linkedinUrl: data.linkedinUrl,
                phoneNumbers: data.phoneNumbers,
                provider: data.provider,
              },
              emailStatus: data.status as 'found' | 'not_found' | 'error',
              emailSearchedAt: new Date().toISOString(),
              emailProvider: data.provider || 'apollo',
            } 
          : a
      ));

      return data;
    } catch (err) {
      console.error('Error finding email:', err);
      
      // Update status to error
      setSavedAffiliates(prev => prev.map(a => 
        a.id === affiliateId ? { ...a, emailStatus: 'error' as const } : a
      ));
      
      return null;
    }
  }, [userId]);

  // ============================================================================
  // BULK SAVE AFFILIATES (Added Dec 2025)
  // Saves multiple affiliates to the pipeline in a single API call.
  // Used by Find New and Discovered pages for "Save Selected" bulk action.
  // 
  // Returns:
  // - savedCount: Number of affiliates successfully saved
  // - duplicateCount: Number of affiliates that were already in pipeline (skipped)
  // - error: Error object if request failed
  // 
  // The API checks for duplicates and only saves new affiliates.
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

      // Only add actually saved affiliates to local state (not duplicates)
      // Filter out affiliates that were already saved (duplicates)
      if (savedCount > 0) {
        const now = new Date().toISOString();
        // Get the links that were actually saved (not duplicates)
        const existingLinks = new Set(savedAffiliates.map(a => a.link));
        const newAffiliates = affiliates.filter(a => !existingLinks.has(a.link));
        
        setSavedAffiliates(prev => [
          ...newAffiliates.map(a => ({ ...a, savedAt: now })),
          ...prev
        ]);
      }

      return { savedCount, duplicateCount };
    } catch (err) {
      console.error('Error bulk saving affiliates:', err);
      return { savedCount: 0, duplicateCount: 0, error: err };
    }
  }, [userId, savedAffiliates]);

  // ============================================================================
  // BULK FIND EMAILS (Added Dec 2025)
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

    // Set all to searching status optimistically
    setSavedAffiliates(prev => prev.map(a => {
      const shouldSearch = affiliatesToSearch.some(toSearch => toSearch.id === a.id);
      if (shouldSearch) {
        return { ...a, emailStatus: 'searching' as const };
      }
      return a;
    }));

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

        // Update local state with result
        setSavedAffiliates(prev => prev.map(a => 
          a.id === affiliate.id 
            ? { 
                ...a, 
                email: data.email || a.email,
                emailResults: {
                  emails: data.emails || (data.email ? [data.email] : []),
                  contacts: data.contacts,
                  firstName: data.firstName,
                  lastName: data.lastName,
                  title: data.title,
                  linkedinUrl: data.linkedinUrl,
                  phoneNumbers: data.phoneNumbers,
                  provider: data.provider,
                },
                emailStatus: resultStatus,
                emailSearchedAt: new Date().toISOString(),
                emailProvider: data.provider || 'apollo',
              } 
            : a
        ));

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
        
        // Update status to error
        setSavedAffiliates(prev => prev.map(a => 
          a.id === affiliate.id ? { ...a, emailStatus: 'error' as const } : a
        ));

        // Report progress (error)
        onProgress?.({
          current: i + 1,
          total: affiliatesToSearch.length,
          currentAffiliate: affiliate,
          status: 'error',
        });
      }
    }

    return { foundCount, notFoundCount, errorCount, skippedCount };
  }, [userId]);

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
  // BULK REMOVE AFFILIATES (Added Dec 2025)
  // Removes multiple saved affiliates in a single API call.
  // Used by Saved page for "Delete Selected" bulk action.
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

      // Only update local state after confirmed server success
      setSavedAffiliates(prev => prev.filter(a => !links.includes(a.link)));

      return { removedCount: data.count || 0 };
    } catch (err) {
      console.error('Error bulk removing affiliates:', err);
      return { removedCount: 0, error: err };
    }
  }, [userId]);

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
    isLoading: userLoading || isLoading,
    count: savedAffiliates.length,
    refetch: fetchSavedAffiliates,
  };
}

/**
 * Hook for managing discovered affiliates
 */
export function useDiscoveredAffiliates() {
  const { userId, isLoading: userLoading } = useNeonUser();
  const [discoveredAffiliates, setDiscoveredAffiliates] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch discovered affiliates
  const fetchDiscoveredAffiliates = useCallback(async () => {
    if (!userId) {
      setDiscoveredAffiliates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/affiliates/discovered?userId=${userId}`);
      const data = await res.json();
      if (data.affiliates) {
        setDiscoveredAffiliates(data.affiliates.map(transformAffiliate));
      }
    } catch (err) {
      console.error('Error fetching discovered affiliates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchDiscoveredAffiliates();
  }, [fetchDiscoveredAffiliates]);

  // Save a single discovered affiliate
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

      // Optimistic update
      setDiscoveredAffiliates(prev => [
        { ...affiliate, discoveredAt: new Date().toISOString(), searchKeyword },
        ...prev
      ]);
    } catch (err) {
      console.error('Error saving discovered affiliate:', err);
    }
  }, [userId]);

  // Batch save discovered affiliates
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

      // Refetch to get accurate data
      fetchDiscoveredAffiliates();
    } catch (err) {
      console.error('Error batch saving discovered affiliates:', err);
    }
  }, [userId, fetchDiscoveredAffiliates]);

  // Remove a discovered affiliate
  const removeDiscoveredAffiliate = useCallback(async (link: string) => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/discovered?userId=${userId}&link=${encodeURIComponent(link)}`, {
        method: 'DELETE',
      });

      // Optimistic update
      setDiscoveredAffiliates(prev => prev.filter(a => a.link !== link));
    } catch (err) {
      console.error('Error removing discovered affiliate:', err);
    }
  }, [userId]);

  // Clear all discovered affiliates
  const clearAllDiscovered = useCallback(async () => {
    if (!userId) return;

    try {
      await fetch(`/api/affiliates/discovered?userId=${userId}&clearAll=true`, {
        method: 'DELETE',
      });

      // Optimistic update
      setDiscoveredAffiliates([]);
    } catch (err) {
      console.error('Error clearing discovered affiliates:', err);
    }
  }, [userId]);

  // ============================================================================
  // BULK REMOVE DISCOVERED AFFILIATES (Added Dec 2025)
  // Removes multiple discovered affiliates in a single API call.
  // Used by Discovered and Find New pages for "Delete Selected" bulk action.
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

      // Only update local state after confirmed server success
      setDiscoveredAffiliates(prev => prev.filter(a => !links.includes(a.link)));

      return { removedCount: data.count || 0 };
    } catch (err) {
      console.error('Error bulk removing discovered affiliates:', err);
      return { removedCount: 0, error: err };
    }
  }, [userId]);

  return {
    discoveredAffiliates,
    saveDiscoveredAffiliate,
    saveDiscoveredAffiliates,
    removeDiscoveredAffiliate,
    clearAllDiscovered,
    // Bulk operations (Added Dec 2025)
    removeDiscoveredAffiliatesBulk,
    isLoading: userLoading || isLoading,
    count: discoveredAffiliates.length,
    refetch: fetchDiscoveredAffiliates,
  };
}
