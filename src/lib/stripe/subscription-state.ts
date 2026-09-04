export type SupportedSubscriptionPlan = 'pro' | 'business' | 'enterprise';
export type SupportedBillingInterval = 'monthly' | 'annual';

export interface SubscriptionPriceConfiguration {
  proMonthly?: string;
  proAnnual?: string;
  businessMonthly?: string;
  businessAnnual?: string;
}

interface StripeReference {
  id?: unknown;
}

interface StripePriceLike {
  id?: unknown;
  recurring?: { interval?: unknown } | null;
}

export interface StripeSubscriptionLike {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: StripePriceLike | null;
      current_period_start?: unknown;
      current_period_end?: unknown;
    }>;
  } | null;
  current_period_start?: unknown;
  current_period_end?: unknown;
  trial_end?: unknown;
  cancel_at_period_end?: unknown;
  default_payment_method?: unknown;
  schedule?: unknown;
}

export interface StripeSubscriptionSnapshot {
  subscriptionId: string;
  customerId: string;
  status: string;
  plan: SupportedSubscriptionPlan | null;
  billingInterval: SupportedBillingInterval | null;
  currentPeriodStartSeconds: number | null;
  currentPeriodEndSeconds: number | null;
  trialEndSeconds: number | null;
  cancelAtPeriodEnd: boolean;
  scheduleId: string | null;
}

export function extractStripeId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object') {
    const id = (value as StripeReference).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

function readPositiveTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function readPlan(value: unknown): SupportedSubscriptionPlan | null {
  return value === 'pro' || value === 'business' || value === 'enterprise'
    ? value
    : null;
}

function readBillingInterval(value: unknown): SupportedBillingInterval | null {
  if (value === 'monthly' || value === 'month') return 'monthly';
  if (value === 'annual' || value === 'year') return 'annual';
  return null;
}

function planFromPriceId(
  priceId: string | null,
  prices: SubscriptionPriceConfiguration,
): SupportedSubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === prices.proMonthly || priceId === prices.proAnnual) return 'pro';
  if (priceId === prices.businessMonthly || priceId === prices.businessAnnual) return 'business';
  return null;
}

export function snapshotStripeSubscription(
  subscription: StripeSubscriptionLike,
  prices: SubscriptionPriceConfiguration,
): StripeSubscriptionSnapshot {
  const subscriptionId = extractStripeId(subscription.id);
  const customerId = extractStripeId(subscription.customer);
  if (!subscriptionId) throw new Error('Stripe subscription ID is missing.');
  if (!customerId) throw new Error(`Stripe subscription ${subscriptionId} has no customer ID.`);
  if (typeof subscription.status !== 'string' || subscription.status.length === 0) {
    throw new Error(`Stripe subscription ${subscriptionId} has no status.`);
  }

  const firstPrice = subscription.items?.data?.[0]?.price ?? null;
  const priceId = extractStripeId(firstPrice);
  // A configured Stripe price is stronger evidence than mutable metadata. This
  // matters when a schedule enters a future phase: the price is changed by
  // Stripe atomically, while old metadata can still be present on historical or
  // manually edited subscriptions. Enterprise has no catalogued price here, so
  // its explicit metadata remains the fallback.
  const plan = planFromPriceId(priceId, prices) ?? readPlan(subscription.metadata?.plan);
  const billingInterval =
    readBillingInterval(firstPrice?.recurring?.interval)
    ?? readBillingInterval(subscription.metadata?.billing_interval);

  return {
    subscriptionId,
    customerId,
    status: subscription.status,
    plan,
    billingInterval,
    // Stripe's newer API versions expose billing periods on subscription
    // items; older webhook snapshots exposed them on the subscription itself.
    currentPeriodStartSeconds:
      readPositiveTimestamp(subscription.current_period_start)
      ?? readPositiveTimestamp(subscription.items?.data?.[0]?.current_period_start),
    currentPeriodEndSeconds:
      readPositiveTimestamp(subscription.current_period_end)
      ?? readPositiveTimestamp(subscription.items?.data?.[0]?.current_period_end),
    trialEndSeconds: readPositiveTimestamp(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    scheduleId: extractStripeId(subscription.schedule),
  };
}

export function extractInvoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null;
  const value = invoice as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } } | null;
    lines?: {
      data?: Array<{
        parent?: { subscription_item_details?: { subscription?: unknown } } | null;
      }>;
    } | null;
  };

  return extractStripeId(value.subscription)
    ?? extractStripeId(value.parent?.subscription_details?.subscription)
    ?? extractStripeId(value.lines?.data?.[0]?.parent?.subscription_item_details?.subscription);
}
