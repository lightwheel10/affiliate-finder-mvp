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
import { extractStripeId } from '@/lib/stripe/subscription-state';
import { paymentMethodMutationIdempotencyKey } from '@/lib/stripe/subscription-creation';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';

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
 * Updates the customer's and subscription's default card. One database lock
 * serializes competing browser requests, and every Stripe POST is idempotent,
 * so a timeout/retry cannot leave the displayed card pointing at a different
 * default than Stripe.
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

    await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-payment-method:${userId}`}, 0)
        )
      `;

      const users = await transaction<{ id: number }[]>`
        SELECT id
        FROM crewcast.users
        WHERE id = ${userId}
        LIMIT 2
        FOR UPDATE
      `;
      if (users.length !== 1) {
        throw new Error('Application account not found.');
      }
      const subscriptions = await transaction<SubscriptionRow[]>`
        SELECT stripe_customer_id, stripe_subscription_id
        FROM crewcast.subscriptions
        WHERE user_id = ${userId}
        LIMIT 2
        FOR UPDATE
      `;
      if (subscriptions.length !== 1) {
        throw new Error('Expected exactly one application subscription record.');
      }

      const subscriptionRow = subscriptions[0];
      const stripeCustomerId = requireServerOwnedStripeCustomerId(
        subscriptionRow.stripe_customer_id,
        customerId,
      );
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      const attachedCustomerId = extractStripeId(paymentMethod.customer);
      if (attachedCustomerId && attachedCustomerId !== stripeCustomerId) {
        throw new StripeCustomerOwnershipError(
          'STRIPE_CUSTOMER_MISMATCH',
          403,
          'This payment method belongs to a different Stripe customer.',
        );
      }
      if (!attachedCustomerId) {
        await stripe.paymentMethods.attach(
          paymentMethodId,
          { customer: stripeCustomerId },
          {
            idempotencyKey: paymentMethodMutationIdempotencyKey(
              'attach',
              stripeCustomerId,
              paymentMethodId,
            ),
          },
        );
      }

      await stripe.customers.update(
        stripeCustomerId,
        { invoice_settings: { default_payment_method: paymentMethodId } },
        {
          idempotencyKey: paymentMethodMutationIdempotencyKey(
            'make-default',
            stripeCustomerId,
            paymentMethodId,
          ),
        },
      );

      if (subscriptionRow.stripe_subscription_id) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscriptionRow.stripe_subscription_id,
        );
        if (extractStripeId(stripeSubscription.customer) !== stripeCustomerId) {
          throw new StripeCustomerOwnershipError(
            'STRIPE_CUSTOMER_MISMATCH',
            403,
            'The stored Stripe subscription belongs to a different customer.',
          );
        }
        await stripe.subscriptions.update(
          stripeSubscription.id,
          { default_payment_method: paymentMethodId },
          {
            idempotencyKey: paymentMethodMutationIdempotencyKey(
              'make-subscription-default',
              stripeCustomerId,
              paymentMethodId,
            ),
          },
        );
      }

      if (!paymentMethod.card) {
        throw new Error('Stripe payment method is not a card.');
      }
      const updated = await transaction<{ user_id: number }[]>`
        UPDATE crewcast.subscriptions
        SET
          stripe_payment_method_id = ${paymentMethodId},
          card_last4 = ${paymentMethod.card.last4},
          card_brand = ${paymentMethod.card.brand},
          card_exp_month = ${paymentMethod.card.exp_month},
          card_exp_year = ${paymentMethod.card.exp_year},
          updated_at = NOW()
        WHERE user_id = ${userId}
          AND stripe_customer_id = ${stripeCustomerId}
        RETURNING user_id
      `;
      if (updated.length !== 1) {
        throw new Error('Payment method did not update exactly one application subscription.');
      }
      const updatedUsers = await transaction<{ id: number }[]>`
        UPDATE crewcast.users
        SET
          billing_last4 = ${paymentMethod.card.last4},
          billing_brand = ${paymentMethod.card.brand},
          billing_expiry = ${`${String(paymentMethod.card.exp_month).padStart(2, '0')}/${String(paymentMethod.card.exp_year).slice(-2)}`},
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id
      `;
      if (updatedUsers.length !== 1) {
        throw new Error('Payment method did not update exactly one application account.');
      }
    });

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
