'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useNeonUser } from './useNeonUser';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useBlockedDomains() {
  const { userId, isLoading: userLoading } = useNeonUser();
  const swrKey = userId ? `/api/blocked-domains?userId=${userId}` : null;
  const { data, mutate, isLoading: swrLoading } = useSWR(swrKey, fetcher);

  const blockedDomains: string[] = useMemo(() => {
    const list = data?.blockedDomains ?? [];
    return list.map((r: { domain: string }) => r.domain);
  }, [data]);

  const blockedSet = useMemo(() => new Set(blockedDomains.map((d) => d.toLowerCase())), [blockedDomains]);
  const count = blockedDomains.length;
  const isAtLimit = count >= 10;

  const isBlocked = useCallback(
    (domain: string) => {
      if (!domain) return false;
      const normalized = domain.toLowerCase().replace(/^www\./, '');
      return blockedSet.has(normalized);
    },
    [blockedSet]
  );

  const blockDomain = useCallback(
    async (domain: string) => {
      if (!userId) return;
      const res = await fetch('/api/blocked-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, domain }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Failed to block domain');
      }
      await mutate();
    },
    [userId, mutate]
  );

  const unblockDomain = useCallback(
    async (domain: string) => {
      if (!userId) return;
      await fetch(
        `/api/blocked-domains?userId=${userId}&domain=${encodeURIComponent(domain)}`,
        { method: 'DELETE' }
      );
      await mutate();
    },
    [userId, mutate]
  );

  return {
    blockedDomains,
    blockDomain,
    unblockDomain,
    isBlocked,
    count,
    isAtLimit,
    isLoading: userLoading || swrLoading,
    rawData: data?.blockedDomains ?? [],
    mutate,
  };
}
