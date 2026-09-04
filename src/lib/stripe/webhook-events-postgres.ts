import 'server-only';

import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import {
  assertStripeWebhookEnvelope,
  type StripeWebhookClaim,
  type StripeWebhookEnvelope,
  type StripeWebhookEventStore,
} from '@/lib/stripe/webhook-events';

export interface StripeWebhookSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

export interface StripeWebhookDatabase extends StripeWebhookSqlExecutor {
  begin<T>(
    callback: (transaction: StripeWebhookSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

interface WebhookEventRow {
  event_type: string;
  object_id: string | null;
  event_created_at: string | Date;
  livemode: boolean;
  payload_sha256: string;
  status: 'processing' | 'completed' | 'failed';
  attempt_count: number;
  lease_is_active: boolean;
}

const CLAIM_LEASE_MINUTES = 5;

function sameInstant(value: string | Date, expectedIso: string): boolean {
  return new Date(value).getTime() === new Date(expectedIso).getTime();
}

function assertMatchingReceipt(row: WebhookEventRow, event: StripeWebhookEnvelope): void {
  const expectedCreatedAt = new Date(event.createdAtSeconds * 1000).toISOString();
  if (
    row.event_type !== event.eventType
    || row.object_id !== event.objectId
    || row.livemode !== event.livemode
    || row.payload_sha256 !== event.payloadSha256
    || !sameInstant(row.event_created_at, expectedCreatedAt)
  ) {
    throw new Error('A Stripe event ID was replayed with conflicting immutable data.');
  }
}

export function createStripeWebhookEventStore(
  database: StripeWebhookDatabase = sql as StripeWebhookDatabase,
): StripeWebhookEventStore {
  return {
    claim: async (event): Promise<StripeWebhookClaim> => {
      assertStripeWebhookEnvelope(event);
      const claimToken = randomUUID();
      const eventCreatedAt = new Date(event.createdAtSeconds * 1000).toISOString();

      return database.begin(async (transaction) => {
        const inserted = await transaction<{ attempt_count: number }>`
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
            ${event.eventId},
            ${event.eventType},
            ${event.objectId},
            ${eventCreatedAt}::timestamptz,
            ${event.livemode},
            ${event.payloadSha256},
            'processing',
            1,
            ${claimToken}::uuid,
            NOW(),
            NOW() + make_interval(mins => ${CLAIM_LEASE_MINUTES})
          )
          ON CONFLICT (event_id) DO NOTHING
          RETURNING attempt_count
        `;

        if (inserted.length === 1) {
          return { outcome: 'claimed', claimToken, attemptCount: 1 };
        }

        const rows = await transaction<WebhookEventRow>`
          SELECT
            event_type,
            object_id,
            event_created_at,
            livemode,
            payload_sha256,
            status,
            attempt_count,
            lease_expires_at > NOW() AS lease_is_active
          FROM crewcast.stripe_webhook_events
          WHERE event_id = ${event.eventId}
          FOR UPDATE
        `;
        if (rows.length !== 1) {
          throw new Error('Stripe webhook receipt disappeared while being claimed.');
        }

        const row = rows[0];
        assertMatchingReceipt(row, event);
        if (row.status === 'completed') return { outcome: 'completed' };
        if (row.status === 'processing' && row.lease_is_active) {
          return { outcome: 'busy' };
        }

        const reclaimed = await transaction<{ attempt_count: number }>`
          UPDATE crewcast.stripe_webhook_events
          SET
            status = 'processing',
            attempt_count = attempt_count + 1,
            claim_token = ${claimToken}::uuid,
            claimed_at = NOW(),
            lease_expires_at = NOW() + make_interval(mins => ${CLAIM_LEASE_MINUTES}),
            completed_at = NULL,
            last_failed_at = NULL,
            last_error_code = NULL,
            updated_at = NOW()
          WHERE event_id = ${event.eventId}
            AND (
              status = 'failed'
              OR (status = 'processing' AND lease_expires_at <= NOW())
            )
          RETURNING attempt_count
        `;
        if (reclaimed.length !== 1) {
          throw new Error('Stripe webhook receipt could not be reclaimed safely.');
        }
        return {
          outcome: 'claimed',
          claimToken,
          attemptCount: reclaimed[0].attempt_count,
        };
      });
    },

    complete: async (eventId, claimToken): Promise<void> => {
      const completed = await database<{ event_id: string }>`
        UPDATE crewcast.stripe_webhook_events
        SET
          status = 'completed',
          claim_token = NULL,
          lease_expires_at = NULL,
          completed_at = NOW(),
          last_failed_at = NULL,
          last_error_code = NULL,
          updated_at = NOW()
        WHERE event_id = ${eventId}
          AND status = 'processing'
          AND claim_token = ${claimToken}::uuid
        RETURNING event_id
      `;
      if (completed.length !== 1) {
        throw new Error('Stripe webhook completion lost ownership of its durable claim.');
      }
    },

    fail: async (eventId, claimToken, errorCode): Promise<void> => {
      const failed = await database<{ event_id: string }>`
        UPDATE crewcast.stripe_webhook_events
        SET
          status = 'failed',
          claim_token = NULL,
          lease_expires_at = NULL,
          completed_at = NULL,
          last_failed_at = NOW(),
          last_error_code = ${errorCode},
          updated_at = NOW()
        WHERE event_id = ${eventId}
          AND status = 'processing'
          AND claim_token = ${claimToken}::uuid
        RETURNING event_id
      `;
      if (failed.length !== 1) {
        throw new Error('Stripe webhook failure lost ownership of its durable claim.');
      }
    },
  };
}
