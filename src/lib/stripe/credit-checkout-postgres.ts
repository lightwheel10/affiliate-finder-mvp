import {
  creditCheckoutRequestFingerprint,
  isStripeCheckoutSessionId,
  type CreditCheckoutIdentity,
  type LegacyCreditCheckoutIdentity,
} from './credit-checkout';

export interface CreditCheckoutOperationRow {
  [key: string]: unknown;
  operation_id: string;
  user_id: number;
  request_fingerprint: string;
  stripe_customer_id: string;
  pack_id: string;
  stripe_price_id: string;
  credit_type: CreditCheckoutIdentity['creditType'];
  credits_amount: number;
  status: 'prepared' | 'session_created' | 'completed' | 'expired';
  stripe_checkout_session_id: string | null;
}

interface CreditPurchaseRow {
  [key: string]: unknown;
  user_id: number;
  credit_type: string;
  credits_amount: number;
  amount_paid: number;
  currency: string;
  status: string | null;
}

export interface CreditCheckoutSql {
  <T extends readonly Record<string, unknown>[] = Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

export class CreditCheckoutOperationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditCheckoutOperationConflictError';
  }
}

function matchesIdentity(
  row: CreditCheckoutOperationRow,
  input: CreditCheckoutIdentity,
  fingerprint: string,
): boolean {
  return row.user_id === input.userId
    && row.request_fingerprint === fingerprint
    && row.stripe_customer_id === input.stripeCustomerId
    && row.pack_id === input.packId
    && row.stripe_price_id === input.priceId
    && row.credit_type === input.creditType
    && row.credits_amount === input.creditsAmount;
}

export async function prepareCreditCheckoutOperation(
  transaction: CreditCheckoutSql,
  input: CreditCheckoutIdentity,
): Promise<CreditCheckoutOperationRow> {
  const fingerprint = creditCheckoutRequestFingerprint(input);
  await transaction`
    INSERT INTO crewcast.stripe_credit_checkout_operations (
      operation_id,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      pack_id,
      stripe_price_id,
      credit_type,
      credits_amount
    ) VALUES (
      ${input.operationId}::uuid,
      ${input.userId},
      ${fingerprint},
      ${input.stripeCustomerId},
      ${input.packId},
      ${input.priceId},
      ${input.creditType},
      ${input.creditsAmount}
    )
    ON CONFLICT (operation_id) DO NOTHING
  `;
  const rows = await transaction<CreditCheckoutOperationRow[]>`
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
    WHERE operation_id = ${input.operationId}::uuid
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length !== 1 || !matchesIdentity(rows[0], input, fingerprint)) {
    throw new CreditCheckoutOperationConflictError(
      'Credit checkout request ID was already used for different purchase details.',
    );
  }
  return rows[0];
}

export async function attachCreditCheckoutSession(
  transaction: CreditCheckoutSql,
  input: CreditCheckoutIdentity,
  stripeCheckoutSessionId: string,
): Promise<CreditCheckoutOperationRow> {
  if (!isStripeCheckoutSessionId(stripeCheckoutSessionId)) {
    throw new Error('Stripe checkout session ID is invalid.');
  }
  const prepared = await prepareCreditCheckoutOperation(transaction, input);
  if (prepared.stripe_checkout_session_id) {
    if (prepared.stripe_checkout_session_id !== stripeCheckoutSessionId) {
      throw new CreditCheckoutOperationConflictError(
        'Credit checkout operation is already attached to a different Stripe session.',
      );
    }
    return prepared;
  }
  const rows = await transaction<CreditCheckoutOperationRow[]>`
    UPDATE crewcast.stripe_credit_checkout_operations
    SET
      stripe_checkout_session_id = ${stripeCheckoutSessionId},
      status = 'session_created',
      updated_at = NOW()
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status = 'prepared'
      AND stripe_checkout_session_id IS NULL
    RETURNING
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
  `;
  if (rows.length !== 1) {
    throw new Error('Credit checkout session was not attached exactly once.');
  }
  return rows[0];
}

/**
 * Stores the Stripe session and its legacy purchase row as one database unit.
 * The optional operation identity lets a webhook recover the exact row even if
 * the request that created the Stripe Session crashed before its final commit.
 */
export async function persistCreditCheckoutSession(
  transaction: CreditCheckoutSql,
  identity: CreditCheckoutIdentity | LegacyCreditCheckoutIdentity,
  stripeCheckoutSessionId: string,
  payment?: { amountPaid: number; currency: string },
): Promise<void> {
  if ('operationId' in identity) {
    await attachCreditCheckoutSession(transaction, identity, stripeCheckoutSessionId);
  }
  if (
    !Number.isSafeInteger(payment?.amountPaid ?? 0)
    || (payment?.amountPaid ?? 0) < 0
    || !/^[a-z]{3}$/i.test(payment?.currency ?? 'eur')
  ) {
    throw new Error('Credit checkout payment details are invalid.');
  }
  const amountPaid = payment?.amountPaid ?? 0;
  const currency = (payment?.currency ?? 'eur').toLowerCase();
  await transaction`
    INSERT INTO crewcast.credit_purchases (
      user_id,
      stripe_checkout_session_id,
      credit_type,
      credits_amount,
      amount_paid,
      currency,
      status
    ) VALUES (
      ${identity.userId},
      ${stripeCheckoutSessionId},
      ${identity.creditType},
      ${identity.creditsAmount},
      ${amountPaid},
      ${currency},
      'pending'
    )
    ON CONFLICT (stripe_checkout_session_id) DO NOTHING
  `;
  if (payment) {
    await transaction`
      UPDATE crewcast.credit_purchases
      SET amount_paid = ${amountPaid}, currency = ${currency}
      WHERE stripe_checkout_session_id = ${stripeCheckoutSessionId}
        AND user_id = ${identity.userId}
        AND credit_type = ${identity.creditType}
        AND credits_amount = ${identity.creditsAmount}
        AND status IN ('pending', 'completed')
    `;
  }
  const purchases = await transaction<CreditPurchaseRow[]>`
    SELECT user_id, credit_type, credits_amount, amount_paid, currency, status
    FROM crewcast.credit_purchases
    WHERE stripe_checkout_session_id = ${stripeCheckoutSessionId}
    LIMIT 2
    FOR UPDATE
  `;
  if (
    purchases.length !== 1
    || purchases[0].user_id !== identity.userId
    || purchases[0].credit_type !== identity.creditType
    || purchases[0].credits_amount !== identity.creditsAmount
    || !['pending', 'completed'].includes(purchases[0].status ?? '')
    || (payment && purchases[0].amount_paid !== amountPaid)
    || (payment && purchases[0].currency.toLowerCase() !== currency)
  ) {
    throw new Error('Credit purchase row does not match its Stripe checkout operation.');
  }
}
