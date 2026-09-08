import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStripeWebhookEventStore,
  type StripeWebhookDatabase,
} from '../../src/lib/stripe/webhook-events-postgres';
import type { StripeWebhookEnvelope } from '../../src/lib/stripe/webhook-events';

interface ReceiptRow {
  event_type: string;
  object_id: string | null;
  event_created_at: string;
  livemode: boolean;
  payload_sha256: string;
  status: 'processing' | 'completed';
  attempt_count: number;
  lease_is_active: boolean;
  claim_token: string;
}

function envelope(overrides: Partial<StripeWebhookEnvelope> = {}): StripeWebhookEnvelope {
  return {
    eventId: 'evt_retry',
    eventType: 'invoice.paid',
    objectId: 'in_retry',
    createdAtSeconds: 1_800_000_000,
    livemode: false,
    payloadSha256: 'a'.repeat(64),
    ...overrides,
  };
}

function databaseFixture() {
  let row: ReceiptRow | null = null;

  const execute = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const statement = strings.join('?').replace(/\s+/g, ' ').trim();

    if (statement.startsWith('INSERT INTO crewcast.stripe_webhook_events')) {
      if (row) return [];
      row = {
        event_type: String(values[1]),
        object_id: values[2] === null ? null : String(values[2]),
        event_created_at: String(values[3]),
        livemode: Boolean(values[4]),
        payload_sha256: String(values[5]),
        status: 'processing',
        attempt_count: 1,
        lease_is_active: true,
        claim_token: String(values[6]),
      };
      return [{ attempt_count: 1 }];
    }
    if (statement.startsWith('SELECT event_type')) return row ? [row] : [];
    if (statement.includes("SET status = 'completed'")) {
      if (!row || row.claim_token !== values[1]) return [];
      row.status = 'completed';
      row.lease_is_active = false;
      return [{ event_id: values[0] }];
    }
    throw new Error(`Unexpected SQL in webhook fixture: ${statement}`);
  };

  const database = Object.assign(execute, {
    begin: async <T>(callback: (transaction: typeof execute) => Promise<T>) => callback(execute),
  }) as StripeWebhookDatabase;

  return { database };
}

test('signed retries may change raw delivery bytes without changing event identity', async () => {
  const fixture = databaseFixture();
  const store = createStripeWebhookEventStore(fixture.database);
  const first = await store.claim(envelope());
  assert.equal(first.outcome, 'claimed');
  if (first.outcome !== 'claimed') throw new Error('Expected the first delivery to be claimed.');

  assert.deepEqual(
    await store.claim(envelope({ payloadSha256: 'b'.repeat(64) })),
    { outcome: 'busy' },
  );
  await store.complete('evt_retry', first.claimToken);
  assert.deepEqual(
    await store.claim(envelope({ payloadSha256: 'c'.repeat(64) })),
    { outcome: 'completed' },
  );
});

test('a reused event ID still rejects conflicting stable identity', async () => {
  const fixture = databaseFixture();
  const store = createStripeWebhookEventStore(fixture.database);
  await store.claim(envelope());

  await assert.rejects(
    store.claim(envelope({ eventType: 'invoice.payment_failed' })),
    /conflicting immutable data/i,
  );
});
