import assert from 'node:assert/strict';
import test from 'node:test';
import {
  processDurableStripeWebhookEvent,
  type StripeWebhookEnvelope,
  type StripeWebhookEventStore,
} from '../../src/lib/stripe/webhook-events';

interface FakeReceipt {
  status: 'processing' | 'completed' | 'failed';
  token: string | null;
  attempts: number;
}

function envelope(id = 'evt_test_1'): StripeWebhookEnvelope {
  return {
    eventId: id,
    eventType: 'invoice.paid',
    objectId: 'in_test_1',
    createdAtSeconds: 1_800_000_000,
    livemode: false,
    payloadSha256: 'a'.repeat(64),
  };
}

function fakeStore(): {
  store: StripeWebhookEventStore;
  receipts: Map<string, FakeReceipt>;
  failCalls: number;
} {
  const receipts = new Map<string, FakeReceipt>();
  let sequence = 0;
  let failCalls = 0;
  const store: StripeWebhookEventStore = {
    claim: async (event) => {
      const existing = receipts.get(event.eventId);
      if (existing?.status === 'completed') return { outcome: 'completed' };
      if (existing?.status === 'processing') return { outcome: 'busy' };
      sequence += 1;
      const attempts = (existing?.attempts ?? 0) + 1;
      const token = `claim-${sequence}`;
      receipts.set(event.eventId, { status: 'processing', token, attempts });
      return { outcome: 'claimed', claimToken: token, attemptCount: attempts };
    },
    complete: async (eventId, claimToken) => {
      const receipt = receipts.get(eventId);
      assert.equal(receipt?.status, 'processing');
      assert.equal(receipt?.token, claimToken);
      receipts.set(eventId, {
        status: 'completed',
        token: null,
        attempts: receipt.attempts,
      });
    },
    fail: async (eventId, claimToken) => {
      failCalls += 1;
      const receipt = receipts.get(eventId);
      assert.equal(receipt?.status, 'processing');
      assert.equal(receipt?.token, claimToken);
      receipts.set(eventId, {
        status: 'failed',
        token: null,
        attempts: receipt.attempts,
      });
    },
  };
  return {
    store,
    receipts,
    get failCalls() { return failCalls; },
  };
}

test('completes the durable receipt only after handler success', async () => {
  const fixture = fakeStore();
  let statusDuringHandler: string | undefined;
  const result = await processDurableStripeWebhookEvent(
    fixture.store,
    envelope(),
    async () => {
      statusDuringHandler = fixture.receipts.get('evt_test_1')?.status;
    },
  );

  assert.equal(statusDuringHandler, 'processing');
  assert.deepEqual(result, { outcome: 'processed', attemptCount: 1 });
  assert.equal(fixture.receipts.get('evt_test_1')?.status, 'completed');
});

test('a completed duplicate does not invoke the handler again', async () => {
  const fixture = fakeStore();
  let calls = 0;
  await processDurableStripeWebhookEvent(fixture.store, envelope(), async () => { calls += 1; });
  const duplicate = await processDurableStripeWebhookEvent(
    fixture.store,
    envelope(),
    async () => { calls += 1; },
  );

  assert.equal(calls, 1);
  assert.deepEqual(duplicate, { outcome: 'completed' });
});

test('a failed handler remains retryable and completes on the next delivery', async () => {
  const fixture = fakeStore();
  const failure = new Error('forced handler failure');
  await assert.rejects(
    processDurableStripeWebhookEvent(fixture.store, envelope(), async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(fixture.receipts.get('evt_test_1')?.status, 'failed');
  assert.equal(fixture.failCalls, 1);

  const retried = await processDurableStripeWebhookEvent(
    fixture.store,
    envelope(),
    async () => undefined,
  );
  assert.deepEqual(retried, { outcome: 'processed', attemptCount: 2 });
});

test('an active claim returns busy and is not acknowledged as completed', async () => {
  const fixture = fakeStore();
  fixture.receipts.set('evt_test_1', {
    status: 'processing',
    token: 'other-worker',
    attempts: 1,
  });
  let handled = false;
  const result = await processDurableStripeWebhookEvent(
    fixture.store,
    envelope(),
    async () => { handled = true; },
  );

  assert.deepEqual(result, { outcome: 'busy' });
  assert.equal(handled, false);
  assert.equal(fixture.receipts.get('evt_test_1')?.status, 'processing');
});

test('invalid receipt identity fails before the database claim', async () => {
  const fixture = fakeStore();
  await assert.rejects(
    processDurableStripeWebhookEvent(
      fixture.store,
      { ...envelope(), payloadSha256: 'not-a-digest' },
      async () => undefined,
    ),
    /payload digest is invalid/i,
  );
  assert.equal(fixture.receipts.size, 0);
});

test('a failure while recording failure preserves both errors', async () => {
  const handlerError = new Error('handler failed');
  const recordingError = new Error('database unavailable');
  const store: StripeWebhookEventStore = {
    claim: async () => ({ outcome: 'claimed', claimToken: 'token', attemptCount: 1 }),
    complete: async () => undefined,
    fail: async () => { throw recordingError; },
  };

  await assert.rejects(
    processDurableStripeWebhookEvent(store, envelope(), async () => { throw handlerError; }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [handlerError, recordingError]);
      return true;
    },
  );
});
