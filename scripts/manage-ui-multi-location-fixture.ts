import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const TARGET_EMAIL = 'paras@spectrumailabs.com';
const TARGET_BRAND_DOMAIN = 'selecdoo.com';
const FIXTURE_MARKER = 'codex-ui-multi-location-fixture';
const FIXTURE_SNIPPET_PREFIX = '[STAGING UI FIXTURE]';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  const candidates = new Set<string>();
  if (direct) candidates.add(direct[1]);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) candidates.add(pooler[1]);
  if (candidates.size !== 1) throw new Error('Could not prove one Supabase project reference.');
  return [...candidates][0];
}

assert.equal(
  extractProjectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to manage UI fixtures anywhere except Terminal-Backup.',
);

type SqlClient = postgres.Sql;

interface TargetLocationRow {
  accountId: number;
  accountEmail: string;
  brandId: string;
  brandName: string;
  brandDomain: string;
  locationId: string;
  countryCode: string;
  languageCode: string;
}

interface TargetPortfolio {
  accountId: number;
  brandId: string;
  brandName: string;
  locations: ReadonlyMap<string, TargetLocationRow>;
}

interface FixtureAffiliate {
  countryCode: 'de' | 'gb';
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: 'YouTube' | 'TikTok' | 'Instagram';
  personName: string;
  summary: string;
  views: string;
  rank: number;
  discoveryValue: string;
  channelName: string;
  channelLink: string;
  channelVerified: boolean;
  channelSubscribers: string;
  tiktokUsername?: string;
  tiktokFollowers?: number;
  tiktokLikes?: number;
  instagramUsername?: string;
  instagramFollowers?: number;
  saved: boolean;
}

// The shared link deliberately appears in both markets. It proves that one
// creator can remain two location-scoped records without cross-market actions.
const SHARED_LINK = 'https://ui-fixture-shared.example.invalid/creator-compass';

const FIXTURE_AFFILIATES: readonly FixtureAffiliate[] = [
  {
    countryCode: 'de',
    title: 'Creator Compass: Partnerprogramme für moderne Shops',
    link: SHARED_LINK,
    domain: 'ui-fixture-shared.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} German-market version of a creator also found in the UK.`,
    source: 'YouTube',
    personName: 'Creator Compass',
    summary: 'Demo creator used to verify the same affiliate across two locations.',
    views: '42.8K',
    rank: 1,
    discoveryValue: 'Creator partnerships Deutschland',
    channelName: 'Creator Compass',
    channelLink: SHARED_LINK,
    channelVerified: true,
    channelSubscribers: '126K',
    saved: true,
  },
  {
    countryCode: 'de',
    title: 'Drei Wege zu besseren Produktvideos',
    link: 'https://ui-fixture-de-tiktok.example.invalid/technik-mit-lara',
    domain: 'ui-fixture-de-tiktok.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} German TikTok creator for the combined-location table.`,
    source: 'TikTok',
    personName: 'Technik mit Lara',
    summary: 'German technology and ecommerce creator fixture.',
    views: '91.4K',
    rank: 2,
    discoveryValue: 'E-Commerce Creator Deutschland',
    channelName: 'Technik mit Lara',
    channelLink: 'https://ui-fixture-de-tiktok.example.invalid/technik-mit-lara',
    channelVerified: false,
    channelSubscribers: '84.2K',
    tiktokUsername: 'technik_mit_lara_ui_test',
    tiktokFollowers: 84_200,
    tiktokLikes: 1_100_000,
    saved: true,
  },
  {
    countryCode: 'de',
    title: 'Creator-Kampagnen aus Berlin',
    link: 'https://ui-fixture-de-instagram.example.invalid/creator-werkstatt',
    domain: 'ui-fixture-de-instagram.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} German Instagram creator for location filtering.`,
    source: 'Instagram',
    personName: 'Creator Werkstatt',
    summary: 'German lifestyle and retail creator fixture.',
    views: '28.6K',
    rank: 3,
    discoveryValue: 'Retail creators Berlin',
    channelName: 'Creator Werkstatt',
    channelLink: 'https://ui-fixture-de-instagram.example.invalid/creator-werkstatt',
    channelVerified: true,
    channelSubscribers: '42.5K',
    instagramUsername: 'creator_werkstatt_ui_test',
    instagramFollowers: 42_500,
    saved: false,
  },
  {
    countryCode: 'gb',
    title: 'Creator Compass: UK partnerships that convert',
    link: SHARED_LINK,
    domain: 'ui-fixture-shared.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} UK-market version of a creator also found in Germany.`,
    source: 'YouTube',
    personName: 'Creator Compass',
    summary: 'Demo creator used to verify the same affiliate across two locations.',
    views: '57.1K',
    rank: 1,
    discoveryValue: 'UK creator partnerships',
    channelName: 'Creator Compass',
    channelLink: SHARED_LINK,
    channelVerified: true,
    channelSubscribers: '126K',
    saved: true,
  },
  {
    countryCode: 'gb',
    title: 'Five hooks for stronger ecommerce videos',
    link: 'https://ui-fixture-gb-tiktok.example.invalid/growth-with-nia',
    domain: 'ui-fixture-gb-tiktok.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} UK TikTok creator for location filtering.`,
    source: 'TikTok',
    personName: 'Growth with Nia',
    summary: 'UK ecommerce and social growth creator fixture.',
    views: '113K',
    rank: 2,
    discoveryValue: 'UK ecommerce creators',
    channelName: 'Growth with Nia',
    channelLink: 'https://ui-fixture-gb-tiktok.example.invalid/growth-with-nia',
    channelVerified: true,
    channelSubscribers: '97.3K',
    tiktokUsername: 'growth_with_nia_ui_test',
    tiktokFollowers: 97_300,
    tiktokLikes: 1_840_000,
    saved: false,
  },
  {
    countryCode: 'gb',
    title: 'How UK retail brands brief creators',
    link: 'https://ui-fixture-gb-instagram.example.invalid/maker-scout',
    domain: 'ui-fixture-gb-instagram.example.invalid',
    snippet: `${FIXTURE_SNIPPET_PREFIX} UK Instagram creator for the combined-location table.`,
    source: 'Instagram',
    personName: 'Maker Scout UK',
    summary: 'UK retail and product discovery creator fixture.',
    views: '34.9K',
    rank: 3,
    discoveryValue: 'UK retail creators',
    channelName: 'Maker Scout UK',
    channelLink: 'https://ui-fixture-gb-instagram.example.invalid/maker-scout',
    channelVerified: false,
    channelSubscribers: '51.8K',
    instagramUsername: 'maker_scout_ui_test',
    instagramFollowers: 51_800,
    saved: true,
  },
];

const fixtureLinks = [...new Set(FIXTURE_AFFILIATES.map(({ link }) => link))];

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
});

async function resolveTarget(executor: SqlClient): Promise<TargetPortfolio> {
  const rows = await executor<TargetLocationRow[]>`
    SELECT
      users.id AS "accountId",
      users.email AS "accountEmail",
      brands.id::text AS "brandId",
      brands.name AS "brandName",
      brands.normalized_domain AS "brandDomain",
      locations.id::text AS "locationId",
      lower(locations.country_code) AS "countryCode",
      lower(locations.language_code) AS "languageCode"
    FROM crewcast.users AS users
    JOIN crewcast.brands AS brands
      ON brands.user_id = users.id
     AND brands.archived_at IS NULL
    JOIN crewcast.brand_locations AS locations
      ON locations.user_id = users.id
     AND locations.brand_id = brands.id
     AND locations.archived_at IS NULL
    WHERE lower(users.email) = lower(${TARGET_EMAIL})
      AND lower(brands.normalized_domain) = ${TARGET_BRAND_DOMAIN}
    ORDER BY locations.id
  `;

  assert.equal(rows.length, 2, 'Expected exactly two active Selecdoo staging locations.');
  assert.ok(rows.every(({ accountEmail }) => accountEmail.toLowerCase() === TARGET_EMAIL));
  assert.equal(new Set(rows.map(({ accountId }) => accountId)).size, 1);
  assert.equal(new Set(rows.map(({ brandId }) => brandId)).size, 1);

  const locations = new Map(rows.map((row) => [row.countryCode, row]));
  assert.deepEqual(
    [...locations.keys()].sort(),
    ['de', 'gb'],
    'Expected only Germany and United Kingdom for the Selecdoo fixture.',
  );
  assert.equal(locations.get('de')?.languageCode, 'de');
  assert.equal(locations.get('gb')?.languageCode, 'en');

  return {
    accountId: rows[0].accountId,
    brandId: rows[0].brandId,
    brandName: rows[0].brandName,
    locations,
  };
}

async function countFixture(executor: SqlClient, target: TargetPortfolio) {
  const locationIds = [...target.locations.values()].map(({ locationId }) => locationId);
  const rows = await executor<{ discovered: number; saved: number }[]>`
    SELECT
      (
        SELECT count(*)
        FROM crewcast.discovered_affiliates
        WHERE user_id = ${target.accountId}
          AND brand_id = ${target.brandId}::bigint
          AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
          AND search_keyword = ${FIXTURE_MARKER}
      )::integer AS discovered,
      (
        SELECT count(*)
        FROM crewcast.saved_affiliates
        WHERE user_id = ${target.accountId}
          AND brand_id = ${target.brandId}::bigint
          AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
          AND link = ANY(${executor.array(fixtureLinks)}::text[])
          AND snippet LIKE ${`${FIXTURE_SNIPPET_PREFIX}%`}
      )::integer AS saved
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function assertNoForeignLinkCollisions(executor: SqlClient, target: TargetPortfolio) {
  const locationIds = [...target.locations.values()].map(({ locationId }) => locationId);
  const rows = await executor<{ tableName: string; link: string }[]>`
    SELECT 'discovered_affiliates' AS "tableName", link
    FROM crewcast.discovered_affiliates
    WHERE user_id = ${target.accountId}
      AND brand_id = ${target.brandId}::bigint
      AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
      AND link = ANY(${executor.array(fixtureLinks)}::text[])
      AND search_keyword IS DISTINCT FROM ${FIXTURE_MARKER}
    UNION ALL
    SELECT 'saved_affiliates' AS "tableName", link
    FROM crewcast.saved_affiliates
    WHERE user_id = ${target.accountId}
      AND brand_id = ${target.brandId}::bigint
      AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
      AND link = ANY(${executor.array(fixtureLinks)}::text[])
      AND snippet NOT LIKE ${`${FIXTURE_SNIPPET_PREFIX}%`}
  `;
  assert.equal(rows.length, 0, 'A reserved fixture link is already used by non-fixture data.');
}

async function removeFixture(executor: SqlClient, target: TargetPortfolio): Promise<void> {
  const locationIds = [...target.locations.values()].map(({ locationId }) => locationId);
  await executor`
    DELETE FROM crewcast.saved_affiliates
    WHERE user_id = ${target.accountId}
      AND brand_id = ${target.brandId}::bigint
      AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
      AND link = ANY(${executor.array(fixtureLinks)}::text[])
      AND snippet LIKE ${`${FIXTURE_SNIPPET_PREFIX}%`}
  `;
  await executor`
    DELETE FROM crewcast.discovered_affiliates
    WHERE user_id = ${target.accountId}
      AND brand_id = ${target.brandId}::bigint
      AND brand_location_id = ANY(${executor.array(locationIds)}::bigint[])
      AND search_keyword = ${FIXTURE_MARKER}
  `;
}

async function insertDiscovered(
  executor: SqlClient,
  target: TargetPortfolio,
  affiliate: FixtureAffiliate,
  index: number,
): Promise<void> {
  const location = target.locations.get(affiliate.countryCode);
  assert.ok(location, `Missing ${affiliate.countryCode} location.`);
  const discoveredAt = new Date(Date.now() - index * 60_000).toISOString();
  const rows = await executor<{ id: number }[]>`
    INSERT INTO crewcast.discovered_affiliates (
      user_id, brand_id, brand_location_id,
      search_keyword, title, link, domain, snippet, source,
      is_affiliate, person_name, summary, views, date, rank, keyword,
      discovery_method_type, discovery_method_value,
      is_already_affiliate, is_new,
      channel_name, channel_link, channel_verified, channel_subscribers,
      tiktok_username, tiktok_display_name, tiktok_bio,
      tiktok_followers, tiktok_likes, tiktok_is_verified,
      instagram_username, instagram_full_name, instagram_bio,
      instagram_followers, instagram_is_verified,
      discovered_at
    ) VALUES (
      ${target.accountId}, ${target.brandId}::bigint, ${location.locationId}::bigint,
      ${FIXTURE_MARKER}, ${affiliate.title}, ${affiliate.link}, ${affiliate.domain},
      ${affiliate.snippet}, ${affiliate.source},
      true, ${affiliate.personName}, ${affiliate.summary}, ${affiliate.views},
      '9/4/2026', ${affiliate.rank}, ${affiliate.discoveryValue},
      'topic', ${affiliate.discoveryValue}, false, true,
      ${affiliate.channelName}, ${affiliate.channelLink}, ${affiliate.channelVerified},
      ${affiliate.channelSubscribers},
      ${affiliate.tiktokUsername ?? null}, ${affiliate.personName}, ${affiliate.summary},
      ${affiliate.tiktokFollowers ?? null}, ${affiliate.tiktokLikes ?? null},
      ${affiliate.source === 'TikTok' ? affiliate.channelVerified : null},
      ${affiliate.instagramUsername ?? null}, ${affiliate.personName}, ${affiliate.summary},
      ${affiliate.instagramFollowers ?? null},
      ${affiliate.source === 'Instagram' ? affiliate.channelVerified : null},
      ${discoveredAt}::timestamptz
    )
    ON CONFLICT (brand_location_id, link) DO NOTHING
    RETURNING id
  `;
  assert.equal(rows.length, 1, `Could not insert fixture ${affiliate.link}.`);
}

async function insertSaved(
  executor: SqlClient,
  target: TargetPortfolio,
  affiliate: FixtureAffiliate,
  index: number,
): Promise<void> {
  const location = target.locations.get(affiliate.countryCode);
  assert.ok(location, `Missing ${affiliate.countryCode} location.`);
  const savedAt = new Date(Date.now() - index * 60_000).toISOString();
  const rows = await executor<{ id: number }[]>`
    INSERT INTO crewcast.saved_affiliates (
      user_id, brand_id, brand_location_id,
      title, link, domain, snippet, source,
      is_affiliate, person_name, summary, views, date, rank, keyword,
      discovery_method_type, discovery_method_value,
      is_already_affiliate, is_new,
      channel_name, channel_link, channel_verified, channel_subscribers,
      tiktok_username, tiktok_display_name, tiktok_bio,
      tiktok_followers, tiktok_likes, tiktok_is_verified,
      instagram_username, instagram_full_name, instagram_bio,
      instagram_followers, instagram_is_verified,
      saved_at
    ) VALUES (
      ${target.accountId}, ${target.brandId}::bigint, ${location.locationId}::bigint,
      ${affiliate.title}, ${affiliate.link}, ${affiliate.domain}, ${affiliate.snippet},
      ${affiliate.source}, true, ${affiliate.personName}, ${affiliate.summary},
      ${affiliate.views}, '9/4/2026', ${affiliate.rank}, ${affiliate.discoveryValue},
      'topic', ${affiliate.discoveryValue}, false, true,
      ${affiliate.channelName}, ${affiliate.channelLink}, ${affiliate.channelVerified},
      ${affiliate.channelSubscribers},
      ${affiliate.tiktokUsername ?? null}, ${affiliate.personName}, ${affiliate.summary},
      ${affiliate.tiktokFollowers ?? null}, ${affiliate.tiktokLikes ?? null},
      ${affiliate.source === 'TikTok' ? affiliate.channelVerified : null},
      ${affiliate.instagramUsername ?? null}, ${affiliate.personName}, ${affiliate.summary},
      ${affiliate.instagramFollowers ?? null},
      ${affiliate.source === 'Instagram' ? affiliate.channelVerified : null},
      ${savedAt}::timestamptz
    )
    ON CONFLICT (brand_location_id, link) DO NOTHING
    RETURNING id
  `;
  assert.equal(rows.length, 1, `Could not save fixture ${affiliate.link}.`);
}

function requestedMode(): 'inspect' | 'apply' | 'cleanup' {
  const apply = process.argv.includes('--apply');
  const cleanup = process.argv.includes('--cleanup');
  assert.ok(!(apply && cleanup), 'Choose either --apply or --cleanup, not both.');
  if (apply) return 'apply';
  if (cleanup) return 'cleanup';
  return 'inspect';
}

async function main(): Promise<void> {
  const mode = requestedMode();
  const target = await resolveTarget(sql);
  const before = await countFixture(sql, target);

  if (mode === 'inspect') {
    console.log(JSON.stringify({
      mode,
      projectRef: STAGING_PROJECT_REF,
      accountId: target.accountId,
      brandId: target.brandId,
      brandName: target.brandName,
      locations: [...target.locations.values()].map(({ locationId, countryCode, languageCode }) => ({
        locationId,
        countryCode,
        languageCode,
      })),
      currentFixture: before,
      plannedFixture: {
        discovered: FIXTURE_AFFILIATES.length,
        saved: FIXTURE_AFFILIATES.filter(({ saved }) => saved).length,
      },
    }, null, 2));
    return;
  }

  await sql.begin(async (transaction) => {
    const executor = transaction as unknown as SqlClient;
    await assertNoForeignLinkCollisions(executor, target);
    await removeFixture(executor, target);

    if (mode === 'apply') {
      for (const [index, affiliate] of FIXTURE_AFFILIATES.entries()) {
        await insertDiscovered(executor, target, affiliate, index);
        if (affiliate.saved) await insertSaved(executor, target, affiliate, index);
      }
    }
  });

  const after = await countFixture(sql, target);
  const expected = mode === 'apply'
    ? {
        discovered: FIXTURE_AFFILIATES.length,
        saved: FIXTURE_AFFILIATES.filter(({ saved }) => saved).length,
      }
    : { discovered: 0, saved: 0 };
  assert.equal(after.discovered, expected.discovered);
  assert.equal(after.saved, expected.saved);

  console.log(JSON.stringify({
    mode,
    projectRef: STAGING_PROJECT_REF,
    accountId: target.accountId,
    brandId: target.brandId,
    before,
    after,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
