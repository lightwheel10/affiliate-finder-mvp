import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const ENRICHMENT_PLATFORMS = [
  'youtube',
  'instagram',
  'tiktok',
  'similarweb',
] as const;

export type EnrichmentPlatform = typeof ENRICHMENT_PLATFORMS[number];

export interface EnrichmentUrlGroups {
  youtube: string[];
  instagram: string[];
  tiktok: string[];
  similarweb: string[];
}

export interface EnrichmentDispatchInput {
  platform: EnrichmentPlatform;
  urls: string[];
  inputFingerprint: string;
}

const MAX_INPUTS_PER_PLATFORM = 500;
const MAX_INPUT_LENGTH = 2_048;

export interface EnrichmentDispatchContext {
  accountId: number;
  jobId: number;
  brandId: string;
  brandLocationId: string;
}

export interface ClaimedEnrichmentDispatch extends EnrichmentDispatchInput {
  id: string;
  claimToken: string;
}

export type ClaimEnrichmentDispatchResult =
  | { outcome: 'claimed'; dispatch: ClaimedEnrichmentDispatch }
  | { outcome: 'unavailable' };

export type EnrichmentDispatchSetupResult =
  | { outcome: 'ready'; runIds: Partial<Record<EnrichmentPlatform, string>> }
  | { outcome: 'in_progress' | 'blocked' };

export interface EnrichmentDispatchDependencies {
  claimDispatch(
    context: EnrichmentDispatchContext,
    platform: EnrichmentPlatform,
  ): Promise<ClaimEnrichmentDispatchResult>;
  markLaunchAttempted(dispatch: ClaimedEnrichmentDispatch): Promise<void>;
  startProvider(dispatch: ClaimedEnrichmentDispatch): Promise<string>;
  recordRun(dispatch: ClaimedEnrichmentDispatch, runId: string): Promise<void>;
  markFailed(
    dispatch: ClaimedEnrichmentDispatch,
    message: string,
    runId?: string,
  ): Promise<void>;
  markUncertain(
    dispatch: ClaimedEnrichmentDispatch,
    message: string,
    runId?: string,
  ): Promise<void>;
  abortProvider(runId: string): Promise<void>;
  finalizeSetup(
    context: EnrichmentDispatchContext,
  ): Promise<EnrichmentDispatchSetupResult>;
}

export class EnrichmentProviderStartError extends Error {
  constructor(
    message: string,
    public readonly externalStartMayHaveSucceeded: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EnrichmentProviderStartError';
  }
}

function isAllowedHost(hostname: string, registrableDomain: string): boolean {
  return hostname === registrableDomain || hostname.endsWith(`.${registrableDomain}`);
}

function canonicalHttpUrl(
  value: string,
  registrableDomain: string,
  validPath: (url: URL) => boolean,
): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:')
      || url.username !== ''
      || url.password !== ''
      || url.port !== ''
      || !isAllowedHost(url.hostname.toLowerCase(), registrableDomain)
      || !validPath(url)
    ) {
      return null;
    }
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalDomain(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:')
      || url.username !== ''
      || url.password !== ''
      || url.port !== ''
    ) {
      return null;
    }
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    const labels = domain.split('.');
    if (
      domain.length > 253
      || isIP(domain) !== 0
      || labels.length < 2
      || labels.some((label) =>
        label.length === 0
        || label.length > 63
        || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
    ) {
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

function normalizePlatformUrls(
  platform: EnrichmentPlatform,
  values: readonly string[],
): string[] {
  const normalized = values.flatMap((value) => {
    switch (platform) {
      case 'youtube': {
        const canonical = canonicalHttpUrl(value, 'youtube.com', (url) =>
          url.pathname === '/watch' && Boolean(url.searchParams.get('v')));
        const short = canonical ?? canonicalHttpUrl(value, 'youtu.be', (url) =>
          url.pathname.split('/').filter(Boolean).length === 1);
        return short ? [short] : [];
      }
      case 'instagram': {
        const canonical = canonicalHttpUrl(value, 'instagram.com', (url) =>
          // Apify's Instagram actor only accepts the bare and www hosts. Google
          // sometimes returns www-fallback.instagram.com links; sending even one
          // of those causes Apify to reject the entire enrichment batch.
          (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com')
          && url.pathname !== '/');
        return canonical ? [canonical] : [];
      }
      case 'tiktok': {
        const canonical = canonicalHttpUrl(value, 'tiktok.com', (url) =>
          /\/video\/[^/]+/.test(url.pathname));
        return canonical ? [canonical] : [];
      }
      case 'similarweb': {
        const canonical = canonicalDomain(value);
        return canonical ? [canonical] : [];
      }
    }
  });
  const unique = [...new Set(normalized)].sort();
  if (unique.length > MAX_INPUTS_PER_PLATFORM) {
    throw new Error(
      `${platform} enrichment exceeds the ${MAX_INPUTS_PER_PLATFORM}-input safety limit.`,
    );
  }
  return unique;
}

function fingerprint(platform: EnrichmentPlatform, urls: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify({ platform, urls }))
    .digest('hex');
}

export function buildEnrichmentDispatchInputs(
  groups: EnrichmentUrlGroups,
): EnrichmentDispatchInput[] {
  return ENRICHMENT_PLATFORMS.flatMap((platform) => {
    const urls = normalizePlatformUrls(platform, groups[platform]);
    return urls.length === 0
      ? []
      : [{ platform, urls, inputFingerprint: fingerprint(platform, urls) }];
  });
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 2_000) || 'Unknown enrichment dispatch failure';
}

async function dispatchOne(
  context: EnrichmentDispatchContext,
  platform: EnrichmentPlatform,
  dependencies: EnrichmentDispatchDependencies,
): Promise<void> {
  const claim = await dependencies.claimDispatch(context, platform);
  if (claim.outcome !== 'claimed') return;
  const dispatch = claim.dispatch;

  try {
    await dependencies.markLaunchAttempted(dispatch);
  } catch {
    // No provider call occurred. The durable claim can be reclaimed only after
    // its bounded pre-launch lease expires.
    return;
  }

  let runId: string;
  try {
    runId = await dependencies.startProvider(dispatch);
  } catch (error) {
    const message = boundedError(error);
    try {
      if (
        error instanceof EnrichmentProviderStartError
        && !error.externalStartMayHaveSucceeded
      ) {
        await dependencies.markFailed(dispatch, message);
      } else {
        await dependencies.markUncertain(dispatch, message);
      }
    } catch {
      // Leaving the row in launch-attempted state is deliberate fail-closed
      // behavior: no later poll may launch another paid actor automatically.
    }
    return;
  }

  try {
    await dependencies.recordRun(dispatch, runId);
  } catch (recordError) {
    try {
      await dependencies.abortProvider(runId);
    } catch (abortError) {
      try {
        await dependencies.markUncertain(
          dispatch,
          `${boundedError(recordError)}; abort failed: ${boundedError(abortError)}`,
          runId,
        );
      } catch {
        // The launch-attempted row remains non-retryable if the database is
        // unavailable, preventing a duplicate actor after process recovery.
      }
      return;
    }

    try {
      await dependencies.markFailed(
        dispatch,
        `Provider run was aborted after persistence failed: ${boundedError(recordError)}`,
        runId,
      );
    } catch {
      // The provider is already aborted. A later reconciliation can safely
      // repair the dispatch row without launching another actor.
    }
  }
}

/**
 * Dispatches each platform independently. Every external launch is preceded
 * by a durable per-platform claim and launch-attempt marker, so partial errors
 * or a restarted process cannot automatically launch the same actor twice.
 */
export async function dispatchEnrichmentActors(
  context: EnrichmentDispatchContext,
  dependencies: EnrichmentDispatchDependencies,
): Promise<EnrichmentDispatchSetupResult> {
  await Promise.all(
    ENRICHMENT_PLATFORMS.map((platform) =>
      dispatchOne(context, platform, dependencies)),
  );
  return dependencies.finalizeSetup(context);
}
