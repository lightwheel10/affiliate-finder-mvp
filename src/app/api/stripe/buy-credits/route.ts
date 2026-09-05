import { NextRequest, NextResponse } from 'next/server';
import type postgres from 'postgres';
import { z } from 'zod';
import { stripe, getCreditPackDetails, isValidCreditPackId } from '@/lib/stripe';
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
  assertCreditCheckoutSessionIdentity,
  creditCheckoutStripeIdempotencyKey,
  type CreditCheckoutIdentity,
} from '@/lib/stripe/credit-checkout';
import {
  CreditCheckoutOperationConflictError,
  persistCreditCheckoutSession,
  prepareCreditCheckoutOperation,
  type CreditCheckoutSql,
} from '@/lib/stripe/credit-checkout-postgres';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';

export const dynamic = 'force-dynamic';

const buyCreditsSchema = z.object({
  userId: z.number().int().positive(),
  packId: z.string().min(1).max(80),
  requestId: z.string().uuid({ version: 'v4' }),
}).strict();

/**
 * Creates a one-time Stripe Checkout Session from a durable operation written
 * first. A browser retry gets the same session; it can never create an
 * untracked second payment page after a database or network failure.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();
    const parsedBody = buyCreditsSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const { userId: legacyUserId, packId, requestId } = parsedBody.data;
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;
    if (!isValidCreditPackId(packId)) {
      return NextResponse.json({ error: 'Valid credit pack is required' }, { status: 400 });
    }
    const packDetails = getCreditPackDetails(packId);
    if (!packDetails) {
      return NextResponse.json({ error: 'Credit pack not found' }, { status: 400 });
    }

    const rows = await sql<{
      stripe_customer_id: string | null;
      status: string | null;
    }[]>`
      SELECT subscriptions.stripe_customer_id, subscriptions.status
      FROM crewcast.users AS users
      LEFT JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
      WHERE users.id = ${userId}
      LIMIT 2
    `;
    if (rows.length !== 1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const subscriptionStatus = rows[0].status?.toLowerCase();
    if (subscriptionStatus !== 'active') {
      return NextResponse.json(
        {
          error: subscriptionStatus === 'trialing'
            ? 'Credit packs are for paid subscribers only. Subscribe or end your trial to purchase.'
            : 'An active paid subscription is required to buy credit packs.',
        },
        { status: 400 },
      );
    }
    const stripeCustomerId = requireServerOwnedStripeCustomerId(rows[0].stripe_customer_id);
    const identity: CreditCheckoutIdentity = {
      operationId: requestId,
      userId,
      stripeCustomerId,
      packId,
      priceId: packDetails.priceId,
      creditType: packDetails.creditType,
      creditsAmount: packDetails.credits,
    };

    const prepared = await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin((transaction) => prepareCreditCheckoutOperation(
      transaction as unknown as CreditCheckoutSql,
      identity,
    ));

    const baseUrl = request.nextUrl.origin;
    const successUrl = `${baseUrl}/settings?tab=buy_credits&credit_purchase=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/settings?tab=buy_credits&credit_purchase=cancelled`;
    const session = prepared.stripe_checkout_session_id
      ? await stripe.checkout.sessions.retrieve(
          prepared.stripe_checkout_session_id,
          { expand: ['line_items'] },
        )
      : await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{ price: packDetails.priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            invoice_creation: { enabled: true },
            metadata: {
              operation_id: requestId,
              user_id: String(userId),
              pack_id: packId,
              credit_type: packDetails.creditType,
              credits_amount: String(packDetails.credits),
            },
          },
          { idempotencyKey: creditCheckoutStripeIdempotencyKey(requestId) },
        );
    if (!session.id) {
      throw new Error('Stripe did not return a Checkout Session ID.');
    }

    // Newly created sessions already use the exact server-owned values. A
    // recovered session is reread with line items and checked before reuse.
    if (prepared.stripe_checkout_session_id) {
      assertCreditCheckoutSessionIdentity(session, identity);
    }
    if (session.status === 'expired') {
      await sql`
        UPDATE crewcast.stripe_credit_checkout_operations
        SET status = 'expired', expired_at = NOW(), updated_at = NOW()
        WHERE operation_id = ${requestId}::uuid
          AND user_id = ${userId}
          AND status = 'session_created'
      `;
      return NextResponse.json(
        { error: 'This checkout session expired. Please start again.', code: 'CHECKOUT_EXPIRED' },
        { status: 409 },
      );
    }

    await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin((transaction) => persistCreditCheckoutSession(
      transaction as unknown as CreditCheckoutSql,
      identity,
      session.id,
    ));

    if (session.payment_status === 'paid') {
      return NextResponse.json({
        url: `${baseUrl}/settings?tab=buy_credits&credit_purchase=success&session_id=${encodeURIComponent(session.id)}`,
        sessionId: session.id,
      });
    }
    if (!session.url) {
      throw new Error('Stripe did not return a usable checkout URL.');
    }
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof CreditCheckoutOperationConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'CHECKOUT_REQUEST_CONFLICT' },
        { status: 409 },
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
    console.error('[Stripe Buy Credits] Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 },
    );
  }
}
