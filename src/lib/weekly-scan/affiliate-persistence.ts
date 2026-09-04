import 'server-only';

import type { SearchResult } from '@/app/services/search';
import { rehostImageIfNeeded } from '@/lib/image-storage';
import type { SearchStartSqlExecutor } from '@/lib/search/start-postgres';

const IMAGE_PREPARE_CONCURRENCY = 20;
const BULK_INSERT_SIZE = 200;

type WeeklyAffiliateResult = SearchResult & {
  rank?: number;
  keyword?: string;
  discoveryMethod?: { type: string; value: string };
};

interface InsertRow {
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  thumbnail: string | null;
  views: string | null;
  date: string | null;
  rank: number | null;
  keyword: string | null;
  discovery_method_type: string;
  discovery_method_value: string;
  channel_name: string | null;
  channel_link: string | null;
  channel_thumbnail: string | null;
  channel_verified: boolean | null;
  channel_subscribers: string | null;
  duration: string | null;
  youtube_video_likes: number | null;
  youtube_video_comments: number | null;
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
}

type ImageRehoster = (url?: string | null) => Promise<string | undefined>;
type JsonSqlExecutor = SearchStartSqlExecutor & {
  json: (value: unknown) => unknown;
};

async function prepareInsertRow(
  result: WeeklyAffiliateResult,
  rehostImage: ImageRehoster,
): Promise<InsertRow> {
  const [permThumbnail, permChannelThumbnail] = await Promise.all([
    rehostImage(result.thumbnail),
    rehostImage(result.channel?.thumbnail),
  ]);
  return {
    title: result.title,
    link: result.link,
    domain: result.domain,
    snippet: result.snippet || '',
    source: result.source,
    thumbnail: permThumbnail || null,
    views: result.views || null,
    date: result.date || null,
    rank: result.rank || null,
    keyword: result.keyword || null,
    discovery_method_type: result.discoveryMethod?.type || 'auto_scan',
    discovery_method_value: result.discoveryMethod?.value || 'auto',
    channel_name: result.channel?.name || null,
    channel_link: result.channel?.link || null,
    channel_thumbnail: permChannelThumbnail || null,
    channel_verified: result.channel?.verified || null,
    channel_subscribers: result.channel?.subscribers || null,
    duration: result.duration || null,
    youtube_video_likes: result.youtubeVideoLikes || null,
    youtube_video_comments: result.youtubeVideoComments || null,
    instagram_username: result.instagramUsername || null,
    instagram_full_name: result.instagramFullName || null,
    instagram_bio: result.instagramBio || null,
    instagram_followers: result.instagramFollowers || null,
    instagram_following: result.instagramFollowing || null,
    instagram_posts_count: result.instagramPostsCount || null,
    instagram_is_business: result.instagramIsBusiness || null,
    instagram_is_verified: result.instagramIsVerified || null,
    instagram_post_likes: result.instagramPostLikes || null,
    instagram_post_comments: result.instagramPostComments || null,
    instagram_post_views: result.instagramPostViews || null,
    tiktok_username: result.tiktokUsername || null,
    tiktok_display_name: result.tiktokDisplayName || null,
    tiktok_bio: result.tiktokBio || null,
    tiktok_followers: result.tiktokFollowers || null,
    tiktok_following: result.tiktokFollowing || null,
    tiktok_likes: result.tiktokLikes || null,
    tiktok_videos_count: result.tiktokVideosCount || null,
    tiktok_is_verified: result.tiktokIsVerified || null,
    tiktok_video_plays: result.tiktokVideoPlays || null,
    tiktok_video_likes: result.tiktokVideoLikes || null,
    tiktok_video_comments: result.tiktokVideoComments || null,
    tiktok_video_shares: result.tiktokVideoShares || null,
  };
}

/**
 * Persists a weekly location's newly discovered affiliates with bounded work.
 *
 * A real 141-result child spent roughly 85 seconds making one duplicate query
 * and one insert per result through a one-connection serverless client. This
 * path makes one duplicate query, rehosts only genuinely new images in bounded
 * chunks, and uses bulk inserts. The database uniqueness constraint remains the
 * final authority if another writer inserts the same link during preparation.
 */
export async function saveWeeklyDiscoveredAffiliates(
  executor: JsonSqlExecutor,
  input: {
    userId: number;
    brandId: string;
    brandLocationId: string;
    searchKeyword: string;
    results: WeeklyAffiliateResult[];
  },
  rehostImage: ImageRehoster = rehostImageIfNeeded,
): Promise<string[]> {
  const uniqueByLink = new Map<string, WeeklyAffiliateResult>();
  for (const result of input.results) {
    if (!uniqueByLink.has(result.link)) uniqueByLink.set(result.link, result);
  }
  const uniqueResults = [...uniqueByLink.values()];
  if (uniqueResults.length === 0) return [];

  const existing = await executor<{ link: string }>`
    SELECT link FROM crewcast.discovered_affiliates
    WHERE user_id = ${input.userId}
      AND brand_id = ${input.brandId}::bigint
      AND brand_location_id = ${input.brandLocationId}::bigint
      AND link = ANY(${uniqueResults.map(({ link }) => link)}::text[])
  `;
  const existingLinks = new Set(existing.map(({ link }) => link));
  const newResults = uniqueResults.filter(({ link }) => !existingLinks.has(link));
  const prepared: InsertRow[] = [];
  for (let index = 0; index < newResults.length; index += IMAGE_PREPARE_CONCURRENCY) {
    prepared.push(...await Promise.all(
      newResults
        .slice(index, index + IMAGE_PREPARE_CONCURRENCY)
        .map((result) => prepareInsertRow(result, rehostImage)),
    ));
  }

  const insertedSources: string[] = [];
  for (let index = 0; index < prepared.length; index += BULK_INSERT_SIZE) {
    const payload = executor.json(prepared.slice(index, index + BULK_INSERT_SIZE));
    const inserted = await executor<{ source: string }>`
      INSERT INTO crewcast.discovered_affiliates (
        user_id, brand_id, brand_location_id,
        search_keyword, title, link, domain, snippet, source,
        thumbnail, views, date, rank, keyword,
        discovery_method_type, discovery_method_value,
        is_new, channel_name, channel_link, channel_thumbnail,
        channel_verified, channel_subscribers, duration,
        youtube_video_likes, youtube_video_comments,
        instagram_username, instagram_full_name, instagram_bio,
        instagram_followers, instagram_following, instagram_posts_count,
        instagram_is_business, instagram_is_verified,
        instagram_post_likes, instagram_post_comments, instagram_post_views,
        tiktok_username, tiktok_display_name, tiktok_bio,
        tiktok_followers, tiktok_following, tiktok_likes,
        tiktok_videos_count, tiktok_is_verified,
        tiktok_video_plays, tiktok_video_likes, tiktok_video_comments, tiktok_video_shares
      )
      SELECT
        ${input.userId}, ${input.brandId}::bigint, ${input.brandLocationId}::bigint,
        ${input.searchKeyword}, incoming.title, incoming.link, incoming.domain,
        incoming.snippet, incoming.source,
        incoming.thumbnail, incoming.views, incoming.date, incoming.rank, incoming.keyword,
        incoming.discovery_method_type, incoming.discovery_method_value,
        true, incoming.channel_name, incoming.channel_link, incoming.channel_thumbnail,
        incoming.channel_verified, incoming.channel_subscribers, incoming.duration,
        incoming.youtube_video_likes, incoming.youtube_video_comments,
        incoming.instagram_username, incoming.instagram_full_name, incoming.instagram_bio,
        incoming.instagram_followers, incoming.instagram_following, incoming.instagram_posts_count,
        incoming.instagram_is_business, incoming.instagram_is_verified,
        incoming.instagram_post_likes, incoming.instagram_post_comments, incoming.instagram_post_views,
        incoming.tiktok_username, incoming.tiktok_display_name, incoming.tiktok_bio,
        incoming.tiktok_followers, incoming.tiktok_following, incoming.tiktok_likes,
        incoming.tiktok_videos_count, incoming.tiktok_is_verified,
        incoming.tiktok_video_plays, incoming.tiktok_video_likes,
        incoming.tiktok_video_comments, incoming.tiktok_video_shares
      FROM jsonb_to_recordset(${payload}::jsonb) AS incoming (
        title text, link text, domain text, snippet text, source text,
        thumbnail text, views text, date text, rank integer, keyword text,
        discovery_method_type text, discovery_method_value text,
        channel_name text, channel_link text, channel_thumbnail text,
        channel_verified boolean, channel_subscribers text, duration text,
        youtube_video_likes integer, youtube_video_comments integer,
        instagram_username text, instagram_full_name text, instagram_bio text,
        instagram_followers integer, instagram_following integer, instagram_posts_count integer,
        instagram_is_business boolean, instagram_is_verified boolean,
        instagram_post_likes integer, instagram_post_comments integer, instagram_post_views integer,
        tiktok_username text, tiktok_display_name text, tiktok_bio text,
        tiktok_followers integer, tiktok_following integer, tiktok_likes integer,
        tiktok_videos_count integer, tiktok_is_verified boolean,
        tiktok_video_plays integer, tiktok_video_likes integer,
        tiktok_video_comments integer, tiktok_video_shares integer
      )
      ON CONFLICT (brand_location_id, link) DO NOTHING
      RETURNING source
    `;
    insertedSources.push(...inserted.map(({ source }) => source));
  }
  return insertedSources;
}
