export interface StripeWebhookEnvelope {
  eventId: string;
  eventType: string;
  objectId: string | null;
  createdAtSeconds: number;
  livemode: boolean;
  payloadSha256: string;
}

export interface ClaimedStripeWebhookEvent {
  outcome: 'claimed';
  claimToken: string;
  attemptCount: number;
}

export type StripeWebhookClaim =
  | ClaimedStripeWebhookEvent
  | { outcome: 'completed' }
  | { outcome: 'busy' };

export interface StripeWebhookEventStore {
  claim(event: StripeWebhookEnvelope): Promise<StripeWebhookClaim>;
  complete(eventId: string, claimToken: string): Promise<void>;
  fail(eventId: string, claimToken: string, errorCode: 'handler_failed'): Promise<void>;
}

export type StripeWebhookProcessingResult =
  | { outcome: 'processed'; attemptCount: number }
  | { outcome: 'completed' }
  | { outcome: 'busy' };

function assertBoundedStripeIdentifier(value: string, label: string): void {
  if (
    value.length < 1
    || value.length > 255
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

export function assertStripeWebhookEnvelope(event: StripeWebhookEnvelope): void {
  assertBoundedStripeIdentifier(event.eventId, 'Stripe event ID');
  assertBoundedStripeIdentifier(event.eventType, 'Stripe event type');
  if (event.objectId !== null) {
    assertBoundedStripeIdentifier(event.objectId, 'Stripe object ID');
  }
  if (!Number.isSafeInteger(event.createdAtSeconds) || event.createdAtSeconds <= 0) {
    throw new Error('Stripe event creation time is invalid.');
  }
  if (!/^[0-9a-f]{64}$/.test(event.payloadSha256)) {
    throw new Error('Stripe payload digest is invalid.');
  }
}

/**
 * Runs one already signature-verified Stripe event through a durable claim.
 *
 * The claim is completed only after every required handler operation succeeds.
 * A handler failure records a retryable state and is rethrown so Stripe receives
 * a non-2xx response. A currently active claim is also returned as busy rather
 * than acknowledged, so a crashed worker cannot silently lose the event.
 */
export async function processDurableStripeWebhookEvent(
  store: StripeWebhookEventStore,
  event: StripeWebhookEnvelope,
  handle: () => Promise<void>,
): Promise<StripeWebhookProcessingResult> {
  assertStripeWebhookEnvelope(event);
  const claim = await store.claim(event);

  if (claim.outcome !== 'claimed') return claim;

  try {
    await handle();
    await store.complete(event.eventId, claim.claimToken);
    return { outcome: 'processed', attemptCount: claim.attemptCount };
  } catch (handlerError) {
    try {
      await store.fail(event.eventId, claim.claimToken, 'handler_failed');
    } catch (recordingError) {
      throw new AggregateError(
        [handlerError, recordingError],
        'Stripe webhook handling failed and its retry state could not be recorded.',
      );
    }
    throw handlerError;
  }
}
