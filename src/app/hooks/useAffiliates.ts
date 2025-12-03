'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useConvexUser } from './useConvexUser';
import { ResultItem } from '../types';
import { useCallback } from 'react';

/**
 * Hook for managing saved affiliates (pipeline)
 */
export function useSavedAffiliates() {
  const { userId, isLoading: userLoading } = useConvexUser();
  
  // Query saved affiliates
  const savedAffiliates = useQuery(
    api.affiliates.getSaved,
    userId ? { userId } : 'skip'
  );
  
  // Mutations
  const saveMutation = useMutation(api.affiliates.save);
  const removeMutation = useMutation(api.affiliates.removeSaved);
  
  // Save an affiliate
  const saveAffiliate = useCallback(async (affiliate: ResultItem) => {
    if (!userId) return;
    
    await saveMutation({
      userId,
      title: affiliate.title,
      link: affiliate.link,
      domain: affiliate.domain,
      snippet: affiliate.snippet,
      source: affiliate.source,
      isAffiliate: affiliate.isAffiliate,
      personName: affiliate.personName,
      summary: affiliate.summary,
      email: affiliate.email,
      thumbnail: affiliate.thumbnail,
      views: affiliate.views,
      date: affiliate.date,
      rank: affiliate.rank,
      keyword: affiliate.keyword,
      // Discovery method
      highlightedWords: affiliate.highlightedWords,
      discoveryMethodType: affiliate.discoveryMethod?.type,
      discoveryMethodValue: affiliate.discoveryMethod?.value,
      isAlreadyAffiliate: affiliate.isAlreadyAffiliate,
      isNew: affiliate.isNew,
      // YouTube specific
      channelName: affiliate.channel?.name,
      channelLink: affiliate.channel?.link,
      channelThumbnail: affiliate.channel?.thumbnail,
      channelVerified: affiliate.channel?.verified,
      channelSubscribers: affiliate.channel?.subscribers,
      duration: affiliate.duration,
    });
  }, [userId, saveMutation]);
  
  // Remove a saved affiliate
  const removeAffiliate = useCallback(async (link: string) => {
    if (!userId) return;
    await removeMutation({ userId, link });
  }, [userId, removeMutation]);
  
  // Check if an affiliate is saved
  const isAffiliateSaved = useCallback((link: string) => {
    if (!savedAffiliates) return false;
    return savedAffiliates.some(a => a.link === link);
  }, [savedAffiliates]);
  
  // Transform Convex data to ResultItem format
  const affiliates = savedAffiliates?.map(a => ({
    ...a,
    savedAt: new Date(a.savedAt).toISOString(),
    highlightedWords: a.highlightedWords,
    discoveryMethod: a.discoveryMethodType ? {
      type: a.discoveryMethodType as 'competitor' | 'keyword' | 'topic' | 'tagged',
      value: a.discoveryMethodValue || '',
    } : undefined,
    channel: a.channelName ? {
      name: a.channelName,
      link: a.channelLink || '',
      thumbnail: a.channelThumbnail,
      verified: a.channelVerified,
      subscribers: a.channelSubscribers,
    } : undefined,
  })) || [];
  
  return {
    savedAffiliates: affiliates,
    saveAffiliate,
    removeAffiliate,
    isAffiliateSaved,
    isLoading: userLoading || savedAffiliates === undefined,
    count: affiliates.length,
  };
}

/**
 * Hook for managing discovered affiliates
 */
export function useDiscoveredAffiliates() {
  const { userId, isLoading: userLoading } = useConvexUser();
  
  // Query discovered affiliates
  const discoveredAffiliates = useQuery(
    api.affiliates.getDiscovered,
    userId ? { userId } : 'skip'
  );
  
  // Mutations
  const saveDiscoveredMutation = useMutation(api.affiliates.saveDiscovered);
  const saveDiscoveredBatchMutation = useMutation(api.affiliates.saveDiscoveredBatch);
  const removeMutation = useMutation(api.affiliates.removeDiscovered);
  const clearAllMutation = useMutation(api.affiliates.clearAllDiscovered);
  
  // Save a single discovered affiliate
  const saveDiscoveredAffiliate = useCallback(async (affiliate: ResultItem, searchKeyword: string) => {
    if (!userId) return;
    
    await saveDiscoveredMutation({
      userId,
      searchKeyword,
      title: affiliate.title,
      link: affiliate.link,
      domain: affiliate.domain,
      snippet: affiliate.snippet,
      source: affiliate.source,
      isAffiliate: affiliate.isAffiliate,
      personName: affiliate.personName,
      summary: affiliate.summary,
      email: affiliate.email,
      thumbnail: affiliate.thumbnail,
      views: affiliate.views,
      date: affiliate.date,
      rank: affiliate.rank,
      keyword: affiliate.keyword,
      // Discovery method
      highlightedWords: affiliate.highlightedWords,
      discoveryMethodType: affiliate.discoveryMethod?.type,
      discoveryMethodValue: affiliate.discoveryMethod?.value,
      isAlreadyAffiliate: affiliate.isAlreadyAffiliate,
      isNew: affiliate.isNew,
      // YouTube specific
      channelName: affiliate.channel?.name,
      channelLink: affiliate.channel?.link,
      channelThumbnail: affiliate.channel?.thumbnail,
      channelVerified: affiliate.channel?.verified,
      channelSubscribers: affiliate.channel?.subscribers,
      duration: affiliate.duration,
    });
  }, [userId, saveDiscoveredMutation]);
  
  // Batch save discovered affiliates
  const saveDiscoveredAffiliates = useCallback(async (affiliates: ResultItem[], searchKeyword: string) => {
    if (!userId || affiliates.length === 0) return;
    
    await saveDiscoveredBatchMutation({
      userId,
      searchKeyword,
      affiliates: affiliates.map(a => ({
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
        // Discovery method
        highlightedWords: a.highlightedWords,
        discoveryMethodType: a.discoveryMethod?.type,
        discoveryMethodValue: a.discoveryMethod?.value,
        isAlreadyAffiliate: a.isAlreadyAffiliate,
        isNew: a.isNew,
        // YouTube specific
        channelName: a.channel?.name,
        channelLink: a.channel?.link,
        channelThumbnail: a.channel?.thumbnail,
        channelVerified: a.channel?.verified,
        channelSubscribers: a.channel?.subscribers,
        duration: a.duration,
      })),
    });
  }, [userId, saveDiscoveredBatchMutation]);
  
  // Remove a discovered affiliate
  const removeDiscoveredAffiliate = useCallback(async (link: string) => {
    if (!userId) return;
    await removeMutation({ userId, link });
  }, [userId, removeMutation]);
  
  // Clear all discovered affiliates
  const clearAllDiscovered = useCallback(async () => {
    if (!userId) return;
    await clearAllMutation({ userId });
  }, [userId, clearAllMutation]);
  
  // Transform Convex data to ResultItem format
  const affiliates = discoveredAffiliates?.map(a => ({
    ...a,
    discoveredAt: new Date(a.discoveredAt).toISOString(),
    highlightedWords: a.highlightedWords,
    discoveryMethod: a.discoveryMethodType ? {
      type: a.discoveryMethodType as 'competitor' | 'keyword' | 'topic' | 'tagged',
      value: a.discoveryMethodValue || '',
    } : undefined,
    channel: a.channelName ? {
      name: a.channelName,
      link: a.channelLink || '',
      thumbnail: a.channelThumbnail,
      verified: a.channelVerified,
      subscribers: a.channelSubscribers,
    } : undefined,
  })) || [];
  
  return {
    discoveredAffiliates: affiliates,
    saveDiscoveredAffiliate,
    saveDiscoveredAffiliates,
    removeDiscoveredAffiliate,
    clearAllDiscovered,
    isLoading: userLoading || discoveredAffiliates === undefined,
    count: affiliates.length,
  };
}

