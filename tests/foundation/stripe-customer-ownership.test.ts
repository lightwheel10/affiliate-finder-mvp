import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requireServerOwnedStripeCustomerId,
  StripeCustomerOwnershipError,
} from '../../src/lib/stripe-customer-ownership';

const STORED_CUSTOMER_ID = 'cus_ServerOwned123';

test('billing uses the database-owned Stripe customer when the browser sends nothing', () => {
  assert.equal(
    requireServerOwnedStripeCustomerId(STORED_CUSTOMER_ID),
    STORED_CUSTOMER_ID,
  );
});

test('a matching legacy browser customer ID remains rolling-deployment compatible', () => {
  assert.equal(
    requireServerOwnedStripeCustomerId(STORED_CUSTOMER_ID, STORED_CUSTOMER_ID),
    STORED_CUSTOMER_ID,
  );
});

test('a browser customer ID can never replace the database-owned customer', () => {
  const tamperedAssertions: unknown[] = [
    'cus_Attacker999',
    '',
    null,
    123,
    { toString: () => STORED_CUSTOMER_ID },
    ...Array.from({ length: 100 }, (_, index) => `cus_Tampered${index}`),
  ];

  for (const assertion of tamperedAssertions) {
    assert.throws(
      () => requireServerOwnedStripeCustomerId(STORED_CUSTOMER_ID, assertion),
      (error: unknown) => error instanceof StripeCustomerOwnershipError
        && error.code === 'STRIPE_CUSTOMER_MISMATCH'
        && error.status === 403,
    );
  }
});

test('a browser value cannot provide a missing or malformed server customer', () => {
  for (const storedValue of [undefined, null, '', 'cus_', 'customer_123', ' cus_ServerOwned123']) {
    assert.throws(
      () => requireServerOwnedStripeCustomerId(storedValue, STORED_CUSTOMER_ID),
      (error: unknown) => error instanceof StripeCustomerOwnershipError
        && error.code === 'STRIPE_CUSTOMER_MISSING'
        && error.status === 400,
    );
  }
});
