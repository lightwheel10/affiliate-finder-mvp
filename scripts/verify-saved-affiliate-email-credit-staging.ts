import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import { consumeCredits, type CreditSqlExecutor } from '../src/lib/credits';
import { sql as applicationSql } from '../src/lib/db';
import {
  finalizeSavedAffiliateEmail,
  reserveSavedAffiliateEmailLookup,
  type FinalizeSavedAffiliateEmailInput,
  type ReserveSavedAffiliateEmailLookupInput,
  type SavedAffiliateEmailDatabase,
} from '../src/lib/affiliates/saved-email-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PREFIX = 'codex-saved-email-credit-';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function projectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) return pooler[1];
  throw new Error('Could not prove the Supabase project reference.');
}

assert.equal(
  projectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to test saved-email charging outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  max: 8,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const database = sql as unknown as SavedAffiliateEmailDatabase;
const token = randomUUID().replaceAll('-', '');
const syntheticEmail = `${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`;

interface Fixture {
  accountId: number;
  brandId: string;
  locationId: string;
  affiliateIds: [number, number];
}

interface Snapshot {
  used: number;
  topup: number;
  found: number;
  searching: number;
  ledger: number;
}

function input(
  fixture: Fixture,
  affiliateId: number,
  email = `creator-${affiliateId}@example.test`,
): FinalizeSavedAffiliateEmailInput {
  return {
    accountId: fixture.accountId,
    brandId: fixture.brandId,
    brandLocationId: fixture.locationId,
    affiliateId,
    emailStatus: 'found',
    email,
    provider: 'bio_extraction',
    enforceCredits: true,
  };
}

function reserveInput(
  fixture: Fixture,
  affiliateId: number,
): ReserveSavedAffiliateEmailLookupInput {
  return {
    accountId: fixture.accountId,
    brandId: fixture.brandId,
    brandLocationId: fixture.locationId,
    affiliateId,
    enforceCredits: true,
  };
}

async function createFixture(): Promise<Fixture> {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    )
    VALUES (${syntheticEmail}, 'Saved email credit verification', true, 8, false, 'free_trial')
    RETURNING id
  `;
  assert.equal(users.length, 1);
  const accountId = users[0].id;

  const brands = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (${accountId}, 'Saved email verification', ${`saved-email-${token}.example`}, true)
    RETURNING id::text AS id
  `;
  const brandId = brands[0].id;
  const locations = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, topics, competitors, is_default
    )
    VALUES (
      ${accountId}, ${brandId}::bigint, 'gb', 'en',
      ARRAY['saved email'], ARRAY[]::text[], true
    )
    RETURNING id::text AS id
  `;
  const locationId = locations[0].id;

  await sql`
    INSERT INTO crewcast.user_credits (
      user_id,
      topic_search_credits_total,
      email_credits_total,
      ai_credits_total,
      topic_search_credits_used,
      email_credits_used,
      ai_credits_used,
      topic_search_credits_topup,
      email_credits_topup,
      ai_credits_topup,
      period_start,
      period_end,
      is_trial_period
    )
    VALUES (${accountId}, 0, 1, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW() + INTERVAL '1 day', false)
  `;

  const affiliates = await sql<{ id: number }[]>`
    INSERT INTO crewcast.saved_affiliates (
      user_id, brand_id, brand_location_id, title, link, domain, snippet, source, email_status
    )
    VALUES
      (${accountId}, ${brandId}::bigint, ${locationId}::bigint,
        'Creator one', ${`https://creator-one-${token}.example`}, ${`creator-one-${token}.example`}, '', 'Instagram', 'not_searched'),
      (${accountId}, ${brandId}::bigint, ${locationId}::bigint,
        'Creator two', ${`https://creator-two-${token}.example`}, ${`creator-two-${token}.example`}, '', 'TikTok', 'not_searched')
    RETURNING id
  `;
  assert.equal(affiliates.length, 2);
  return {
    accountId,
    brandId,
    locationId,
    affiliateIds: [affiliates[0].id, affiliates[1].id],
  };
}

async function resetFixture(fixture: Fixture): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.user_credits
      SET email_credits_total = 1, email_credits_used = 0, email_credits_topup = 0,
          period_end = NOW() + INTERVAL '1 day'
      WHERE user_id = ${fixture.accountId}
    `;
    await transaction`
      DELETE FROM crewcast.credit_transactions
      WHERE user_id = ${fixture.accountId}
        AND credit_type = 'email'
        AND reason = 'usage'
    `;
    await transaction`
      UPDATE crewcast.saved_affiliates
      SET email = NULL, email_status = 'not_searched', email_provider = NULL,
          email_searched_at = NULL
      WHERE user_id = ${fixture.accountId}
    `;
  });
}

async function snapshot(fixture: Fixture): Promise<Snapshot> {
  const rows = await sql<Snapshot[]>`
    SELECT
      credits.email_credits_used AS used,
      credits.email_credits_topup AS topup,
      (SELECT count(*)::integer FROM crewcast.saved_affiliates AS affiliates
        WHERE affiliates.user_id = credits.user_id
          AND affiliates.email_status = 'found') AS found,
      (SELECT count(*)::integer FROM crewcast.saved_affiliates AS affiliates
        WHERE affiliates.user_id = credits.user_id
          AND affiliates.email_status = 'searching') AS searching,
      (SELECT count(*)::integer FROM crewcast.credit_transactions AS transactions
        WHERE transactions.user_id = credits.user_id
          AND transactions.credit_type = 'email'
          AND transactions.reason = 'usage') AS ledger
    FROM crewcast.user_credits AS credits
    WHERE credits.user_id = ${fixture.accountId}
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

function failingDatabase(failurePoint: 'ledger' | 'affiliate'): SavedAffiliateEmailDatabase {
  const candidate = (async () => {
    throw new Error('Queries must run inside a transaction.');
  }) as unknown as SavedAffiliateEmailDatabase;
  candidate.begin = <T>(
    operation: (transaction: CreditSqlExecutor) => Promise<T>,
  ): Promise<T> => sql.begin(async (transaction) => {
    const base = transaction as unknown as CreditSqlExecutor;
    const wrapped = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<readonly object[]> => {
      const query = strings.join('?').replace(/\s+/g, ' ').trim().toLowerCase();
      if (
        failurePoint === 'ledger'
        && query.startsWith('insert into crewcast.credit_transactions')
      ) {
        throw new Error('Injected staging ledger failure');
      }
      if (
        failurePoint === 'affiliate'
        && query.startsWith('update crewcast.saved_affiliates')
      ) {
        throw new Error('Injected staging affiliate failure');
      }
      return base(strings, ...values);
    }) as CreditSqlExecutor;
    return operation(wrapped);
  });
  return candidate;
}

async function verify(): Promise<void> {
  const fixture = await createFixture();
  const firstAffiliate = input(fixture, fixture.affiliateIds[0]);

  const duplicateResults = await Promise.all(Array.from({ length: 50 }, () =>
    finalizeSavedAffiliateEmail(firstAffiliate, database),
  ));
  assert.equal(duplicateResults.filter(({ outcome }) => outcome === 'updated').length, 1);
  assert.equal(duplicateResults.filter(({ outcome }) => outcome === 'already_processed').length, 49);
  assert.deepEqual(await snapshot(fixture), { used: 1, topup: 0, found: 1, searching: 0, ledger: 1 });

  await resetFixture(fixture);
  const reservationResults = await Promise.all(Array.from({ length: 50 }, () =>
    reserveSavedAffiliateEmailLookup(
      reserveInput(fixture, fixture.affiliateIds[0]),
      database,
    ),
  ));
  assert.equal(reservationResults.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(reservationResults.filter(({ outcome }) => outcome === 'in_progress').length, 49);
  assert.deepEqual(await snapshot(fixture), { used: 1, topup: 0, found: 0, searching: 1, ledger: 1 });

  await resetFixture(fixture);
  await sql`
    UPDATE crewcast.user_credits
    SET email_credits_total = 2
    WHERE user_id = ${fixture.accountId}
  `;
  const [reservationRace, finalizationRace] = await Promise.all([
    reserveSavedAffiliateEmailLookup(
      reserveInput(fixture, fixture.affiliateIds[0]),
      database,
    ),
    finalizeSavedAffiliateEmail(firstAffiliate, database),
  ]);
  const raceOutcomes = new Set([reservationRace.outcome, finalizationRace.outcome]);
  assert.equal(
    (raceOutcomes.has('reserved') && raceOutcomes.has('in_progress'))
      || (raceOutcomes.has('already_processed') && raceOutcomes.has('updated')),
    true,
  );
  const raceSnapshot = await snapshot(fixture);
  assert.equal(raceSnapshot.used, 1);
  assert.equal(raceSnapshot.ledger, 1);
  assert.equal(raceSnapshot.found + raceSnapshot.searching, 1);

  // Exercise the public credit consumer against the same real rows. Both paths
  // lock account -> credit, so concurrent generic and affiliate consumption
  // must finish without a users/user_credits deadlock.
  await resetFixture(fixture);
  await sql`
    UPDATE crewcast.user_credits
    SET email_credits_total = 2
    WHERE user_id = ${fixture.accountId}
  `;
  const [genericConsumption, affiliateFinalization] = await Promise.all([
    consumeCredits(
      fixture.accountId,
      'email',
      1,
      'generic-lock-order-check',
      'staging_verification',
    ),
    finalizeSavedAffiliateEmail(firstAffiliate, database),
  ]);
  assert.equal(genericConsumption.success, true);
  assert.equal(affiliateFinalization.outcome, 'updated');
  assert.deepEqual(
    await snapshot(fixture),
    { used: 2, topup: 0, found: 1, searching: 0, ledger: 2 },
  );

  await resetFixture(fixture);
  const competingResults = await Promise.all(fixture.affiliateIds.map((affiliateId) =>
    finalizeSavedAffiliateEmail(input(fixture, affiliateId), database),
  ));
  assert.equal(competingResults.filter(({ outcome }) => outcome === 'updated').length, 1);
  assert.equal(competingResults.filter(({ outcome }) => outcome === 'insufficient_credits').length, 1);
  assert.deepEqual(await snapshot(fixture), { used: 1, topup: 0, found: 1, searching: 0, ledger: 1 });

  for (const failurePoint of ['ledger', 'affiliate'] as const) {
    await resetFixture(fixture);
    await assert.rejects(
      finalizeSavedAffiliateEmail(firstAffiliate, failingDatabase(failurePoint)),
      new RegExp(`injected staging ${failurePoint} failure`, 'i'),
    );
    assert.deepEqual(await snapshot(fixture), { used: 0, topup: 0, found: 0, searching: 0, ledger: 0 });
  }

  const retry = await finalizeSavedAffiliateEmail(firstAffiliate, database);
  assert.equal(retry.outcome, 'updated');
  assert.deepEqual(await snapshot(fixture), { used: 1, topup: 0, found: 1, searching: 0, ledger: 1 });

  await resetFixture(fixture);
  const freeNotFound = await finalizeSavedAffiliateEmail({
    ...firstAffiliate,
    emailStatus: 'not_found',
    email: null,
  }, database);
  assert.equal(freeNotFound.outcome, 'updated');
  assert.deepEqual(await snapshot(fixture), { used: 0, topup: 0, found: 0, searching: 0, ledger: 0 });

  console.log('Saved-affiliate email credit staging verification passed.');
}

async function cleanup(): Promise<void> {
  await sql`
    DELETE FROM crewcast.users
    WHERE email = ${syntheticEmail}
  `;
  const remaining = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
  `;
  assert.equal(remaining[0].count, 0, 'Synthetic saved-email verifier users remain.');
}

async function main(): Promise<void> {
  try {
    await verify();
  } finally {
    await cleanup();
    await sql.end({ timeout: 15 });
    await applicationSql.end({ timeout: 15 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
