import 'server-only';

import type postgres from 'postgres';
import { API_COSTS } from '@/app/services/tracking';
import { sql } from '@/lib/db';
import {
  dedupeSearchResults,
  normalizeResultSnapshot,
  parseSearchJobRuntimeContext,
  SearchStatusIntegrityError,
  type DiscoveryMethod,
  type SearchJobRuntimeContext,
  type SearchResultSnapshot,
  type SearchStatusJobRow,
} from '@/lib/search/status';

type SqlClient = postgres.Sql;

interface SearchStatusAuditInput {
  estimatedCostUsd: number | null;
  durationMs: number;
  auditStatus: 'success' | 'error' | 'timeout';
}

export interface SearchFinalizationInput {
  results: readonly SearchResultSnapshot[];
  enrichmentSucceeded: boolean;
  estimatedCostUsd: number | null;
  durationMs: number;
}

export interface SearchFailureInput {
  terminalStatus: 'failed' | 'timeout';
  errorMessage: string;
  estimatedCostUsd: number | null;
  durationMs: number;
}

export type SearchFailureResult =
  | { outcome: 'failed' | 'timeout' | 'already_terminal' }
  | { outcome: 'already_completed' };

export type SearchFinalizationResult =
  | { outcome: 'completed' | 'already_completed'; results: SearchResultSnapshot[]; resultsCount: number }
  | { outcome: 'inactive_location' | 'insufficient_credit'; results: []; resultsCount: 0 };

export type SearchBatchPersistenceResult =
  | { outcome: 'persisted'; occurrenceCount: number }
  | { outcome: 'inactive_location'; occurrenceCount: number };

interface LockedJobRow {
  status: string;
  keyword: string;
  apify_run_id: string;
  enrichment_status: string | null;
  brand_archived_at: string | null;
  location_archived_at: string | null;
}

interface AffiliateInsertRow {
  user_id: number;
  search_keyword: string;
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  is_affiliate: boolean;
  person_name: string | null;
  summary: string;
  email: string | null;
  thumbnail: string | null;
  views: string | null;
  date: string | null;
  rank: number | null;
  keyword: string | null;
  highlighted_words: string[] | null;
  discovery_method_type: string;
  discovery_method_value: string;
  is_already_affiliate: boolean | null;
  is_new: boolean;
  channel_name: string | null;
  channel_link: string | null;
  channel_thumbnail: string | null;
  channel_verified: boolean | null;
  channel_subscribers: string | null;
  duration: string | null;
  instagram_username: string | null;
  instagram_full_name: string | null;
  instagram_bio: string | null;
  instagram_followers: number | null;
  instagram_following: number | null;
  instagram_posts_count: number | null;
  instagram_is_business: boolean | null;
  instagram_is_verified: boolean | null;
  instagram_post_likes: number | null;
  instagram_post_comments: number | null;
  instagram_post_views: number | null;
  tiktok_username: string | null;
  tiktok_display_name: string | null;
  tiktok_bio: string | null;
  tiktok_followers: number | null;
  tiktok_following: number | null;
  tiktok_likes: number | null;
  tiktok_videos_count: number | null;
  tiktok_is_verified: boolean | null;
  tiktok_video_plays: number | null;
  tiktok_video_likes: number | null;
  tiktok_video_comments: number | null;
  tiktok_video_shares: number | null;
  youtube_video_likes: number | null;
  youtube_video_comments: number | null;
  similarweb_monthly_visits: number | null;
  similarweb_global_rank: number | null;
  similarweb_country_rank: number | null;
  similarweb_country_code: string | null;
  similarweb_bounce_rate: number | null;
  similarweb_pages_per_visit: number | null;
  similarweb_time_on_site: number | null;
  similarweb_category: string | null;
  similarweb_traffic_sources: string | null;
  similarweb_top_countries: string | null;
  brand_id: string;
  brand_location_id: string;
}

const DISCOVERED_COLUMNS = [
  'user_id',
  'search_keyword',
  'title',
  'link',
  'domain',
  'snippet',
  'source',
  'is_affiliate',
  'person_name',
  'summary',
  'email',
  'thumbnail',
  'views',
  'date',
  'rank',
  'keyword',
  'highlighted_words',
  'discovery_method_type',
  'discovery_method_value',
  'is_already_affiliate',
  'is_new',
  'channel_name',
  'channel_link',
  'channel_thumbnail',
  'channel_verified',
  'channel_subscribers',
  'duration',
  'instagram_username',
  'instagram_full_name',
  'instagram_bio',
  'instagram_followers',
  'instagram_following',
  'instagram_posts_count',
  'instagram_is_business',
  'instagram_is_verified',
  'instagram_post_likes',
  'instagram_post_comments',
  'instagram_post_views',
  'tiktok_username',
  'tiktok_display_name',
  'tiktok_bio',
  'tiktok_followers',
  'tiktok_following',
  'tiktok_likes',
  'tiktok_videos_count',
  'tiktok_is_verified',
  'tiktok_video_plays',
  'tiktok_video_likes',
  'tiktok_video_comments',
  'tiktok_video_shares',
  'youtube_video_likes',
  'youtube_video_comments',
  'similarweb_monthly_visits',
  'similarweb_global_rank',
  'similarweb_country_rank',
  'similarweb_country_code',
  'similarweb_bounce_rate',
  'similarweb_pages_per_visit',
  'similarweb_time_on_site',
  'similarweb_category',
  'similarweb_traffic_sources',
  'similarweb_top_countries',
  'brand_id',
  'brand_location_id',
] as const satisfies readonly (keyof AffiliateInsertRow)[];

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function optionalJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function discoveryFor(result: SearchResultSnapshot): DiscoveryMethod {
  const discovery = result.discoveryMethod;
  if (
    discovery
    && typeof discovery.value === 'string'
    && discovery.value.trim() !== ''
  ) {
    return discovery;
  }
  throw new SearchStatusIntegrityError('A persisted search result has no discovery method.');
}

function affiliateRow(
  context: Pick<SearchJobRuntimeContext, 'accountId' | 'brandId' | 'brandLocationId' | 'keyword' | 'settings'>,
  result: SearchResultSnapshot,
): AffiliateInsertRow {
  const record = result as unknown as Record<string, unknown>;
  const channel = result.channel;
  const discovery = discoveryFor(result);

  return {
    user_id: context.accountId,
    search_keyword: discovery.value,
    title: result.title,
    link: result.link,
    domain: result.domain,
    snippet: result.snippet || 'No description available',
    source: result.source,
    is_affiliate: true,
    person_name: optionalString(result.personName),
    summary: context.settings.isOnboarding
      ? 'Found via onboarding search'
      : 'Found via search',
    email: optionalString(result.email),
    thumbnail: optionalString(result.thumbnail),
    views: optionalString(result.views),
    date: optionalString(result.date),
    rank: optionalNumber(result.position),
    keyword: context.keyword,
    highlighted_words: Array.isArray(result.highlightedWords)
      ? result.highlightedWords
      : null,
    discovery_method_type: discovery.type,
    discovery_method_value: discovery.value,
    is_already_affiliate: optionalBoolean(record.isAlreadyAffiliate),
    is_new: true,
    channel_name: optionalString(channel?.name),
    channel_link: optionalString(channel?.link),
    channel_thumbnail: optionalString(channel?.thumbnail),
    channel_verified: optionalBoolean(channel?.verified),
    channel_subscribers: optionalString(channel?.subscribers),
    duration: optionalString(result.duration),
    instagram_username: optionalString(result.instagramUsername),
    instagram_full_name: optionalString(result.instagramFullName),
    instagram_bio: optionalString(result.instagramBio),
    instagram_followers: optionalNumber(result.instagramFollowers),
    instagram_following: optionalNumber(result.instagramFollowing),
    instagram_posts_count: optionalNumber(result.instagramPostsCount),
    instagram_is_business: optionalBoolean(result.instagramIsBusiness),
    instagram_is_verified: optionalBoolean(result.instagramIsVerified),
    instagram_post_likes: optionalNumber(result.instagramPostLikes),
    instagram_post_comments: optionalNumber(result.instagramPostComments),
    instagram_post_views: optionalNumber(result.instagramPostViews),
    tiktok_username: optionalString(result.tiktokUsername),
    tiktok_display_name: optionalString(result.tiktokDisplayName),
    tiktok_bio: optionalString(result.tiktokBio),
    tiktok_followers: optionalNumber(result.tiktokFollowers),
    tiktok_following: optionalNumber(result.tiktokFollowing),
    tiktok_likes: optionalNumber(result.tiktokLikes),
    tiktok_videos_count: optionalNumber(result.tiktokVideosCount),
    tiktok_is_verified: optionalBoolean(result.tiktokIsVerified),
    tiktok_video_plays: optionalNumber(result.tiktokVideoPlays),
    tiktok_video_likes: optionalNumber(result.tiktokVideoLikes),
    tiktok_video_comments: optionalNumber(result.tiktokVideoComments),
    tiktok_video_shares: optionalNumber(result.tiktokVideoShares),
    youtube_video_likes: optionalNumber(result.youtubeVideoLikes),
    youtube_video_comments: optionalNumber(result.youtubeVideoComments),
    similarweb_monthly_visits: optionalNumber(record.similarwebMonthlyVisits),
    similarweb_global_rank: optionalNumber(record.similarwebGlobalRank),
    similarweb_country_rank: optionalNumber(record.similarwebCountryRank),
    similarweb_country_code: optionalString(record.similarwebCountryCode),
    similarweb_bounce_rate: optionalNumber(record.similarwebBounceRate),
    similarweb_pages_per_visit: optionalNumber(record.similarwebPagesPerVisit),
    similarweb_time_on_site: optionalNumber(record.similarwebTimeOnSite),
    similarweb_category: optionalString(record.similarwebCategory),
    similarweb_traffic_sources: optionalJson(record.similarwebTrafficSources),
    similarweb_top_countries: optionalJson(record.similarwebTopCountries),
    brand_id: context.brandId,
    brand_location_id: context.brandLocationId,
  };
}

async function lockJobContext(
  transaction: SqlClient,
  input: Pick<SearchJobRuntimeContext, 'accountId' | 'id' | 'brandId' | 'brandLocationId'>,
): Promise<LockedJobRow | null> {
  const rows = await transaction<LockedJobRow[]>`
    SELECT
      jobs.status,
      jobs.keyword,
      jobs.apify_run_id,
      jobs.enrichment_status,
      brands.archived_at AS brand_archived_at,
      locations.archived_at AS location_archived_at
    FROM crewcast.search_jobs AS jobs
    JOIN crewcast.brands AS brands
      ON brands.id = jobs.brand_id
     AND brands.user_id = jobs.user_id
    JOIN crewcast.brand_locations AS locations
      ON locations.id = jobs.brand_location_id
     AND locations.brand_id = jobs.brand_id
     AND locations.user_id = jobs.user_id
    WHERE jobs.id = ${input.id}
      AND jobs.user_id = ${input.accountId}
      AND jobs.brand_id = ${input.brandId}::bigint
      AND jobs.brand_location_id = ${input.brandLocationId}::bigint
    FOR UPDATE OF brands, locations, jobs
  `;
  if (rows.length > 1) {
    throw new SearchStatusIntegrityError('A search job resolved to multiple owned contexts.');
  }
  return rows[0] ?? null;
}

async function markInactiveJobFailed(
  transaction: SqlClient,
  accountId: number,
  jobId: number,
): Promise<void> {
  await transaction`
    UPDATE crewcast.search_jobs
    SET
      status = 'failed',
      enrichment_status = CASE
        WHEN enrichment_status IS NULL THEN NULL
        ELSE 'failed'
      END,
      completed_at = NOW(),
      error_message = 'Brand location archived while search was running'
    WHERE id = ${jobId}
      AND user_id = ${accountId}
      AND status NOT IN ('done', 'failed', 'timeout')
  `;
}

async function loadResultSnapshots(
  executor: SqlClient,
  accountId: number,
  jobId: number,
): Promise<SearchResultSnapshot[]> {
  const rows = await executor<{ result_snapshot: unknown }[]>`
    SELECT results.result_snapshot
    FROM crewcast.search_job_results AS results
    WHERE results.user_id = ${accountId}
      AND results.search_job_id = ${jobId}
      AND results.result_snapshot IS NOT NULL
    ORDER BY results.id
  `;
  return rows.map(({ result_snapshot }) => {
    const parsed = typeof result_snapshot === 'string'
      ? JSON.parse(result_snapshot) as unknown
      : result_snapshot;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new SearchStatusIntegrityError('A completed result snapshot is invalid.');
    }
    return parsed as SearchResultSnapshot;
  });
}

async function persistResults(
  transaction: SqlClient,
  context: SearchJobRuntimeContext,
  results: readonly SearchResultSnapshot[],
): Promise<number> {
  const normalized = dedupeSearchResults(results).map(normalizeResultSnapshot);
  if (normalized.length === 0) {
    const counts = await transaction<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.search_job_results
      WHERE user_id = ${context.accountId}
        AND search_job_id = ${context.id}
    `;
    return counts[0]?.count ?? 0;
  }

  const affiliateRows = normalized.map((result) => affiliateRow(context, result));
  const inserted = await transaction<{ id: number; link: string }[]>`
    INSERT INTO crewcast.discovered_affiliates
      ${transaction(affiliateRows, ...DISCOVERED_COLUMNS)}
    ON CONFLICT (brand_location_id, link) DO NOTHING
    RETURNING id, link
  `;
  const insertedLinks = new Set(inserted.map(({ link }) => link));
  const links = normalized.map(({ link }) => link);
  const canonical = await transaction<{ id: number; link: string }[]>`
    SELECT id, link
    FROM crewcast.discovered_affiliates
    WHERE user_id = ${context.accountId}
      AND brand_id = ${context.brandId}::bigint
      AND brand_location_id = ${context.brandLocationId}::bigint
      AND link = ANY(${transaction.array(links)}::text[])
  `;
  const canonicalByLink = new Map(canonical.map((row) => [row.link, row.id]));
  if (canonicalByLink.size !== normalized.length) {
    throw new SearchStatusIntegrityError('A canonical affiliate was not available for every result.');
  }

  const occurrenceRows = normalized.map((result) => ({
    user_id: context.accountId,
    search_job_id: context.id,
    brand_id: context.brandId,
    brand_location_id: context.brandLocationId,
    discovered_affiliate_id: canonicalByLink.get(result.link) ?? null,
    result_link: result.link,
    affiliate_was_new: insertedLinks.has(result.link),
    result_snapshot: transaction.json(
      result as unknown as postgres.JSONValue,
    ),
  }));
  await transaction`
    INSERT INTO crewcast.search_job_results
      ${transaction(
        occurrenceRows,
        'user_id',
        'search_job_id',
        'brand_id',
        'brand_location_id',
        'discovered_affiliate_id',
        'result_link',
        'affiliate_was_new',
        'result_snapshot',
      )}
    ON CONFLICT (search_job_id, result_link) DO NOTHING
  `;

  const counts = await transaction<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.search_job_results
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.id}
  `;
  return counts[0]?.count ?? 0;
}

async function consumeTopicSearchCredit(
  transaction: SqlClient,
  context: SearchJobRuntimeContext,
): Promise<boolean> {
  const existing = await transaction<{ id: number }[]>`
    SELECT id
    FROM crewcast.credit_transactions
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.id}
      AND credit_type = 'topic_search'
      AND reason = 'usage'
    LIMIT 1
  `;
  if (existing.length === 1) return true;

  const creditRows = await transaction<{
    total: number;
    used: number;
    topup: number;
  }[]>`
    SELECT
      topic_search_credits_total AS total,
      topic_search_credits_used AS used,
      topic_search_credits_topup AS topup
    FROM crewcast.user_credits
    WHERE user_id = ${context.accountId}
    LIMIT 2
    FOR UPDATE
  `;
  if (creditRows.length !== 1) return false;

  const reservations = await transaction<{
    id: number;
    status: string;
  }[]>`
    SELECT id, status
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.id}
    LIMIT 2
    FOR UPDATE
  `;
  if (reservations.length > 1) {
    throw new SearchStatusIntegrityError(
      'A search job matched more than one credit reservation.',
    );
  }
  if (reservations.length === 1) {
    const reservation = reservations[0];
    if (reservation.status === 'consumed') return true;
    if (reservation.status !== 'reserved') return false;

    const balance = creditRows[0].total === -1
      ? -1
      : Math.max(0, creditRows[0].total - creditRows[0].used)
        + (creditRows[0].topup ?? 0);
    await transaction`
      INSERT INTO crewcast.credit_transactions (
        user_id,
        credit_type,
        amount,
        balance_after,
        reason,
        reference_id,
        reference_type,
        brand_id,
        brand_location_id,
        search_job_id
      )
      VALUES (
        ${context.accountId},
        'topic_search',
        -1,
        ${balance},
        'usage',
        ${String(context.id)},
        'search_job',
        ${context.brandId}::bigint,
        ${context.brandLocationId}::bigint,
        ${context.id}
      )
      ON CONFLICT (search_job_id)
        WHERE search_job_id IS NOT NULL
          AND credit_type = 'topic_search'
          AND reason = 'usage'
      DO NOTHING
    `;
    const consumed = await transaction<{ id: number }[]>`
      UPDATE crewcast.search_credit_reservations
      SET
        status = 'consumed',
        consumed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${reservation.id}
        AND user_id = ${context.accountId}
        AND search_job_id = ${context.id}
        AND status = 'reserved'
      RETURNING id
    `;
    if (consumed.length !== 1) {
      throw new SearchStatusIntegrityError(
        'The topic-search credit reservation was not consumed exactly once.',
      );
    }
    return true;
  }

  const updated = await transaction<{ total: number; used: number; topup: number }[]>`
    UPDATE crewcast.user_credits
    SET
      topic_search_credits_used = topic_search_credits_used + (CASE
        WHEN topic_search_credits_total = -1 THEN 1
        ELSE LEAST(1, GREATEST(0, topic_search_credits_total - topic_search_credits_used))
      END),
      topic_search_credits_topup = (CASE
        WHEN topic_search_credits_total = -1 THEN COALESCE(topic_search_credits_topup, 0)
        ELSE COALESCE(topic_search_credits_topup, 0)
          - (1 - LEAST(1, GREATEST(0, topic_search_credits_total - topic_search_credits_used)))
      END),
      updated_at = NOW()
    WHERE user_id = ${context.accountId}
      AND (
        topic_search_credits_total = -1
        OR GREATEST(0, topic_search_credits_total - topic_search_credits_used)
          + COALESCE(topic_search_credits_topup, 0) >= 1
      )
    RETURNING
      topic_search_credits_total AS total,
      topic_search_credits_used AS used,
      topic_search_credits_topup AS topup
  `;
  if (updated.length === 0) return false;

  const balance = updated[0].total === -1
    ? -1
    : Math.max(0, updated[0].total - updated[0].used) + (updated[0].topup ?? 0);
  await transaction`
    INSERT INTO crewcast.credit_transactions (
      user_id,
      credit_type,
      amount,
      balance_after,
      reason,
      reference_id,
      reference_type,
      brand_id,
      brand_location_id,
      search_job_id
    )
    VALUES (
      ${context.accountId},
      'topic_search',
      -1,
      ${balance},
      'usage',
      ${String(context.id)},
      'search_job',
      ${context.brandId}::bigint,
      ${context.brandLocationId}::bigint,
      ${context.id}
    )
    ON CONFLICT (search_job_id)
      WHERE search_job_id IS NOT NULL
        AND credit_type = 'topic_search'
        AND reason = 'usage'
    DO NOTHING
  `;
  return true;
}

export async function releaseTopicSearchCreditReservation(
  transaction: SqlClient,
  context: Pick<SearchJobRuntimeContext, 'accountId' | 'id'>,
): Promise<'released' | 'credit_record_missing' | 'reservation_missing' | 'already_finalized'> {
  const creditRows = await transaction<{ id: number }[]>`
    SELECT id
    FROM crewcast.user_credits
    WHERE user_id = ${context.accountId}
    LIMIT 2
    FOR UPDATE
  `;
  if (creditRows.length !== 1) return 'credit_record_missing';

  const reservations = await transaction<{
    id: number;
    status: string;
    subscription_credits_consumed: number;
    topup_credits_consumed: number;
  }[]>`
    SELECT
      id,
      status,
      subscription_credits_consumed,
      topup_credits_consumed
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.id}
    LIMIT 2
    FOR UPDATE
  `;
  if (reservations.length === 0) return 'reservation_missing';
  if (reservations.length !== 1) {
    throw new SearchStatusIntegrityError(
      'A search job matched more than one credit reservation.',
    );
  }
  const reservation = reservations[0];
  if (reservation.status !== 'reserved') return 'already_finalized';

  const restored = await transaction<{ id: number }[]>`
    UPDATE crewcast.user_credits
    SET
      topic_search_credits_used = CASE
        WHEN period_start = (
          SELECT credit_period_start
          FROM crewcast.search_credit_reservations
          WHERE id = ${reservation.id}
        )
          THEN GREATEST(
            0,
            topic_search_credits_used - ${reservation.subscription_credits_consumed}
          )
        ELSE topic_search_credits_used
      END,
      topic_search_credits_topup = topic_search_credits_topup
        + ${reservation.topup_credits_consumed},
      updated_at = NOW()
    WHERE user_id = ${context.accountId}
    RETURNING id
  `;
  if (restored.length !== 1) {
    throw new SearchStatusIntegrityError(
      'The reserved topic-search credit could not be restored.',
    );
  }

  const released = await transaction<{ id: number }[]>`
    UPDATE crewcast.search_credit_reservations
    SET
      status = 'released',
      released_at = NOW(),
      updated_at = NOW()
    WHERE id = ${reservation.id}
      AND user_id = ${context.accountId}
      AND search_job_id = ${context.id}
      AND status = 'reserved'
    RETURNING id
  `;
  if (released.length !== 1) {
    throw new SearchStatusIntegrityError(
      'The topic-search credit reservation was not released exactly once.',
    );
  }
  return 'released';
}

async function insertStatusAudit(
  transaction: SqlClient,
  context: SearchJobRuntimeContext,
  input: SearchStatusAuditInput,
  resultsCount: number,
): Promise<void> {
  const estimatedCost = input.estimatedCostUsd
    ?? (resultsCount > 0
      ? resultsCount * API_COSTS.apify_google_scraper
      : API_COSTS.apify_google_scraper);
  await transaction`
    INSERT INTO crewcast.api_calls (
      user_id,
      service,
      endpoint,
      keyword,
      status,
      results_count,
      estimated_cost,
      apify_run_id,
      duration_ms,
      brand_id,
      brand_location_id,
      search_job_id
    )
    VALUES (
      ${context.accountId},
      'apify_google_scraper',
      'status',
      ${context.keyword},
      ${input.auditStatus},
      ${resultsCount},
      ${estimatedCost},
      ${context.apifyRunId},
      ${input.durationMs},
      ${context.brandId}::bigint,
      ${context.brandLocationId}::bigint,
      ${context.id}
    )
    ON CONFLICT (search_job_id)
      WHERE search_job_id IS NOT NULL
        AND service = 'apify_google_scraper'
        AND endpoint = 'status'
    DO NOTHING
  `;
}

export async function loadOwnedSearchJob(
  accountId: number,
  jobId: number,
): Promise<SearchJobRuntimeContext | null> {
  const rows = await (sql as SqlClient)<SearchStatusJobRow[]>`
    SELECT
      jobs.id,
      jobs.user_id,
      jobs.keyword,
      jobs.sources,
      jobs.apify_run_id,
      jobs.status,
      jobs.created_at,
      jobs.user_settings,
      jobs.results_count,
      jobs.enrichment_status,
      jobs.enrichment_run_ids,
      jobs.raw_results,
      jobs.brand_id::text AS brand_id,
      jobs.brand_location_id::text AS brand_location_id,
      jobs.settings_snapshot,
      brands.archived_at AS brand_archived_at,
      locations.archived_at AS location_archived_at
    FROM crewcast.search_jobs AS jobs
    JOIN crewcast.brands AS brands
      ON brands.id = jobs.brand_id
     AND brands.user_id = jobs.user_id
    JOIN crewcast.brand_locations AS locations
      ON locations.id = jobs.brand_location_id
     AND locations.brand_id = jobs.brand_id
     AND locations.user_id = jobs.user_id
    WHERE jobs.id = ${jobId}
      AND jobs.user_id = ${accountId}
    LIMIT 2
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new SearchStatusIntegrityError('A search job matched more than one owned context.');
  }
  return parseSearchJobRuntimeContext(rows[0]);
}

export async function loadCompletedSearchResults(
  accountId: number,
  jobId: number,
): Promise<SearchResultSnapshot[]> {
  return loadResultSnapshots(sql as SqlClient, accountId, jobId);
}

async function assertConsumedOnboardingEntitlement(
  transaction: SqlClient,
  context: SearchJobRuntimeContext,
): Promise<void> {
  const rows = await transaction<{ user_id: number }[]>`
    SELECT user_id
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.id}
      AND brand_id = ${context.brandId}::bigint
      AND brand_location_id = ${context.brandLocationId}::bigint
      AND provider_run_id = ${context.apifyRunId}
      AND status = 'consumed'
      AND legacy_imported_at IS NULL
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw new SearchStatusIntegrityError(
      'The onboarding search has no matching consumed entitlement.',
    );
  }
}

export async function persistSearchResultBatch(
  context: SearchJobRuntimeContext,
  results: readonly SearchResultSnapshot[],
): Promise<SearchBatchPersistenceResult> {
  return (sql as SqlClient).begin(async (transactionValue) => {
    // postgres.js's TransactionSql declaration omits the Sql call signatures
    // even though the runtime transaction is the same callable query helper.
    const transaction = transactionValue as unknown as SqlClient;
    const locked = await lockJobContext(transaction, context);
    if (!locked) {
      throw new SearchStatusIntegrityError('The search job ownership context changed.');
    }
    if (context.settings.isOnboarding) {
      await assertConsumedOnboardingEntitlement(transaction, context);
    }
    if (locked.brand_archived_at !== null || locked.location_archived_at !== null) {
      const counts = await transaction<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM crewcast.search_job_results
        WHERE user_id = ${context.accountId}
          AND search_job_id = ${context.id}
      `;
      return { outcome: 'inactive_location', occurrenceCount: counts[0]?.count ?? 0 };
    }

    return {
      outcome: 'persisted',
      occurrenceCount: await persistResults(transaction, context, results),
    };
  });
}

export async function finalizeSearchJob(
  context: SearchJobRuntimeContext,
  input: SearchFinalizationInput,
): Promise<SearchFinalizationResult> {
  const normalized = dedupeSearchResults(input.results).map(normalizeResultSnapshot);
  return (sql as SqlClient).begin(async (transactionValue) => {
    const transaction = transactionValue as unknown as SqlClient;
    const locked = await lockJobContext(transaction, context);
    if (!locked) {
      throw new SearchStatusIntegrityError('The search job ownership context changed.');
    }

    if (locked.status === 'done') {
      const completed = await loadResultSnapshots(transaction, context.accountId, context.id);
      return {
        outcome: 'already_completed',
        results: completed,
        resultsCount: completed.length,
      };
    }
    if (locked.status === 'failed' || locked.status === 'timeout') {
      throw new SearchStatusIntegrityError('A terminal failed job cannot be finalized.');
    }
    if (context.settings.isOnboarding) {
      await assertConsumedOnboardingEntitlement(transaction, context);
    }
    if (locked.brand_archived_at !== null || locked.location_archived_at !== null) {
      if (!context.settings.isOnboarding) {
        await releaseTopicSearchCreditReservation(transaction, context);
      }
      await insertStatusAudit(transaction, context, {
        estimatedCostUsd: input.estimatedCostUsd,
        durationMs: input.durationMs,
        auditStatus: 'error',
      }, 0);
      await markInactiveJobFailed(transaction, context.accountId, context.id);
      return { outcome: 'inactive_location', results: [], resultsCount: 0 };
    }

    if (!context.settings.isOnboarding) {
      // A topic-search credit buys one completed provider search, not a minimum
      // number of accepted results. Empty output is still a completed paid run.
      const charged = await consumeTopicSearchCredit(transaction, context);
      if (!charged) {
        await insertStatusAudit(transaction, context, {
          estimatedCostUsd: input.estimatedCostUsd,
          durationMs: input.durationMs,
          auditStatus: 'error',
        }, 0);
        await transaction`
          UPDATE crewcast.search_jobs
          SET
            status = 'failed',
            enrichment_status = CASE
              WHEN enrichment_status IS NULL THEN NULL
              ELSE 'failed'
            END,
            completed_at = NOW(),
            error_message = 'Insufficient topic-search credit at completion'
          WHERE id = ${context.id}
            AND user_id = ${context.accountId}
        `;
        return { outcome: 'insufficient_credit', results: [], resultsCount: 0 };
      }
    }

    const occurrenceCount = await persistResults(transaction, context, normalized);
    await insertStatusAudit(transaction, context, {
      estimatedCostUsd: input.estimatedCostUsd,
      durationMs: input.durationMs,
      auditStatus: 'success',
    }, occurrenceCount);
    await transaction`
      UPDATE crewcast.search_jobs
      SET
        status = 'done',
        enrichment_status = CASE
          WHEN ${input.enrichmentSucceeded} THEN 'succeeded'
          ELSE enrichment_status
        END,
        completed_at = NOW(),
        results_count = ${occurrenceCount},
        estimated_cost = ${input.estimatedCostUsd}
      WHERE id = ${context.id}
        AND user_id = ${context.accountId}
    `;

    const completedResults = await loadResultSnapshots(
      transaction,
      context.accountId,
      context.id,
    );

    return {
      outcome: 'completed',
      results: completedResults,
      resultsCount: occurrenceCount,
    };
  });
}

export async function failSearchJob(
  context: SearchJobRuntimeContext,
  input: SearchFailureInput,
): Promise<SearchFailureResult> {
  const boundedMessage = input.errorMessage.trim().slice(0, 2_000)
    || 'Search failed';

  return (sql as SqlClient).begin(async (transactionValue) => {
    const transaction = transactionValue as unknown as SqlClient;
    const locked = await lockJobContext(transaction, context);
    if (!locked) {
      throw new SearchStatusIntegrityError('The search job ownership context changed.');
    }
    if (locked.status === 'done') return { outcome: 'already_completed' };

    if (
      context.settings.isOnboarding
      && locked.status !== 'failed'
      && locked.status !== 'timeout'
    ) {
      await assertConsumedOnboardingEntitlement(transaction, context);
    }

    if (!context.settings.isOnboarding) {
      await releaseTopicSearchCreditReservation(transaction, context);
    }

    await insertStatusAudit(transaction, context, {
      estimatedCostUsd: input.estimatedCostUsd,
      durationMs: input.durationMs,
      auditStatus: input.terminalStatus === 'timeout' ? 'timeout' : 'error',
    }, 0);

    if (locked.status === 'failed' || locked.status === 'timeout') {
      return { outcome: 'already_terminal' };
    }

    await transaction`
      UPDATE crewcast.search_jobs
      SET
        status = ${input.terminalStatus},
        enrichment_status = CASE
          WHEN enrichment_status IS NULL THEN NULL
          ELSE 'failed'
        END,
        completed_at = NOW(),
        error_message = ${boundedMessage},
        estimated_cost = ${input.estimatedCostUsd}
      WHERE id = ${context.id}
        AND user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;

    return { outcome: input.terminalStatus };
  });
}
