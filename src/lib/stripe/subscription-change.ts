import type Stripe from 'stripe';
import { extractStripeId } from './subscription-state';

export const MANAGED_PLAN_SCHEDULE_OWNER = 'affiliate-finder';
export const MANAGED_PLAN_SCHEDULE_KIND = 'deferred_plan_downgrade';

export type PaidPlan = 'pro' | 'business';
export type BillingInterval = 'monthly' | 'annual';

export class UnsupportedSubscriptionScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedSubscriptionScheduleError';
  }
}

interface ScheduleClient {
  create(
    params: Stripe.SubscriptionScheduleCreateParams,
    options?: Stripe.RequestOptions,
  ): Promise<Stripe.SubscriptionSchedule>;
  retrieve(id: string): Promise<Stripe.SubscriptionSchedule>;
  update(
    id: string,
    params: Stripe.SubscriptionScheduleUpdateParams,
    options?: Stripe.RequestOptions,
  ): Promise<Stripe.SubscriptionSchedule>;
  release(
    id: string,
    params?: Stripe.SubscriptionScheduleReleaseParams,
    options?: Stripe.RequestOptions,
  ): Promise<Stripe.SubscriptionSchedule>;
}

export interface DeferredDowngradeInput {
  subscription: Stripe.Subscription;
  operationId: string;
  sourcePlan: 'pro' | 'business' | 'enterprise';
  sourceBillingInterval: BillingInterval;
  targetPlan: PaidPlan;
  targetBillingInterval: BillingInterval;
  targetPriceId: string;
  accountId: number;
  changedAt: string;
}

export interface DeferredDowngradeResult {
  scheduleId: string;
  effectiveAtSeconds: number;
}

function requireStripeId(value: unknown, label: string): string {
  const id = extractStripeId(value);
  if (!id) throw new UnsupportedSubscriptionScheduleError(`${label} has no stable Stripe ID.`);
  return id;
}

function mapDiscount(
  discount: Stripe.SubscriptionSchedule.Phase.Discount,
  label: string,
): Stripe.SubscriptionScheduleUpdateParams.Phase.Discount {
  const discountId = extractStripeId(discount.discount);
  if (discountId) return { discount: discountId };
  const promotionCodeId = extractStripeId(discount.promotion_code);
  if (promotionCodeId) return { promotion_code: promotionCodeId };
  const couponId = extractStripeId(discount.coupon);
  if (couponId) return { coupon: couponId };
  throw new UnsupportedSubscriptionScheduleError(`${label} cannot be preserved safely.`);
}

function mapItemDiscount(
  discount: Stripe.SubscriptionSchedule.Phase.Item.Discount,
  label: string,
): Stripe.SubscriptionScheduleUpdateParams.Phase.Item.Discount {
  const discountId = extractStripeId(discount.discount);
  if (discountId) return { discount: discountId };
  const promotionCodeId = extractStripeId(discount.promotion_code);
  if (promotionCodeId) return { promotion_code: promotionCodeId };
  const couponId = extractStripeId(discount.coupon);
  if (couponId) return { coupon: couponId };
  throw new UnsupportedSubscriptionScheduleError(`${label} cannot be preserved safely.`);
}

function mapTaxRateIds(values: readonly unknown[] | null | undefined, label: string): string[] | undefined {
  if (!values) return undefined;
  return values.map((value, index) => requireStripeId(value, `${label} ${index + 1}`));
}

function mapAddInvoiceItem(
  item: Stripe.SubscriptionSchedule.Phase.AddInvoiceItem,
  index: number,
): Stripe.SubscriptionScheduleUpdateParams.Phase.AddInvoiceItem {
  return {
    price: requireStripeId(item.price, `Phase add-invoice item ${index + 1} price`),
    ...(item.quantity === null ? {} : { quantity: item.quantity }),
    ...(item.metadata ? { metadata: item.metadata } : {}),
    ...(item.discounts.length > 0
      ? {
          discounts: item.discounts.map((discount, discountIndex) => {
            const discountId = extractStripeId(discount.discount);
            if (discountId) return { discount: discountId };
            const promotionCodeId = extractStripeId(discount.promotion_code);
            if (promotionCodeId) return { promotion_code: promotionCodeId };
            const couponId = extractStripeId(discount.coupon);
            if (couponId) return { coupon: couponId };
            throw new UnsupportedSubscriptionScheduleError(
              `Phase add-invoice item ${index + 1} discount ${discountIndex + 1} cannot be preserved safely.`,
            );
          }),
        }
      : {}),
    ...(item.tax_rates
      ? { tax_rates: mapTaxRateIds(item.tax_rates, `Phase add-invoice item ${index + 1} tax rate`) }
      : {}),
    ...(item.period
      ? {
          period: {
            start: {
              type: item.period.start.type,
              ...(item.period.start.timestamp === undefined
                ? {}
                : { timestamp: item.period.start.timestamp }),
            },
            end: {
              type: item.period.end.type,
              ...(item.period.end.timestamp === undefined
                ? {}
                : { timestamp: item.period.end.timestamp }),
            },
          },
        }
      : {}),
  };
}

function mapPhaseItem(
  item: Stripe.SubscriptionSchedule.Phase.Item,
  index: number,
): Stripe.SubscriptionScheduleUpdateParams.Phase.Item {
  return {
    price: requireStripeId(item.price, `Phase item ${index + 1} price`),
    ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
    ...(item.metadata ? { metadata: item.metadata } : {}),
    ...(item.billing_thresholds && item.billing_thresholds.usage_gte !== null
      ? { billing_thresholds: { usage_gte: item.billing_thresholds.usage_gte } }
      : {}),
    ...(item.discounts.length > 0
      ? {
          discounts: item.discounts.map((discount, discountIndex) =>
            mapItemDiscount(discount, `Phase item ${index + 1} discount ${discountIndex + 1}`)),
        }
      : {}),
    ...(item.tax_rates
      ? { tax_rates: mapTaxRateIds(item.tax_rates, `Phase item ${index + 1} tax rate`) }
      : {}),
  };
}

function mapAutomaticTax(
  automaticTax: Stripe.SubscriptionSchedule.Phase.AutomaticTax | undefined,
): Stripe.SubscriptionScheduleUpdateParams.Phase.AutomaticTax | undefined {
  if (!automaticTax) return undefined;
  const liability = automaticTax.liability;
  return {
    enabled: automaticTax.enabled,
    ...(liability
      ? {
          liability: {
            type: liability.type,
            ...(liability.type === 'account'
              ? { account: requireStripeId(liability.account, 'Automatic-tax liability account') }
              : {}),
          },
        }
      : {}),
  };
}

function mapInvoiceSettings(
  settings: Stripe.SubscriptionSchedule.Phase.InvoiceSettings | null,
): Stripe.SubscriptionScheduleUpdateParams.Phase.InvoiceSettings | undefined {
  if (!settings) return undefined;
  const accountTaxIds = mapTaxRateIds(settings.account_tax_ids, 'Invoice account tax ID');
  const issuer = settings.issuer;
  return {
    ...(accountTaxIds ? { account_tax_ids: accountTaxIds } : {}),
    ...(settings.days_until_due === null ? {} : { days_until_due: settings.days_until_due }),
    ...(issuer
      ? {
          issuer: {
            type: issuer.type,
            ...(issuer.type === 'account'
              ? { account: requireStripeId(issuer.account, 'Invoice issuer account') }
              : {}),
          },
        }
      : {}),
  };
}

function mapTransferData(
  transfer: Stripe.SubscriptionSchedule.Phase.TransferData | null,
): Stripe.SubscriptionScheduleUpdateParams.Phase.TransferData | undefined {
  if (!transfer) return undefined;
  return {
    destination: requireStripeId(transfer.destination, 'Transfer destination'),
    ...(transfer.amount_percent === null ? {} : { amount_percent: transfer.amount_percent }),
  };
}

/**
 * Converts Stripe's read shape back into its update shape. Stripe requires all
 * current/future phases on schedule updates, and omitting a current-phase field
 * can clear it. Keeping this conversion centralized prevents a downgrade from
 * silently dropping discounts, taxes or collection settings.
 */
export function preserveSchedulePhase(
  phase: Stripe.SubscriptionSchedule.Phase,
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  const automaticTax = mapAutomaticTax(phase.automatic_tax);
  const invoiceSettings = mapInvoiceSettings(phase.invoice_settings);
  const transferData = mapTransferData(phase.transfer_data);
  const defaultPaymentMethod = extractStripeId(phase.default_payment_method);
  const onBehalfOf = extractStripeId(phase.on_behalf_of);

  return {
    start_date: phase.start_date,
    end_date: phase.end_date,
    items: phase.items.map(mapPhaseItem),
    proration_behavior: phase.proration_behavior,
    ...(phase.add_invoice_items.length > 0
      ? { add_invoice_items: phase.add_invoice_items.map(mapAddInvoiceItem) }
      : {}),
    ...(phase.application_fee_percent === null
      ? {}
      : { application_fee_percent: phase.application_fee_percent }),
    ...(automaticTax ? { automatic_tax: automaticTax } : {}),
    ...(phase.billing_cycle_anchor === null
      ? {}
      : { billing_cycle_anchor: phase.billing_cycle_anchor }),
    ...(phase.billing_thresholds === null
      ? {}
      : {
          billing_thresholds: {
            ...(phase.billing_thresholds.amount_gte === null
              ? {}
              : { amount_gte: phase.billing_thresholds.amount_gte }),
            ...(phase.billing_thresholds.reset_billing_cycle_anchor === null
              ? {}
              : { reset_billing_cycle_anchor: phase.billing_thresholds.reset_billing_cycle_anchor }),
          },
        }),
    ...(phase.collection_method === null ? {} : { collection_method: phase.collection_method }),
    ...(phase.currency ? { currency: phase.currency } : {}),
    ...(defaultPaymentMethod ? { default_payment_method: defaultPaymentMethod } : {}),
    ...(phase.default_tax_rates
      ? { default_tax_rates: mapTaxRateIds(phase.default_tax_rates, 'Default tax rate') }
      : {}),
    ...(phase.description === null ? {} : { description: phase.description }),
    ...(phase.discounts.length > 0
      ? {
          discounts: phase.discounts.map((discount, index) =>
            mapDiscount(discount, `Phase discount ${index + 1}`)),
        }
      : {}),
    ...(invoiceSettings ? { invoice_settings: invoiceSettings } : {}),
    ...(phase.metadata ? { metadata: phase.metadata } : {}),
    ...(onBehalfOf ? { on_behalf_of: onBehalfOf } : {}),
    ...(transferData ? { transfer_data: transferData } : {}),
    ...(phase.trial_end === null ? {} : { trial_end: phase.trial_end }),
  };
}

function locateCurrentPhase(schedule: Stripe.SubscriptionSchedule): Stripe.SubscriptionSchedule.Phase {
  if (!schedule.current_phase) {
    throw new UnsupportedSubscriptionScheduleError('The Stripe schedule has no active current phase.');
  }
  const phase = schedule.phases.find((candidate) =>
    candidate.start_date === schedule.current_phase?.start_date
    && candidate.end_date === schedule.current_phase?.end_date);
  if (!phase) {
    throw new UnsupportedSubscriptionScheduleError('The Stripe schedule current phase is inconsistent.');
  }
  return phase;
}

export function isManagedPlanSchedule(schedule: Stripe.SubscriptionSchedule): boolean {
  return schedule.metadata?.managed_by === MANAGED_PLAN_SCHEDULE_OWNER
    && schedule.metadata?.change_kind === MANAGED_PLAN_SCHEDULE_KIND;
}

export function subscriptionScheduleId(subscription: Stripe.Subscription): string | null {
  return extractStripeId(subscription.schedule);
}

function scheduleSubscriptionId(schedule: Stripe.SubscriptionSchedule): string | null {
  return extractStripeId(schedule.subscription) ?? schedule.released_subscription;
}

function futurePhase(
  current: Stripe.SubscriptionScheduleUpdateParams.Phase,
  input: DeferredDowngradeInput,
  effectiveAtSeconds: number,
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  if (current.items.length !== 1) {
    throw new UnsupportedSubscriptionScheduleError(
      'This application can only defer a downgrade for a one-item subscription.',
    );
  }
  const [currentItem] = current.items;
  const continuingSettings: Partial<Stripe.SubscriptionScheduleUpdateParams.Phase> = {
    ...current,
  };
  delete continuingSettings.start_date;
  delete continuingSettings.end_date;
  delete continuingSettings.duration;
  delete continuingSettings.add_invoice_items;
  delete continuingSettings.trial;
  delete continuingSettings.trial_end;
  delete continuingSettings.items;
  delete continuingSettings.metadata;
  return {
    ...continuingSettings,
    start_date: effectiveAtSeconds,
    duration: {
      interval: input.targetBillingInterval === 'annual' ? 'year' : 'month',
      interval_count: 1,
    },
    items: [{ ...currentItem, price: input.targetPriceId }],
    metadata: {
      ...(input.subscription.metadata ?? {}),
      plan: input.targetPlan,
      billing_interval: input.targetBillingInterval,
      changed_at: input.changedAt,
      previous_plan: input.sourcePlan,
      previous_interval: input.sourceBillingInterval,
    },
    proration_behavior: 'none',
  };
}

function requestKey(prefix: string, input: DeferredDowngradeInput): string {
  const periodEnd = input.subscription.items.data[0]?.current_period_end
    ?? (input.subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
    ?? 0;
  return [prefix, input.subscription.id, input.targetPriceId, periodEnd, input.operationId]
    .join(':')
    .slice(0, 255);
}

export function isPlanChangeEligibleSubscriptionStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

export async function ensureDeferredDowngradeSchedule(
  schedules: ScheduleClient,
  input: DeferredDowngradeInput,
): Promise<DeferredDowngradeResult> {
  const attachedScheduleId = subscriptionScheduleId(input.subscription);
  let createdHere = false;
  let schedule: Stripe.SubscriptionSchedule;

  if (attachedScheduleId) {
    schedule = await schedules.retrieve(attachedScheduleId);
    if (!isManagedPlanSchedule(schedule)) {
      throw new UnsupportedSubscriptionScheduleError(
        'This subscription already has a Stripe schedule that is not managed by this application.',
      );
    }
  } else {
    schedule = await schedules.create(
      {
        from_subscription: input.subscription.id,
        end_behavior: 'release',
        metadata: {
          managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
          change_kind: MANAGED_PLAN_SCHEDULE_KIND,
          account_id: String(input.accountId),
        },
      },
      { idempotencyKey: requestKey('create-plan-downgrade', input) },
    );
    createdHere = true;
  }

  if (scheduleSubscriptionId(schedule) !== input.subscription.id) {
    throw new UnsupportedSubscriptionScheduleError(
      'The Stripe schedule is attached to a different subscription.',
    );
  }
  if (schedule.status !== 'active') {
    throw new UnsupportedSubscriptionScheduleError(
      `The Stripe schedule is ${schedule.status}, not active.`,
    );
  }

  const currentPhase = locateCurrentPhase(schedule);
  const effectiveAtSeconds = currentPhase.end_date;
  const preservedCurrent = preserveSchedulePhase(currentPhase);
  // Keep the subscription's current metadata explicit when touching its active
  // phase. Stripe otherwise treats omitted current-phase values as removal.
  preservedCurrent.metadata = input.subscription.metadata ?? {};

  try {
    const updated = await schedules.update(
      schedule.id,
      {
        end_behavior: 'release',
        metadata: {
          managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
          change_kind: MANAGED_PLAN_SCHEDULE_KIND,
          account_id: String(input.accountId),
          target_plan: input.targetPlan,
          target_billing_interval: input.targetBillingInterval,
          effective_at: String(effectiveAtSeconds),
        },
        phases: [
          preservedCurrent,
          futurePhase(preservedCurrent, input, effectiveAtSeconds),
        ],
        // The active phase is reproduced exactly, so no current-period billing
        // adjustment should be generated by this schedule update.
        proration_behavior: 'none',
      },
      { idempotencyKey: requestKey('update-plan-downgrade', input) },
    );
    if (!isManagedPlanSchedule(updated)) {
      throw new UnsupportedSubscriptionScheduleError('Stripe did not retain managed schedule metadata.');
    }
    return { scheduleId: updated.id, effectiveAtSeconds };
  } catch (error) {
    if (!createdHere) throw error;
    try {
      await schedules.release(
        schedule.id,
        {},
        { idempotencyKey: requestKey('rollback-plan-downgrade', input) },
      );
    } catch (releaseError) {
      throw new AggregateError(
        [error, releaseError],
        'Scheduling the downgrade failed and the temporary Stripe schedule could not be released.',
      );
    }
    throw error;
  }
}

export async function releaseManagedPlanSchedule(
  schedules: ScheduleClient,
  subscription: Stripe.Subscription,
  reason: string,
): Promise<string | null> {
  const scheduleId = subscriptionScheduleId(subscription);
  if (!scheduleId) return null;
  return releaseManagedPlanScheduleById(schedules, scheduleId, reason);
}

/** Release an exact schedule after a later database step fails. */
export async function releaseManagedPlanScheduleById(
  schedules: ScheduleClient,
  scheduleId: string,
  reason: string,
): Promise<string> {
  const schedule = await schedules.retrieve(scheduleId);
  if (!isManagedPlanSchedule(schedule)) {
    throw new UnsupportedSubscriptionScheduleError(
      'This subscription has a Stripe schedule that is not managed by this application.',
    );
  }
  await schedules.release(
    scheduleId,
    {},
    { idempotencyKey: `release-plan-schedule:${scheduleId}:${reason}`.slice(0, 255) },
  );
  return scheduleId;
}
