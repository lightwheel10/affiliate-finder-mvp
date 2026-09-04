const STRIPE_CUSTOMER_ID_PATTERN = /^cus_[A-Za-z0-9]+$/;

export type StripeCustomerOwnershipErrorCode =
  | 'STRIPE_CUSTOMER_MISSING'
  | 'STRIPE_CUSTOMER_MISMATCH';

export class StripeCustomerOwnershipError extends Error {
  constructor(
    public readonly code: StripeCustomerOwnershipErrorCode,
    public readonly status: 400 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'StripeCustomerOwnershipError';
  }
}

/**
 * Resolve the Stripe customer from server-owned subscription state only.
 *
 * Older browser bundles may still echo the customer ID returned by the setup
 * endpoint. That value is accepted only as a consistency assertion during a
 * rolling deployment: it can agree with the database value or be omitted, but
 * it can never select or replace the customer used for a Stripe operation.
 */
export function requireServerOwnedStripeCustomerId(
  storedCustomerId: unknown,
  legacyClientAssertion?: unknown,
): string {
  if (
    typeof storedCustomerId !== 'string'
    || !STRIPE_CUSTOMER_ID_PATTERN.test(storedCustomerId)
  ) {
    throw new StripeCustomerOwnershipError(
      'STRIPE_CUSTOMER_MISSING',
      400,
      'No Stripe customer found. Please complete card setup first.',
    );
  }

  if (
    legacyClientAssertion !== undefined
    && legacyClientAssertion !== storedCustomerId
  ) {
    throw new StripeCustomerOwnershipError(
      'STRIPE_CUSTOMER_MISMATCH',
      403,
      'Not authorized to use this Stripe customer.',
    );
  }

  return storedCustomerId;
}
