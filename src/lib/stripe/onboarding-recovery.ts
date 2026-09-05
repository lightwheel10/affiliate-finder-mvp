import type Stripe from 'stripe';

export type OnboardingRecoveryAction =
  | 'collect_card'
  | 'finish_onboarding'
  | 'blocked';

/**
 * Decide what the payment step may safely show after a reload.
 *
 * Active/trialing subscriptions must never fall back to another card form.
 * An incomplete first payment may collect a replacement card. Other live but
 * unusable states need billing intervention rather than another subscription.
 */
export function onboardingRecoveryAction(
  status: Stripe.Subscription.Status | null,
): OnboardingRecoveryAction {
  if (status === null || status === 'incomplete') return 'collect_card';
  if (status === 'active' || status === 'trialing') return 'finish_onboarding';
  return 'blocked';
}
