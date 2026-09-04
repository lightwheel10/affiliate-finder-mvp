import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';

const stagingProjectRef = 'jxerxreqezhdsisdwddw';
const syntheticEmailPattern = 'codex-affiliate-isolation-%@example.invalid';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const candidates = new Set<string>();
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) candidates.add(direct[1]);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) candidates.add(pooler[1]);
  if (candidates.size !== 1) throw new Error('Could not prove one Supabase project reference.');
  return [...candidates][0];
}

assert.equal(
  extractProjectRef(databaseUrl),
  stagingProjectRef,
  'Refusing to test against anything except Terminal-Backup.',
);

type SqlClient = postgres.Sql;

const sql = postgres(databaseUrl, {
  max: 10,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
});

interface GlobalState {
  users: number;
  brands: number;
  locations: number;
  jobs: number;
  discovered: number;
  saved: number;
  occurrences: number;
  syntheticUsers: number;
}

interface AccountFoundation {
  accountId: number;
  email: string;
  brandId: string;
  locationIds: string[];
}

interface Fixture {
  owner: AccountFoundation;
  stranger: AccountFoundation;
}

interface DatabaseErrorShape {
  code?: string;
  constraint_name?: string;
  message?: string;
}

async function globalState(executor: SqlClient): Promise<GlobalState> {
  const rows = await executor<GlobalState[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS users,
      (SELECT count(*) FROM crewcast.brands)::integer AS brands,
      (SELECT count(*) FROM crewcast.brand_locations)::integer AS locations,
      (SELECT count(*) FROM crewcast.search_jobs)::integer AS jobs,
      (SELECT count(*) FROM crewcast.discovered_affiliates)::integer AS discovered,
      (SELECT count(*) FROM crewcast.saved_affiliates)::integer AS saved,
      (SELECT count(*) FROM crewcast.search_job_results)::integer AS occurrences,
      (
        SELECT count(*)
        FROM crewcast.users
        WHERE email LIKE ${syntheticEmailPattern}
      )::integer AS "syntheticUsers"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

async function assertCutoverSchema(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0011_affiliate_location_identity_cutover.up.sql',
  );
  const ledger = await sql<{ checksum: string }[]>`
    SELECT checksum_sha256 AS checksum
    FROM crewcast.schema_migrations
    WHERE version = '0011'
  `;
  assert.equal(ledger.length, 1, 'Migration 0011 must be applied before this test.');
  assert.equal(ledger[0].checksum, sha256(migrationPath));

  const constraints = await sql<{ conname: string; convalidated: boolean }[]>`
    SELECT conname, convalidated
    FROM pg_constraint
    WHERE connamespace = 'crewcast'::regnamespace
      AND conname = ANY(ARRAY[
        'discovered_affiliates_location_link_key',
        'discovered_affiliates_exact_location_key',
        'saved_affiliates_location_link_key',
        'saved_affiliates_exact_location_key',
        'search_job_results_exact_job_fkey',
        'search_job_results_exact_affiliate_fkey'
      ]::text[])
    ORDER BY conname
  `;
  assert.equal(constraints.length, 6);
  assert.ok(constraints.every(({ convalidated }) => convalidated));

  const legacyConstraints = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM pg_constraint
    WHERE connamespace = 'crewcast'::regnamespace
      AND conname = ANY(ARRAY[
        'discovered_affiliates_user_id_link_key',
        'saved_affiliates_user_id_link_key'
      ]::text[])
  `;
  assert.equal(legacyConstraints[0].count, 0);

  const nullableScopeColumns = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM pg_attribute
    WHERE attrelid = ANY(ARRAY[
      'crewcast.discovered_affiliates'::regclass,
      'crewcast.saved_affiliates'::regclass,
      'crewcast.search_job_results'::regclass
    ])
      AND attname IN ('brand_id', 'brand_location_id')
      AND NOT attnotnull
  `;
  assert.equal(nullableScopeColumns[0].count, 0);

  const triggers = await sql<{ tgname: string; enabled: string }[]>`
    SELECT tgname, tgenabled AS enabled
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname = ANY(ARRAY[
        'discovered_affiliates_location_identity_immutable',
        'saved_affiliates_location_identity_immutable',
        'search_job_results_provenance_immutable'
      ]::text[])
    ORDER BY tgname
  `;
  assert.equal(triggers.length, 3);
  assert.ok(triggers.every(({ enabled }) => enabled === 'O'));

  const access = await sql<{
    table_name: string;
    rls: boolean;
    client_write_or_read: boolean;
  }[]>`
    SELECT
      tables.relname AS table_name,
      tables.relrowsecurity AS rls,
      coalesce(bool_or(
        (acl.grantee = 0 OR grantees.rolname IN ('anon', 'authenticated'))
        AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      ), false) AS client_write_or_read
    FROM pg_class AS tables
    LEFT JOIN LATERAL aclexplode(
      coalesce(tables.relacl, acldefault('r', tables.relowner))
    ) AS acl ON true
    LEFT JOIN pg_roles AS grantees ON grantees.oid = acl.grantee
    WHERE tables.relnamespace = 'crewcast'::regnamespace
      AND tables.relname IN (
        'discovered_affiliates',
        'saved_affiliates',
        'search_job_results'
      )
    GROUP BY tables.relname, tables.relrowsecurity
    ORDER BY tables.relname
  `;
  assert.equal(access.length, 3);
  assert.ok(access.every(({ rls, client_write_or_read }) => rls && !client_write_or_read));
}

async function createAccount(label: string, locationCount: number): Promise<AccountFoundation> {
  const token = randomUUID().replaceAll('-', '');
  const email = `codex-affiliate-isolation-${label}-${token}@example.invalid`;
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    ) VALUES (${email}, 'Affiliate isolation verification', true, 8, false, 'free_trial')
    RETURNING id
  `;
  const accountId = users[0].id;
  const brands = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (
      ${accountId},
      ${`Affiliate isolation ${label}`},
      ${`affiliate-${label}-${token}.example`},
      true
    )
    RETURNING id::text AS id
  `;
  const brandId = brands[0].id;
  const locationIds: string[] = [];
  const markets = [
    { country: 'gb', language: 'en' },
    { country: 'de', language: 'de' },
    { country: 'us', language: 'en' },
  ];
  for (let index = 0; index < locationCount; index += 1) {
    const market = markets[index];
    const locations = await sql<{ id: string }[]>`
      INSERT INTO crewcast.brand_locations (
        user_id, brand_id, country_code, language_code,
        topics, competitors, is_default
      ) VALUES (
        ${accountId}, ${brandId}::bigint, ${market.country}, ${market.language},
        ARRAY[${`topic-${label}-${index}`}], ARRAY[]::text[], ${index === 0}
      )
      RETURNING id::text AS id
    `;
    locationIds.push(locations[0].id);
  }
  return { accountId, email, brandId, locationIds };
}

async function createFixture(): Promise<Fixture> {
  return {
    owner: await createAccount('owner', 2),
    stranger: await createAccount('stranger', 1),
  };
}

async function insertDiscovered(
  executor: SqlClient,
  account: AccountFoundation,
  locationId: string,
  link: string,
): Promise<number[]> {
  const rows = await executor<{ id: number }[]>`
    INSERT INTO crewcast.discovered_affiliates (
      user_id, brand_id, brand_location_id,
      search_keyword, title, link, domain, snippet, source
    ) VALUES (
      ${account.accountId}, ${account.brandId}::bigint, ${locationId}::bigint,
      'isolation-test', 'Isolation test', ${link}, 'example.invalid',
      'Synthetic location-isolation verification', 'Web'
    )
    ON CONFLICT (brand_location_id, link) DO NOTHING
    RETURNING id
  `;
  return rows.map(({ id }) => id);
}

async function insertSaved(
  executor: SqlClient,
  account: AccountFoundation,
  locationId: string,
  link: string,
): Promise<number[]> {
  const rows = await executor<{ id: number }[]>`
    INSERT INTO crewcast.saved_affiliates (
      user_id, brand_id, brand_location_id,
      title, link, domain, snippet, source
    ) VALUES (
      ${account.accountId}, ${account.brandId}::bigint, ${locationId}::bigint,
      'Isolation test', ${link}, 'example.invalid',
      'Synthetic location-isolation verification', 'Web'
    )
    ON CONFLICT (brand_location_id, link) DO NOTHING
    RETURNING id
  `;
  return rows.map(({ id }) => id);
}

async function expectDatabaseError(
  action: () => Promise<unknown>,
  expectedCode: string,
  expectedText?: string,
): Promise<void> {
  try {
    await action();
    assert.fail(`Expected PostgreSQL error ${expectedCode}.`);
  } catch (error) {
    const databaseError = error as DatabaseErrorShape;
    assert.equal(databaseError.code, expectedCode, databaseError.message);
    if (expectedText) assert.match(databaseError.message ?? '', new RegExp(expectedText, 'i'));
  }
}

async function verifyDuplicateAndScopeBehavior(fixture: Fixture): Promise<{
  locationOneDiscoveredId: number;
  locationTwoDiscoveredId: number;
  commonDiscoveredLink: string;
  commonSavedLink: string;
}> {
  const [locationOneId, locationTwoId] = fixture.owner.locationIds;
  const commonDiscoveredLink = `https://common-discovered-${randomUUID()}.example/path`;
  const commonSavedLink = `https://common-saved-${randomUUID()}.example/path`;

  const locationOneDiscovered = await insertDiscovered(
    sql,
    fixture.owner,
    locationOneId,
    commonDiscoveredLink,
  );
  const locationTwoDiscovered = await insertDiscovered(
    sql,
    fixture.owner,
    locationTwoId,
    commonDiscoveredLink,
  );
  assert.equal(locationOneDiscovered.length, 1);
  assert.equal(locationTwoDiscovered.length, 1);
  assert.equal(
    (await insertDiscovered(sql, fixture.owner, locationOneId, commonDiscoveredLink)).length,
    0,
  );

  assert.equal((await insertSaved(sql, fixture.owner, locationOneId, commonSavedLink)).length, 1);
  assert.equal((await insertSaved(sql, fixture.owner, locationTwoId, commonSavedLink)).length, 1);
  assert.equal((await insertSaved(sql, fixture.owner, locationOneId, commonSavedLink)).length, 0);

  const raceDiscoveredLink = `https://race-discovered-${randomUUID()}.example/path`;
  const raceSavedLink = `https://race-saved-${randomUUID()}.example/path`;
  const [discoveredAttempts, savedAttempts] = await Promise.all([
    Promise.all(Array.from({ length: 100 }, () =>
      insertDiscovered(sql, fixture.owner, locationOneId, raceDiscoveredLink))),
    Promise.all(Array.from({ length: 100 }, () =>
      insertSaved(sql, fixture.owner, locationOneId, raceSavedLink))),
  ]);
  assert.equal(discoveredAttempts.flat().length, 1);
  assert.equal(savedAttempts.flat().length, 1);

  const counts = await sql<{
    discoveredCommon: number;
    savedCommon: number;
    discoveredRace: number;
    savedRace: number;
  }[]>`
    SELECT
      (
        SELECT count(*) FROM crewcast.discovered_affiliates
        WHERE user_id = ${fixture.owner.accountId} AND link = ${commonDiscoveredLink}
      )::integer AS "discoveredCommon",
      (
        SELECT count(*) FROM crewcast.saved_affiliates
        WHERE user_id = ${fixture.owner.accountId} AND link = ${commonSavedLink}
      )::integer AS "savedCommon",
      (
        SELECT count(*) FROM crewcast.discovered_affiliates
        WHERE user_id = ${fixture.owner.accountId} AND link = ${raceDiscoveredLink}
      )::integer AS "discoveredRace",
      (
        SELECT count(*) FROM crewcast.saved_affiliates
        WHERE user_id = ${fixture.owner.accountId} AND link = ${raceSavedLink}
      )::integer AS "savedRace"
  `;
  assert.deepEqual(counts[0], {
    discoveredCommon: 2,
    savedCommon: 2,
    discoveredRace: 1,
    savedRace: 1,
  });

  await sql`
    UPDATE crewcast.discovered_affiliates
    SET title = 'Location one only'
    WHERE user_id = ${fixture.owner.accountId}
      AND brand_id = ${fixture.owner.brandId}::bigint
      AND brand_location_id = ${locationOneId}::bigint
      AND link = ${commonDiscoveredLink}
  `;
  const titles = await sql<{ locationId: string; title: string }[]>`
    SELECT brand_location_id::text AS "locationId", title
    FROM crewcast.discovered_affiliates
    WHERE user_id = ${fixture.owner.accountId}
      AND link = ${commonDiscoveredLink}
    ORDER BY brand_location_id
  `;
  assert.equal(titles.length, 2);
  assert.deepEqual(titles[0], {
    locationId: locationOneId,
    title: 'Location one only',
  });
  assert.deepEqual(titles[1], {
    locationId: locationTwoId,
    title: 'Isolation test',
  });

  return {
    locationOneDiscoveredId: locationOneDiscovered[0],
    locationTwoDiscoveredId: locationTwoDiscovered[0],
    commonDiscoveredLink,
    commonSavedLink,
  };
}

async function verifyOwnershipAndNullRejection(fixture: Fixture): Promise<void> {
  const link = `https://forbidden-${randomUUID()}.example/path`;
  await expectDatabaseError(
    () => sql`
      INSERT INTO crewcast.discovered_affiliates (
        user_id, brand_id, brand_location_id,
        search_keyword, title, link, domain, snippet, source
      ) VALUES (
        ${fixture.owner.accountId}, ${fixture.owner.brandId}::bigint,
        ${fixture.stranger.locationIds[0]}::bigint,
        'isolation-test', 'Forbidden', ${link}, 'example.invalid', 'Forbidden', 'Web'
      )
    `,
    '23503',
  );

  await expectDatabaseError(
    () => sql`
      INSERT INTO crewcast.saved_affiliates (
        user_id, title, link, domain, snippet, source
      ) VALUES (
        ${fixture.owner.accountId}, 'Missing scope',
        ${`https://missing-scope-${randomUUID()}.example/path`},
        'example.invalid', 'Missing scope', 'Web'
      )
    `,
    '23502',
  );
}

async function createSearchJob(
  fixture: Fixture,
  locationId: string,
): Promise<number> {
  const requestId = randomUUID();
  const rows = await sql<{ id: number }[]>`
    INSERT INTO crewcast.search_jobs (
      user_id, keyword, sources, apify_run_id, status, user_settings,
      brand_id, brand_location_id, settings_snapshot, request_id
    ) VALUES (
      ${fixture.owner.accountId}, 'isolation occurrence', ARRAY['Web']::text[],
      ${`synthetic-isolation-${requestId}`}, 'running',
      ${sql.json({
        targetCountry: 'United Kingdom',
        targetLanguage: 'English',
        userBrand: 'affiliate-isolation.example',
        topics: ['isolation'],
        competitors: [],
      })},
      ${fixture.owner.brandId}::bigint, ${locationId}::bigint,
      ${sql.json({
        version: 1,
        brand: {
          id: fixture.owner.brandId,
          name: 'Affiliate isolation owner',
          normalizedDomain: 'affiliate-isolation.example',
        },
        location: {
          id: locationId,
          countryCode: 'gb',
          countryName: 'United Kingdom',
          languageCode: 'en',
          languageName: 'English',
        },
        search: {
          keywords: ['isolation'],
          competitors: [],
          sources: ['Web'],
          requestId,
        },
      })},
      ${requestId}::uuid
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function verifyOccurrenceProvenance(
  fixture: Fixture,
  locationOneDiscoveredId: number,
  locationTwoDiscoveredId: number,
  commonDiscoveredLink: string,
): Promise<void> {
  const [locationOneId, locationTwoId] = fixture.owner.locationIds;
  const jobId = await createSearchJob(fixture, locationOneId);

  await expectDatabaseError(
    () => sql`
      INSERT INTO crewcast.search_job_results (
        user_id, search_job_id, brand_id, brand_location_id,
        discovered_affiliate_id, result_link, affiliate_was_new, result_snapshot
      ) VALUES (
        ${fixture.owner.accountId}, ${jobId}, ${fixture.owner.brandId}::bigint,
        ${locationOneId}::bigint, ${locationTwoDiscoveredId}, ${commonDiscoveredLink},
        false, ${sql.json({ link: commonDiscoveredLink, title: 'Wrong location' })}
      )
    `,
    '23503',
  );

  const occurrences = await sql<{ id: string }[]>`
    INSERT INTO crewcast.search_job_results (
      user_id, search_job_id, brand_id, brand_location_id,
      discovered_affiliate_id, result_link, affiliate_was_new, result_snapshot
    ) VALUES (
      ${fixture.owner.accountId}, ${jobId}, ${fixture.owner.brandId}::bigint,
      ${locationOneId}::bigint, ${locationOneDiscoveredId}, ${commonDiscoveredLink},
      false, ${sql.json({ link: commonDiscoveredLink, title: 'Correct location' })}
    )
    RETURNING id::text AS id
  `;
  assert.equal(occurrences.length, 1);

  await expectDatabaseError(
    () => sql`
      UPDATE crewcast.discovered_affiliates
      SET brand_location_id = ${locationTwoId}::bigint
      WHERE id = ${locationOneDiscoveredId}
    `,
    'P0001',
    'ownership are immutable',
  );
  const savedRows = await sql<{ id: number }[]>`
    SELECT id
    FROM crewcast.saved_affiliates
    WHERE user_id = ${fixture.owner.accountId}
      AND brand_location_id = ${locationOneId}::bigint
    ORDER BY id
    LIMIT 1
  `;
  await expectDatabaseError(
    () => sql`
      UPDATE crewcast.saved_affiliates
      SET brand_location_id = ${locationTwoId}::bigint
      WHERE id = ${savedRows[0].id}
    `,
    'P0001',
    'ownership are immutable',
  );
  await expectDatabaseError(
    () => sql`
      UPDATE crewcast.search_job_results
      SET discovered_affiliate_id = ${locationTwoDiscoveredId}
      WHERE id = ${occurrences[0].id}::bigint
    `,
    'P0001',
    'provenance is immutable',
  );
}

async function verifyRollbackRefusesDataLoss(): Promise<void> {
  const downSql = readFileSync(
    path.resolve(
      process.cwd(),
      'supabase/migrations/0011_affiliate_location_identity_cutover.down.sql',
    ),
    'utf8',
  );
  await expectDatabaseError(
    () => sql.begin(async (transaction) => transaction.unsafe(downSql)),
    'P0001',
    'valid cross-location duplicates',
  );
  await assertCutoverSchema();
}

async function verifyScopedDeletes(
  fixture: Fixture,
  commonDiscoveredLink: string,
  commonSavedLink: string,
): Promise<void> {
  const [locationOneId, locationTwoId] = fixture.owner.locationIds;
  await sql`
    DELETE FROM crewcast.discovered_affiliates
    WHERE user_id = ${fixture.owner.accountId}
      AND brand_id = ${fixture.owner.brandId}::bigint
      AND brand_location_id = ${locationOneId}::bigint
      AND link = ${commonDiscoveredLink}
  `;
  await sql`
    DELETE FROM crewcast.saved_affiliates
    WHERE user_id = ${fixture.owner.accountId}
      AND brand_id = ${fixture.owner.brandId}::bigint
      AND brand_location_id = ${locationOneId}::bigint
      AND link = ${commonSavedLink}
  `;
  const remaining = await sql<{ discovered: number; saved: number }[]>`
    SELECT
      (
        SELECT count(*) FROM crewcast.discovered_affiliates
        WHERE user_id = ${fixture.owner.accountId}
          AND brand_location_id = ${locationTwoId}::bigint
          AND link = ${commonDiscoveredLink}
      )::integer AS discovered,
      (
        SELECT count(*) FROM crewcast.saved_affiliates
        WHERE user_id = ${fixture.owner.accountId}
          AND brand_location_id = ${locationTwoId}::bigint
          AND link = ${commonSavedLink}
      )::integer AS saved
  `;
  assert.deepEqual(remaining[0], { discovered: 1, saved: 1 });
}

async function cleanup(fixture: Fixture): Promise<void> {
  const accountIds = [fixture.owner.accountId, fixture.stranger.accountId];
  const emails = [fixture.owner.email, fixture.stranger.email];
  await sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM crewcast.search_job_results
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.saved_affiliates
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.discovered_affiliates
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.search_jobs
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brand_locations
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brands
      WHERE user_id = ANY(${transaction.array(accountIds)}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.users
      WHERE id = ANY(${transaction.array(accountIds)}::integer[])
        AND email = ANY(${transaction.array(emails)}::text[])
    `;
  });
}

async function main(): Promise<void> {
  await assertCutoverSchema();
  const before = await globalState(sql);
  assert.equal(before.syntheticUsers, 0, 'A prior synthetic fixture must not remain.');
  const fixture = await createFixture();
  try {
    const identity = await verifyDuplicateAndScopeBehavior(fixture);
    await verifyOwnershipAndNullRejection(fixture);
    await verifyOccurrenceProvenance(
      fixture,
      identity.locationOneDiscoveredId,
      identity.locationTwoDiscoveredId,
      identity.commonDiscoveredLink,
    );
    await verifyRollbackRefusesDataLoss();
    await verifyScopedDeletes(
      fixture,
      identity.commonDiscoveredLink,
      identity.commonSavedLink,
    );
  } finally {
    await cleanup(fixture);
  }
  const after = await globalState(sql);
  assert.deepEqual(after, before);
  console.log(
    `Affiliate location-isolation staging verification passed for ${stagingProjectRef}: exact migration checksum, constraints, RLS/client isolation, same-location deduplication, cross-location identity, 200 concurrent writes, cross-account/null rejection, immutable ownership/provenance, lossless rollback refusal, scoped updates/deletes, exact global counts restored and residue 0.`,
  );
}

main()
  .finally(() => sql.end({ timeout: 5 }))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
