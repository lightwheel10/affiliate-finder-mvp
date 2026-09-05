export type StripeCustomerEventOwnershipDecision =
  | 'process'
  | 'ignore_external'
  | 'retry_unreconciled'
  | 'reject_ambiguous';

/**
 * Decide whether an account-wide Stripe customer event belongs to this app.
 *
 * Stripe sends every selected account event to the endpoint, including events
 * created by the Dashboard, CLI, or another integration. Those external events
 * are successful no-ops. A customer carrying our server-owned account marker is
 * different: if its database link is temporarily missing, returning a failure
 * keeps Stripe's retry path alive until normal request recovery restores it.
 */
export function decideStripeCustomerEventOwnership(input: {
  applicationOwnerCount: number;
  applicationAccountMarker?: string | null;
}): StripeCustomerEventOwnershipDecision {
  if (!Number.isSafeInteger(input.applicationOwnerCount) || input.applicationOwnerCount < 0) {
    throw new Error('Stripe customer owner count is invalid.');
  }
  if (input.applicationOwnerCount > 1) return 'reject_ambiguous';
  if (input.applicationOwnerCount === 1) return 'process';
  if (input.applicationAccountMarker) return 'retry_unreconciled';
  return 'ignore_external';
}
