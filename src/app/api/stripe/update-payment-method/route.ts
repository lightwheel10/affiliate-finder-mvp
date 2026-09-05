import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type postgres from 'postgres';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  requireServerOwnedStripeCustomerId,
  StripeCustomerOwnershipError,
} from '@/lib/stripe-customer-ownership';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';
import {
  readStripePaymentMethodCard,
  StripePaymentMethodUpdateError,
} from '@/lib/stripe/payment-method-update';
import {
  assertStripePaymentMethodUpdateSubscriptionIsCurrent,
} from '@/lib/stripe/payment-method-update-server';
import {
  lockStripePaymentMethodUpdateOwner,
  prepareStripePaymentMethodUpdateOperation,
  StripePaymentMethodUpdateConflictError,
  type StripePaymentMethodUpdateSql,
} from '@/lib/stripe/payment-method-update-postgres';
import { recoverStripePaymentMethodUpdate } from '@/lib/stripe/payment-method-update-recovery';

export const dynamic = 'force-dynamic';

const updatePaymentMethodSchema = z.object({
  userId: z.number().int().positive(),
  paymentMethodId: z.string().regex(/^pm_[A-Za-z0-9]+$/),
  // Rolling-client assertion only; the database remains billing authority.
  customerId: z.unknown().optional(),
}).strict();

interface SubscriptionRow {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Writes a durable operation before touching Stripe, then replays that exact
 * operation under the webhook-shared customer lock. If the process stops after
 * Stripe succeeds, a request retry or Stripe webhook completes the same row.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();
    const parsedBody = updatePaymentMethodSchema.safeParse(
      await readStripeMutationJson(request),
    );
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const {
      userId: legacyUserId,
      paymentMethodId,
      customerId,
    } = parsedBody.data;
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;

    const subscriptions = await sql<SubscriptionRow[]>`
      SELECT stripe_customer_id, stripe_subscription_id
      FROM crewcast.subscriptions
      WHERE user_id = ${userId}
      LIMIT 2
    `;
    if (subscriptions.length !== 1) {
      throw new Error('Expected exactly one application subscription record.');
    }
    const subscriptionRow = subscriptions[0];
    const stripeCustomerId = requireServerOwnedStripeCustomerId(
      subscriptionRow.stripe_customer_id,
      customerId,
    );

    // Reject another customer's payment method and non-card methods before any
    // durable intent or external Stripe mutation is created.
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    readStripePaymentMethodCard(paymentMethod, stripeCustomerId);

    const operation = await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      await lockStripePaymentMethodUpdateOwner(
        transaction as StripePaymentMethodUpdateSql,
        {
          userId,
          stripeCustomerId,
          stripeSubscriptionId: subscriptionRow.stripe_subscription_id,
        },
      );
      await assertStripePaymentMethodUpdateSubscriptionIsCurrent(stripe, {
        stripeCustomerId,
        stripeSubscriptionId: subscriptionRow.stripe_subscription_id,
      });
      return prepareStripePaymentMethodUpdateOperation(
        transaction as StripePaymentMethodUpdateSql,
        {
          operationId: randomUUID(),
          userId,
          stripeCustomerId,
          stripeSubscriptionId: subscriptionRow.stripe_subscription_id,
          stripePaymentMethodId: paymentMethodId,
        },
      );
    });

    const recovery = await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      await lockStripePaymentMethodUpdateOwner(
        transaction as StripePaymentMethodUpdateSql,
        {
          userId,
          stripeCustomerId,
          stripeSubscriptionId: operation.stripeSubscriptionId,
        },
      );
      return recoverStripePaymentMethodUpdate(
        transaction as StripePaymentMethodUpdateSql,
        stripe,
        {
          userId,
          stripeCustomerId,
          stripeSubscriptionId: operation.stripeSubscriptionId,
          operationId: operation.operationId,
        },
      );
    });
    if (recovery === 'abandoned' || recovery === 'already_abandoned') {
      throw new StripePaymentMethodUpdateError(
        'STRIPE_PAYMENT_METHOD_UPDATE_REJECTED',
        409,
        'Stripe could not use this card. Please choose another card.',
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethodId,
    });
  } catch (error) {
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof StripeCustomerOwnershipError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (
      error instanceof StripePaymentMethodUpdateError
      || error instanceof StripePaymentMethodUpdateConflictError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[UpdatePaymentMethod] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment method. Please try again.' },
      { status: 500 },
    );
  }
}
