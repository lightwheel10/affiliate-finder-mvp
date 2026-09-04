'use client';

import useSWR from 'swr';
import { isMultiBrandLocationsEnabled } from '@/lib/feature-flags';
import {
  buildBrandPortfolioCacheKey,
  type BrandPortfolioCacheKey,
  type ManagedPortfolio,
} from '@/lib/brand-locations/portfolio';

export class BrandLocationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'BrandLocationApiError';
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as {
    error?: unknown;
    code?: unknown;
  } | null;
  if (!response.ok) {
    throw new BrandLocationApiError(
      typeof body?.error === 'string' ? body.error : 'The request could not be completed.',
      response.status,
      typeof body?.code === 'string' ? body.code : 'REQUEST_FAILED',
    );
  }
  return body as T;
}

async function fetchPortfolio([url]: BrandPortfolioCacheKey): Promise<ManagedPortfolio> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  return readJsonResponse<ManagedPortfolio>(response);
}

export async function requestBrandLocationApi<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  return readJsonResponse<T>(response);
}

export function useBrandPortfolio(
  authUserId: string | null,
  includeArchived = false,
  fallbackData?: ManagedPortfolio,
) {
  const featureEnabled = isMultiBrandLocationsEnabled();
  const key = featureEnabled
    ? buildBrandPortfolioCacheKey(authUserId, includeArchived)
    : null;
  const { data, error, isLoading, mutate } = useSWR<ManagedPortfolio>(
    key,
    fetchPortfolio,
    {
      dedupingInterval: 30_000,
      errorRetryCount: 2,
      fallbackData,
      // This key contains the Supabase Auth UUID. Reusing data from the
      // previous key could briefly expose account A's portfolio while account
      // B is authenticating in the same mounted browser tree.
      keepPreviousData: false,
      revalidateOnFocus: false,
    },
  );

  return {
    featureEnabled,
    portfolio: data,
    error: error instanceof Error ? error : null,
    isLoading: featureEnabled && isLoading,
    refresh: mutate,
  };
}
