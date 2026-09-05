import 'server-only';

import type postgres from 'postgres';
import type Stripe from 'stripe';
import { addTopupCredits } from '@/lib/credits';
import { sql } from '@/lib/db';
import { getCreditPackDetails, stripe } from '@/lib/stripe';
import { requireServerOwnedStripeCustomerId } from '@/lib/stripe-customer-ownership';
import {
  assertCreditCheckoutSessionIdentity,
  assertLegacyCreditCheckoutSessionIdentity,
  isCreditCheckoutOperationId,
  isStripeCheckoutSessionId,
  type CreditCheckoutIdentity,
  type LegacyCreditCheckoutIdentity,
} from './credit-checkout';
import {
  persistCreditCheckoutSession,
  type CreditCheckoutOperationRow,
  type CreditCheckoutSql,
} from './credit-checkout-postgres';

export class CreditCheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditCheckoutValidationError';
  }
}

export interface CreditCheckoutFulfillmentResult {
  status: 'awaiting_payment' | 'applied' | 'already_applied';
  session: Stripe.Checkout.Session;
  identity?: CreditCheckoutIdentity | LegacyCreditCheckoutIdentity;
}

function validationError(error: unknown): CreditCheckoutValidationError {
  return new CreditCheckoutValidationError(
    error instanceof Error ? error.message : 'Stripe credit checkout validation failed.',
  );
}

function parseLegacyIdentityMetadata(
  session: Stripe.Checkout.Session,
  stripeCustomerId: string,
): LegacyCreditCheckoutIdentity {
  const metadata = session.metadata;
  const userId = Number(metadata?.user_id);
  const packId = metadata?.pack_id;
  if (
    !Number.isSafeInteger(userId)
    || userId <= 0
    || typeof packId !== 'string'
  ) {
    throw new CreditCheckoutValidationError('Stripe credit checkout metadata is invalid.');
  }
  const pack = getCreditPackDetails(packId);
  if (!pack) {
    throw new CreditCheckoutValidationError('Stripe credit checkout pack is not configured.');
  }
  return {
    userId,
    stripeCustomerId,
    packId,
    priceId: pack.priceId,
    creditType: pack.creditType,
    creditsAmount: pack.credits,
  };
}

async function loadModernIdentity(operationId: string): Promise<CreditCheckoutIdentity> {
  const rows = await sql<CreditCheckoutOperationRow[]>`
    SELECT
      operation_id::text,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      pack_id,
      stripe_price_id,
      credit_type,
      credits_amount,
      status,
      stripe_checkout_session_id
    FROM crewcast.stripe_credit_checkout_operations
    WHERE operation_id = ${operationId}::uuid
    LIMIT 2
  `;
  if (rows.length !== 1) {
    throw new CreditCheckoutValidationError('Stripe credit checkout operation was not found.');
  }
  return {
    operationId: rows[0].operation_id,
    userId: rows[0].user_id,
    stripeCustomerId: rows[0].stripe_customer_id,
    packId: rows[0].pack_id,
    priceId: rows[0].stripe_price_id,
    creditType: rows[0].credit_type,
    creditsAmount: rows[0].credits_amount,
  };
}

async function loadLegacyCustomerId(userId: number): Promise<string> {
  const rows = await sql<{ stripe_customer_id: string | null }[]>`
    SELECT stripe_customer_id
    FROM crewcast.subscriptions
    WHERE user_id = ${userId}
    LIMIT 2
  `;
  if (rows.length !== 1) {
    throw new CreditCheckoutValidationError('Credit checkout account subscription was not found.');
  }
  try {
    return requireServerOwnedStripeCustomerId(rows[0].stripe_customer_id);
  } catch (error) {
    throw validationError(error);
  }
}

/**
 * Retrieves Stripe's current Checkout Session and validates every server-owned
 * identity field before credits are granted. Both the webhook and the signed-in
 * return-page fallback call this exact function, so they cannot drift apart.
 */
export async function fulfillPaidCreditCheckoutSession(
  checkoutSessionId: string,
  expectedUserId?: number,
): Promise<CreditCheckoutFulfillmentResult> {
  if (!isStripeCheckoutSessionId(checkoutSessionId)) {
    throw new CreditCheckoutValidationError('Stripe Checkout Session ID is invalid.');
  }
  if (
    expectedUserId !== undefined
    && (!Number.isSafeInteger(expectedUserId) || expectedUserId <= 0)
  ) {
    throw new CreditCheckoutValidationError('Expected account ID is invalid.');
  }

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ['line_items'],
  });
  const operationId = session.metadata?.operation_id;
  let identity: CreditCheckoutIdentity | LegacyCreditCheckoutIdentity;
  if (operationId !== undefined) {
    if (!isCreditCheckoutOperationId(operationId)) {
      throw new CreditCheckoutValidationError('Stripe credit checkout operation metadata is invalid.');
    }
    const modernIdentity = await loadModernIdentity(operationId);
    identity = modernIdentity;
    try {
      assertCreditCheckoutSessionIdentity(session, modernIdentity);
    } catch (error) {
      throw validationError(error);
    }
  } else {
    const metadataUserId = Number(session.metadata?.user_id);
    if (!Number.isSafeInteger(metadataUserId) || metadataUserId <= 0) {
      throw new CreditCheckoutValidationError('Stripe credit checkout account metadata is invalid.');
    }
    if (expectedUserId !== undefined && metadataUserId !== expectedUserId) {
      throw new CreditCheckoutValidationError('Stripe credit checkout belongs to a different account.');
    }
    const stripeCustomerId = await loadLegacyCustomerId(metadataUserId);
    identity = parseLegacyIdentityMetadata(session, stripeCustomerId);
    try {
      assertLegacyCreditCheckoutSessionIdentity(session, identity);
    } catch (error) {
      throw validationError(error);
    }
  }

  if (expectedUserId !== undefined && identity.userId !== expectedUserId) {
    throw new CreditCheckoutValidationError('Stripe credit checkout belongs to a different account.');
  }
  if (session.payment_status !== 'paid') {
    return { status: 'awaiting_payment', session, identity };
  }
  const amountPaid = session.amount_total;
  const currency = session.currency;
  if (typeof amountPaid !== 'number' || !Number.isSafeInteger(amountPaid) || amountPaid <= 0 || !currency) {
    throw new CreditCheckoutValidationError('Stripe credit checkout payment total is invalid.');
  }

  await (sql as unknown as {
    begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
  }).begin((transaction) => persistCreditCheckoutSession(
    transaction as unknown as CreditCheckoutSql,
    identity,
    session.id,
    { amountPaid, currency },
  ));

  const grantStatus = await addTopupCredits(
    identity.userId,
    identity.creditType,
    identity.creditsAmount,
    session.id,
    'operationId' in identity ? identity.operationId : null,
  );
  if (grantStatus === 'failed') {
    throw new Error(`Credit grant failed for Stripe Checkout Session ${session.id}.`);
  }
  return { status: grantStatus, session, identity };
}
