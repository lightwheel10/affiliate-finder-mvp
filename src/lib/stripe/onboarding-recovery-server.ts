import 'server-only';

import type Stripe from 'stripe';
import {
  reconcileInitialSubscription,
  type InitialSubscriptionDatabase,
  type InitialSubscriptionReconciliationOutcome,
} from '@/lib/stripe/initial-subscription-postgres';
import {
  extractInvoiceSubscriptionId,
  extractInvoiceSubscriptionServicePeriod,
  extractStripeId,
  snapshotStripeSubscription,
} from '@/lib/stripe/subscription-state';

interface OnboardingRecoveryStripeClient {
  customers: Pick<Stripe['customers'], 'retrieve'>;
  invoices: Pick<Stripe['invoices'], 'retrieve'>;
  paymentMethods: Pick<Stripe['paymentMethods'], 'retrieve'>;
}

interface StripePriceConfiguration {
  proMonthly?: string;
  proAnnual?: string;
  businessMonthly?: string;
  businessAnnual?: string;
}

export interface RecoveredOnboardingSubscription {
  status: 'active' | 'trialing';
  plan: 'pro' | 'business';
  billingInterval: 'monthly' | 'annual';
  reconciliation: InitialSubscriptionReconciliationOutcome;
}

/**
 * Rebuild local initial-subscription state from Stripe after the browser or a
 * server request stopped between Stripe success and onboarding completion.
 * Stripe is read first; the existing reconciliation helper then commits the
 * subscription, account access and matching credits atomically.
 */
export async function recoverOnboardingSubscription(
  database: InitialSubscriptionDatabase,
  stripeClient: OnboardingRecoveryStripeClient,
  input: {
    userId: number;
    stripeCustomerId: string;
    subscription: Stripe.Subscription;
    prices: StripePriceConfiguration;
  },
): Promise<RecoveredOnboardingSubscription> {
  if (input.subscription.status !== 'active' && input.subscription.status !== 'trialing') {
    throw new Error('Only an active or trialing subscription can finish onboarding.');
  }

  const snapshot = snapshotStripeSubscription(input.subscription, input.prices);
  if (snapshot.customerId !== input.stripeCustomerId) {
    throw new Error(`Stripe subscription ${input.subscription.id} belongs to a different customer.`);
  }
  if (snapshot.plan !== 'pro' && snapshot.plan !== 'business') {
    throw new Error(`Stripe subscription ${input.subscription.id} has an unsupported onboarding plan.`);
  }
  if (snapshot.billingInterval !== 'monthly' && snapshot.billingInterval !== 'annual') {
    throw new Error(`Stripe subscription ${input.subscription.id} has an unsupported billing interval.`);
  }
  if (input.subscription.collection_method !== 'charge_automatically') {
    throw new Error(`Stripe subscription ${input.subscription.id} does not use automatic card billing.`);
  }
  if (
    snapshot.currentPeriodStartSeconds === null
    || snapshot.currentPeriodEndSeconds === null
  ) {
    throw new Error(`Stripe subscription ${input.subscription.id} has no valid billing period.`);
  }

  const customer = await stripeClient.customers.retrieve(input.stripeCustomerId);
  if (customer.deleted) {
    throw new Error(`Stripe customer ${input.stripeCustomerId} was deleted.`);
  }
  const paymentMethodId = extractStripeId(input.subscription.default_payment_method)
    ?? extractStripeId(customer.invoice_settings.default_payment_method);
  if (!paymentMethodId) {
    throw new Error(`Stripe subscription ${input.subscription.id} has no default payment method.`);
  }
  const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
  if (extractStripeId(paymentMethod.customer) !== input.stripeCustomerId) {
    throw new Error(`Stripe payment method ${paymentMethodId} belongs to a different customer.`);
  }
  if (!paymentMethod.card) {
    throw new Error(`Stripe payment method ${paymentMethodId} is not a card.`);
  }

  let paidInvoice: {
    invoiceId: string;
    periodStart: Date;
    paidAt: string;
  } | null = null;
  if (input.subscription.status === 'active') {
    const latestInvoiceId = extractStripeId(input.subscription.latest_invoice);
    if (!latestInvoiceId) {
      throw new Error(`Active Stripe subscription ${input.subscription.id} has no invoice.`);
    }
    const invoice = await stripeClient.invoices.retrieve(latestInvoiceId);
    if (extractStripeId(invoice.customer) !== input.stripeCustomerId) {
      throw new Error(`Stripe invoice ${latestInvoiceId} belongs to a different customer.`);
    }
    if (extractInvoiceSubscriptionId(invoice) !== input.subscription.id) {
      throw new Error(`Stripe invoice ${latestInvoiceId} belongs to a different subscription.`);
    }
    if (invoice.status !== 'paid') {
      throw new Error(`Active Stripe subscription ${input.subscription.id} has an unpaid latest invoice.`);
    }
    const servicePeriod = extractInvoiceSubscriptionServicePeriod(
      invoice,
      input.subscription.id,
    );
    if (!servicePeriod) {
      throw new Error(`Stripe invoice ${latestInvoiceId} has no subscription service period.`);
    }
    const paidAtSeconds = invoice.status_transitions.paid_at ?? invoice.created;
    if (!Number.isSafeInteger(paidAtSeconds) || paidAtSeconds <= 0) {
      throw new Error(`Stripe invoice ${latestInvoiceId} has no valid paid timestamp.`);
    }
    paidInvoice = {
      invoiceId: latestInvoiceId,
      periodStart: new Date(servicePeriod.startSeconds * 1000),
      paidAt: new Date(paidAtSeconds * 1000).toISOString(),
    };
  }

  const currentPeriodStart = new Date(
    snapshot.currentPeriodStartSeconds * 1000,
  ).toISOString();
  const currentPeriodEnd = new Date(
    snapshot.currentPeriodEndSeconds * 1000,
  ).toISOString();
  const trialEnd = snapshot.trialEndSeconds === null
    ? null
    : new Date(snapshot.trialEndSeconds * 1000).toISOString();
  const reconciliation = await reconcileInitialSubscription(database, {
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.subscription.id,
    stripePaymentMethodId: paymentMethodId,
    plan: snapshot.plan,
    billingInterval: snapshot.billingInterval,
    status: input.subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    trialEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    card: {
      last4: paymentMethod.card.last4,
      brand: paymentMethod.card.brand,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
    },
    paidInvoice,
  });

  return {
    status: input.subscription.status,
    plan: snapshot.plan,
    billingInterval: snapshot.billingInterval,
    reconciliation,
  };
}
