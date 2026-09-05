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

/**
 * Reads the PaymentIntent client secret exposed by Stripe on a finalized
 * invoice. The value is deliberately accepted only in the documented
 * `pi_..._secret_...` shape and is never logged or persisted by the app.
 */
export function extractInvoiceConfirmationClientSecret(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null;
  const confirmationSecret = (invoice as {
    confirmation_secret?: { client_secret?: unknown } | null;
    payment_intent?: unknown;
  }).confirmation_secret;
  const modernSecret = confirmationSecret?.client_secret;
  if (
    typeof modernSecret === 'string'
    && modernSecret.length <= 512
    && /^pi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+$/.test(modernSecret)
  ) {
    return modernSecret;
  }

  // Rolling compatibility for invoices created under an older Stripe API
  // shape where the expanded PaymentIntent carried the same client secret.
  const legacySecret = (invoice as {
    payment_intent?: { client_secret?: unknown } | null;
  }).payment_intent;
  if (
    legacySecret
    && typeof legacySecret === 'object'
    && typeof legacySecret.client_secret === 'string'
    && legacySecret.client_secret.length <= 512
    && /^pi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+$/.test(legacySecret.client_secret)
  ) {
    return legacySecret.client_secret;
  }
  return null;
}

/**
 * Returns the single price waiting inside a Stripe pending subscription
 * update. Multiple or malformed items are rejected because this application
 * sells exactly one plan item per subscription and must never guess which
 * pending charge represents the requested plan.
 */
export function extractPendingSubscriptionPriceId(subscription: unknown): string | null {
  if (!subscription || typeof subscription !== 'object') return null;
  const pendingUpdate = (subscription as {
    pending_update?: {
      subscription_items?: Array<{ price?: unknown }> | null;
    } | null;
  }).pending_update;
  if (!pendingUpdate) return null;
  if (!Array.isArray(pendingUpdate.subscription_items)) {
    throw new Error('Stripe pending subscription update has no item list.');
  }
  const priceIds = pendingUpdate.subscription_items.map((item) => extractStripeId(item.price));
  if (priceIds.length !== 1 || !priceIds[0]) {
    throw new Error('Stripe pending subscription update does not contain exactly one valid price.');
  }
  return priceIds[0];
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

  const subscriptionItems = subscription.items?.data;
  if (Array.isArray(subscriptionItems) && subscriptionItems.length !== 1) {
    throw new Error(
      `Stripe subscription ${subscriptionId} must contain exactly one plan item.`,
    );
  }

  const firstPrice = subscriptionItems?.[0]?.price ?? null;
  const priceId = extractStripeId(firstPrice);
  // A configured Stripe price is stronger evidence than mutable metadata. This
  // matters when a schedule enters a future phase: the price is changed by
  // Stripe atomically, while old metadata can still be present on historical or
  // manually edited subscriptions. Enterprise has no catalogued price here, so
  // its explicit metadata remains the fallback.
  const metadataPlan = readPlan(subscription.metadata?.plan);
  const configuredPlan = planFromPriceId(priceId, prices);
  // A present but unknown Stripe price must not be relabelled as Pro/Business
  // from stale mutable metadata. Enterprise has no configured catalogue price
  // in this application, so it remains the one explicit metadata fallback.
  const plan = configuredPlan
    ?? (priceId ? (metadataPlan === 'enterprise' ? metadataPlan : null) : metadataPlan);
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
      ?? readPositiveTimestamp(subscriptionItems?.[0]?.current_period_start),
    currentPeriodEndSeconds:
      readPositiveTimestamp(subscription.current_period_end)
      ?? readPositiveTimestamp(subscriptionItems?.[0]?.current_period_end),
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

export interface StripeInvoiceServicePeriod {
  startSeconds: number;
  endSeconds: number;
}

/**
 * Reads the paid service period from subscription line items, which is the
 * Stripe-supported billing-period authority for an invoice. The invoice's
 * top-level period and today's subscription period are intentionally ignored:
 * either can describe a different point in time when webhooks arrive late.
 */
export function extractInvoiceSubscriptionServicePeriod(
  invoice: unknown,
  stripeSubscriptionId: string,
  options: { allowProrationFallback?: boolean } = {},
): StripeInvoiceServicePeriod | null {
  if (!invoice || typeof invoice !== 'object') return null;
  const lines = (invoice as {
    lines?: {
      data?: Array<{
        subscription?: unknown;
        period?: { start?: unknown; end?: unknown } | null;
        proration?: unknown;
        parent?: {
          subscription_item_details?: {
            subscription?: unknown;
            proration?: unknown;
          } | null;
        } | null;
      }>;
    } | null;
  }).lines?.data;
  if (!Array.isArray(lines)) return null;

  const subscriptionPeriods = new Map<string, StripeInvoiceServicePeriod>();
  const prorationPeriods = new Map<string, StripeInvoiceServicePeriod>();
  for (const line of lines) {
    const details = line.parent?.subscription_item_details;
    const subscriptionId = extractStripeId(details?.subscription)
      ?? extractStripeId(line.subscription);
    const isProration = details?.proration === true || line.proration === true;
    const startSeconds = readPositiveTimestamp(line.period?.start);
    const endSeconds = readPositiveTimestamp(line.period?.end);
    if (
      subscriptionId !== stripeSubscriptionId
      || startSeconds === null
      || endSeconds === null
      || endSeconds < startSeconds
    ) {
      continue;
    }
    const target = isProration ? prorationPeriods : subscriptionPeriods;
    target.set(`${startSeconds}:${endSeconds}`, { startSeconds, endSeconds });
  }

  if (subscriptionPeriods.size > 1) {
    throw new Error(
      `Stripe invoice has multiple non-proration service periods for subscription ${stripeSubscriptionId}.`,
    );
  }
  const subscriptionPeriod = subscriptionPeriods.values().next().value;
  if (subscriptionPeriod) return subscriptionPeriod;

  if (!options.allowProrationFallback) return null;
  if (prorationPeriods.size > 1) {
    throw new Error(
      `Stripe invoice has multiple proration periods for subscription ${stripeSubscriptionId}.`,
    );
  }
  // Stripe documents a proration line's start as the instant the proration was
  // calculated. For a subscription-update invoice, this is the durable change
  // time used only when no full subscription-period line exists.
  return prorationPeriods.values().next().value ?? null;
}
