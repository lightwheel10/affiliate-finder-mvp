'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNeonUser } from './useNeonUser';
import { ResultItem } from '../types';

// Transform database affiliate to ResultItem format
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
  const channel = dbAffiliate.channel_name ? {
    name: dbAffiliate.channel_name,
    link: dbAffiliate.channel_link || '',
    thumbnail: dbAffiliate.channel_thumbnail,
    verified: dbAffiliate.channel_verified,
    subscribers: dbAffiliate.channel_subscribers,
  } : (dbAffiliate.tiktok_username ? {
    // Fallback to TikTok data for channel display
    name: dbAffiliate.tiktok_display_name || dbAffiliate.tiktok_username,
    link: `https://www.tiktok.com/@${dbAffiliate.tiktok_username}`,
    verified: dbAffiliate.tiktok_is_verified,
    subscribers: dbAffiliate.tiktok_followers ? formatNumber(dbAffiliate.tiktok_followers) : undefined,
  } : undefined);

  return {
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

  return {
    savedAffiliates,
    saveAffiliate,
    removeAffiliate,
    isAffiliateSaved,
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

  return {
    discoveredAffiliates,
    saveDiscoveredAffiliate,
    saveDiscoveredAffiliates,
    removeDiscoveredAffiliate,
    clearAllDiscovered,
    isLoading: userLoading || isLoading,
    count: discoveredAffiliates.length,
    refetch: fetchDiscoveredAffiliates,
  };
}
