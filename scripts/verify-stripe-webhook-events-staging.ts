import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { resetCreditsForNewPeriod } from '../src/lib/credits';
import { sql as applicationSql } from '../src/lib/db';
import {
  processDurableStripeWebhookEvent,
  type StripeWebhookEnvelope,
} from '../src/lib/stripe/webhook-events';
import { createStripeWebhookEventStore } from '../src/lib/stripe/webhook-events-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EVENT_PREFIX = 'evt_codex_webhook_';
const SYNTHETIC_EMAIL_PREFIX = 'codex-stripe-webhook-';

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const poolerHost = /\.pooler\.supabase\.com$/.test(parsed.hostname);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (poolerHost && pooler) return pooler[1];
  throw new Error('Could not prove a Supabase staging project reference.');
}

assert.equal(
  extractProjectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to test Stripe webhook persistence outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, { max: 10, prepare: false });
const store = createStripeWebhookEventStore(sql);
const token = randomUUID().replaceAll('-', '');
const eventIds: string[] = [];
let syntheticUserId: number | null = null;

function event(label: string): StripeWebhookEnvelope {
  const eventId = `${SYNTHETIC_EVENT_PREFIX}${token}_${label}`;
  eventIds.push(eventId);
  return {
    eventId,
    eventType: 'invoice.paid',
    objectId: `in_codex_${token}_${label}`,
    createdAtSeconds: Math.floor(Date.now() / 1000),
    livemode: false,
    payloadSha256: Buffer.from(`${token}:${label}`).toString('hex').padEnd(64, '0').slice(0, 64),
  };
}

async function verifyMigrationAndPermissions(): Promise<void> {
  const state = await sql.begin('read only', async (transaction) => {
    const migrations = await transaction<{ checksum_sha256: string }[]>`
      SELECT checksum_sha256
      FROM crewcast.schema_migrations
      WHERE version = '0017' AND name = 'durable_stripe_webhook_events'
    `;
    const tables = await transaction<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'crewcast.stripe_webhook_events'::regclass
    `;
    const grants = await transaction<{ grantee: string; privilege_type: string }[]>`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'crewcast'
        AND table_name = 'stripe_webhook_events'
        AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
    `;
    return { migrations, tables, grants };
  });

  assert.equal(state.migrations.length, 1);
  assert.equal(
    state.migrations[0].checksum_sha256,
    '7e9437a09d8ae2764130b6f885d37cc78abc3f39f91f7c0393c7b80034b56c22',
  );
  assert.equal(state.tables.length, 1);
  assert.equal(state.tables[0].relrowsecurity, true);
  assert.equal(state.grants.length, 0);
}

async function verifyContentionAndCompletion(): Promise<void> {
  const receipt = event('contention');
  const claims = await Promise.all(
    Array.from({ length: 100 }, () => store.claim(receipt)),
  );
  const claimed = claims.filter((claim) => claim.outcome === 'claimed');
  assert.equal(claimed.length, 1);
  assert.equal(claims.filter((claim) => claim.outcome === 'busy').length, 99);
  const winner = claimed[0];
  assert.equal(winner.outcome, 'claimed');

  await assert.rejects(
    store.claim({ ...receipt, payloadSha256: 'f'.repeat(64) }),
    /conflicting immutable data/i,
  );

  await store.complete(receipt.eventId, winner.claimToken);
  assert.deepEqual(await store.claim(receipt), { outcome: 'completed' });
  await assert.rejects(
    store.complete(receipt.eventId, winner.claimToken),
    /lost ownership/i,
  );
}

async function verifyFailureAndRetry(): Promise<void> {
  const receipt = event('failure');
  const forced = new Error('forced staging handler failure');
  await assert.rejects(
    processDurableStripeWebhookEvent(store, receipt, async () => { throw forced; }),
    (error) => error === forced,
  );

  const failed = await sql<{ status: string; attempt_count: number }[]>`
    SELECT status, attempt_count
    FROM crewcast.stripe_webhook_events
    WHERE event_id = ${receipt.eventId}
  `;
  assert.equal(failed.length, 1);
  assert.equal(failed[0].status, 'failed');
  assert.equal(failed[0].attempt_count, 1);

  let handlerCalls = 0;
  const retried = await processDurableStripeWebhookEvent(
    store,
    receipt,
    async () => { handlerCalls += 1; },
  );
  assert.deepEqual(retried, { outcome: 'processed', attemptCount: 2 });
  assert.equal(handlerCalls, 1);

  const duplicate = await processDurableStripeWebhookEvent(
    store,
    receipt,
    async () => { handlerCalls += 1; },
  );
  assert.deepEqual(duplicate, { outcome: 'completed' });
  assert.equal(handlerCalls, 1);
}

async function verifyExpiredLeaseReclaim(): Promise<void> {
  const receipt = event('expired');
  await sql`
    INSERT INTO crewcast.stripe_webhook_events (
      event_id,
      event_type,
      object_id,
      event_created_at,
      livemode,
      payload_sha256,
      status,
      attempt_count,
      claim_token,
      claimed_at,
      lease_expires_at
    )
    VALUES (
      ${receipt.eventId},
      ${receipt.eventType},
      ${receipt.objectId},
      ${new Date(receipt.createdAtSeconds * 1000).toISOString()}::timestamptz,
      ${receipt.livemode},
      ${receipt.payloadSha256},
      'processing',
      1,
      ${randomUUID()}::uuid,
      NOW() - INTERVAL '10 minutes',
      NOW() - INTERVAL '5 minutes'
    )
  `;

  const claims = await Promise.all(
    Array.from({ length: 100 }, () => store.claim(receipt)),
  );
  const claimed = claims.filter((claim) => claim.outcome === 'claimed');
  assert.equal(claimed.length, 1);
  assert.equal(claims.filter((claim) => claim.outcome === 'busy').length, 99);
  assert.equal(claimed[0].outcome, 'claimed');
  assert.equal(claimed[0].attemptCount, 2);
  await store.complete(receipt.eventId, claimed[0].claimToken);
}

async function verifyDatabaseGuards(): Promise<void> {
  const receipt = event('immutable');
  const claim = await store.claim(receipt);
  assert.equal(claim.outcome, 'claimed');
  if (claim.outcome !== 'claimed') throw new Error('Expected a claimed receipt.');

  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_webhook_events
      SET object_id = 'in_tampered'
      WHERE event_id = ${receipt.eventId}
    `,
    /identity is immutable/i,
  );
  await store.complete(receipt.eventId, claim.claimToken);
  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_webhook_events
      SET updated_at = NOW()
      WHERE event_id = ${receipt.eventId}
    `,
    /completed.*immutable/i,
  );
}

async function verifyInvoiceResetUniqueness(): Promise<void> {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    )
    VALUES (
      ${`${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`},
      'Stripe webhook verifier',
      false,
      0,
      false,
      'free_trial'
    )
    RETURNING id
  `;
  syntheticUserId = users[0].id;
  const invoiceId = `in_codex_unique_${token}`;
  const periodStart = new Date('2026-09-01T00:00:00.000Z');

  const resets = await Promise.all(
    Array.from({ length: 20 }, () =>
      resetCreditsForNewPeriod(
        syntheticUserId!,
        'pro',
        periodStart,
        periodStart,
        { stripeInvoiceId: invoiceId },
      )),
  );
  assert.equal(resets.every(Boolean), true);

  const resetState = await sql.begin('read only', async (transaction) => {
    const audits = await transaction<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.credit_transactions
      WHERE user_id = ${syntheticUserId}
        AND reason = 'reset'
        AND reference_type = 'stripe_invoice'
        AND reference_id = ${invoiceId}
    `;
    const credits = await transaction<{
      topic_search_credits_total: number;
      email_credits_total: number;
      ai_credits_total: number;
    }[]>`
      SELECT topic_search_credits_total, email_credits_total, ai_credits_total
      FROM crewcast.user_credits
      WHERE user_id = ${syntheticUserId}
    `;
    return { audits: audits[0].count, credits };
  });
  assert.equal(resetState.audits, 3);
  assert.equal(resetState.credits.length, 1);
  assert.equal(resetState.credits[0].topic_search_credits_total, 5);
  assert.equal(resetState.credits[0].email_credits_total, 30);
  assert.equal(resetState.credits[0].ai_credits_total, 30);

  await assert.rejects(
    sql`
      INSERT INTO crewcast.credit_transactions (
        user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
      )
      VALUES (${syntheticUserId}, 'topic_search', 5, 5, 'reset', ${invoiceId}, 'stripe_invoice')
    `,
    /credit_transactions_stripe_invoice_reset_key/i,
  );
}

async function cleanup(): Promise<void> {
  if (syntheticUserId !== null) {
    await sql`DELETE FROM crewcast.users WHERE id = ${syntheticUserId}`;
  }
  if (eventIds.length > 0) {
    await sql`
      DELETE FROM crewcast.stripe_webhook_events
      WHERE event_id = ANY(${eventIds}::text[])
    `;
  }

  const residue = await sql.begin('read only', async (transaction) => {
    const events = await transaction<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.stripe_webhook_events
      WHERE event_id LIKE ${`${SYNTHETIC_EVENT_PREFIX}%`}
    `;
    const users = await transaction<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.users
      WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%`}
    `;
    return { events: events[0].count, users: users[0].count };
  });
  assert.deepEqual(residue, { events: 0, users: 0 });
}

async function main(): Promise<void> {
  try {
    await verifyMigrationAndPermissions();
    await verifyContentionAndCompletion();
    await verifyFailureAndRetry();
    await verifyExpiredLeaseReclaim();
    await verifyDatabaseGuards();
    await verifyInvoiceResetUniqueness();
    console.log('Stripe webhook staging verification passed.');
  } finally {
    await cleanup();
    await sql.end();
    await applicationSql.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
