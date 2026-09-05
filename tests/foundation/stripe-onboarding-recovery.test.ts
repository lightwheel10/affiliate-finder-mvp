import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import { onboardingRecoveryAction } from '../../src/lib/stripe/onboarding-recovery';

test('active and trialing subscriptions finish onboarding without another card', () => {
  assert.equal(onboardingRecoveryAction('active'), 'finish_onboarding');
  assert.equal(onboardingRecoveryAction('trialing'), 'finish_onboarding');
});

test('a missing or incomplete first subscription may collect a card', () => {
  assert.equal(onboardingRecoveryAction(null), 'collect_card');
  assert.equal(onboardingRecoveryAction('incomplete'), 'collect_card');
});

test('unusable live subscription states never create another subscription', () => {
  const blocked: Stripe.Subscription.Status[] = [
    'canceled',
    'incomplete_expired',
    'past_due',
    'paused',
    'unpaid',
  ];
  for (const status of blocked) {
    assert.equal(onboardingRecoveryAction(status), 'blocked');
  }
});
