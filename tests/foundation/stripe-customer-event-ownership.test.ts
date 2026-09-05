import assert from 'node:assert/strict';
import test from 'node:test';
import { decideStripeCustomerEventOwnership } from '../../src/lib/stripe/customer-event-ownership';

test('processes a Stripe customer linked to exactly one application account', () => {
  assert.equal(decideStripeCustomerEventOwnership({
    applicationOwnerCount: 1,
  }), 'process');
});

test('ignores an unowned external Stripe customer without the application marker', () => {
  assert.equal(decideStripeCustomerEventOwnership({
    applicationOwnerCount: 0,
    applicationAccountMarker: null,
  }), 'ignore_external');
});

test('keeps retrying an application-marked customer whose database link is missing', () => {
  assert.equal(decideStripeCustomerEventOwnership({
    applicationOwnerCount: 0,
    applicationAccountMarker: '535',
  }), 'retry_unreconciled');
});

test('rejects a Stripe customer linked to multiple application accounts', () => {
  assert.equal(decideStripeCustomerEventOwnership({
    applicationOwnerCount: 2,
  }), 'reject_ambiguous');
});

test('rejects malformed owner counts', () => {
  assert.throws(() => decideStripeCustomerEventOwnership({
    applicationOwnerCount: -1,
  }), /owner count/i);
  assert.throws(() => decideStripeCustomerEventOwnership({
    applicationOwnerCount: 1.5,
  }), /owner count/i);
});
