import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  ensureDeferredDowngradeSchedule,
  isPlanChangeEligibleSubscriptionStatus,
  MANAGED_PLAN_SCHEDULE_KIND,
  MANAGED_PLAN_SCHEDULE_OWNER,
  preserveSchedulePhase,
  releaseManagedPlanSchedule,
  releaseManagedPlanScheduleById,
  UnsupportedSubscriptionScheduleError,
} from '../../src/lib/stripe/subscription-change';

function subscription(schedule: string | null = null): Stripe.Subscription {
  return {
    id: 'sub_test',
    customer: 'cus_test',
    status: 'active',
    metadata: { plan: 'business', billing_interval: 'monthly', keep: 'yes' },
    schedule,
    items: {
      data: [{
        id: 'si_test',
        price: { id: 'price_business_month', recurring: { interval: 'month' } },
        quantity: 1,
        current_period_end: 1_802_592_000,
      }],
    },
  } as unknown as Stripe.Subscription;
}

function phase(): Stripe.SubscriptionSchedule.Phase {
  return {
    add_invoice_items: [],
    application_fee_percent: null,
    billing_cycle_anchor: 'automatic',
    billing_thresholds: null,
    collection_method: 'charge_automatically',
    currency: 'eur',
    default_payment_method: 'pm_test',
    default_tax_rates: [{ id: 'txr_test' }],
    description: 'Keep me',
    discounts: [{ discount: { id: 'di_test' }, coupon: null, promotion_code: null }],
    end_date: 1_802_592_000,
    invoice_settings: null,
    items: [{
      billing_thresholds: null,
      discounts: [],
      metadata: { item: 'kept' },
      plan: 'price_business_month',
      price: 'price_business_month',
      quantity: 1,
      tax_rates: [{ id: 'txr_item' }],
    }],
    metadata: { plan: 'business', billing_interval: 'monthly', keep: 'yes' },
    on_behalf_of: null,
    proration_behavior: 'create_prorations',
    start_date: 1_800_000_000,
    transfer_data: null,
    trial_end: null,
  } as unknown as Stripe.SubscriptionSchedule.Phase;
}

function schedule(metadata: Record<string, string> = {}): Stripe.SubscriptionSchedule {
  return {
    id: 'sub_sched_test',
    status: 'active',
    subscription: 'sub_test',
    released_subscription: null,
    metadata,
    current_phase: { start_date: 1_800_000_000, end_date: 1_802_592_000 },
    phases: [phase()],
  } as unknown as Stripe.SubscriptionSchedule;
}

test('preserves current schedule billing details when rebuilding phases', () => {
  const preserved = preserveSchedulePhase(phase());
  assert.equal(preserved.start_date, 1_800_000_000);
  assert.equal(preserved.end_date, 1_802_592_000);
  assert.equal(preserved.collection_method, 'charge_automatically');
  assert.equal(preserved.default_payment_method, 'pm_test');
  assert.deepEqual(preserved.default_tax_rates, ['txr_test']);
  assert.deepEqual(preserved.discounts, [{ discount: 'di_test' }]);
  assert.deepEqual(preserved.items[0].tax_rates, ['txr_item']);
  assert.deepEqual(preserved.items[0].metadata, { item: 'kept' });
});

test('creates a two-phase downgrade without changing the active phase', async () => {
  const baseSchedule = schedule({
    managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
    change_kind: MANAGED_PLAN_SCHEDULE_KIND,
  });
  const calls: Array<{ method: string; value: unknown }> = [];
  const client = {
    create: async (params: unknown, options: unknown) => {
      calls.push({ method: 'create', value: { params, options } });
      return baseSchedule;
    },
    retrieve: async () => baseSchedule,
    update: async (
      _id: string,
      params: Stripe.SubscriptionScheduleUpdateParams,
      options: Stripe.RequestOptions,
    ) => {
      calls.push({ method: 'update', value: { params, options } });
      return { ...baseSchedule, metadata: params.metadata as Record<string, string> };
    },
    release: async () => {
      calls.push({ method: 'release', value: null });
      return baseSchedule;
    },
  };

  const result = await ensureDeferredDowngradeSchedule(client, {
    subscription: subscription(),
    operationId: 'operation-create',
    sourcePlan: 'business',
    sourceBillingInterval: 'monthly',
    targetPlan: 'pro',
    targetBillingInterval: 'annual',
    targetPriceId: 'price_pro_year',
    accountId: 42,
    changedAt: '2026-09-03T10:00:00.000Z',
  });

  assert.deepEqual(result, {
    scheduleId: 'sub_sched_test',
    effectiveAtSeconds: 1_802_592_000,
  });
  assert.deepEqual(calls.map((call) => call.method), ['create', 'update']);
  const createCall = calls[0].value as { options: Stripe.RequestOptions };
  const updateCall = calls[1].value as {
    params: Stripe.SubscriptionScheduleUpdateParams;
    options: Stripe.RequestOptions;
  };
  assert.match(createCall.options.idempotencyKey ?? '', /:operation-create$/);
  assert.match(updateCall.options.idempotencyKey ?? '', /:operation-create$/);
  const update = updateCall.params;
  assert.equal(update.proration_behavior, 'none');
  assert.equal(update.phases?.length, 2);
  assert.equal(update.phases?.[0].items[0].price, 'price_business_month');
  assert.equal(update.phases?.[0].end_date, 1_802_592_000);
  assert.equal(update.phases?.[1].start_date, 1_802_592_000);
  assert.deepEqual(update.phases?.[1].duration, { interval: 'year', interval_count: 1 });
  assert.equal(update.phases?.[1].items[0].price, 'price_pro_year');
  assert.equal(update.phases?.[1].proration_behavior, 'none');
  assert.deepEqual(update.phases?.[1].metadata, {
    plan: 'pro',
    billing_interval: 'annual',
    keep: 'yes',
    changed_at: '2026-09-03T10:00:00.000Z',
    previous_plan: 'business',
    previous_interval: 'monthly',
  });
});

test('updates an existing managed schedule instead of creating another one', async () => {
  const managed = schedule({
    managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
    change_kind: MANAGED_PLAN_SCHEDULE_KIND,
  });
  let creates = 0;
  let updates = 0;
  const result = await ensureDeferredDowngradeSchedule({
    create: async () => { creates += 1; return managed; },
    retrieve: async () => managed,
    update: async () => { updates += 1; return managed; },
    release: async () => managed,
  }, {
    subscription: subscription('sub_sched_test'),
    operationId: 'operation-update',
    sourcePlan: 'business',
    sourceBillingInterval: 'monthly',
    targetPlan: 'pro',
    targetBillingInterval: 'monthly',
    targetPriceId: 'price_pro_month',
    accountId: 42,
    changedAt: '2026-09-03T10:00:00.000Z',
  });

  assert.equal(result.scheduleId, 'sub_sched_test');
  assert.equal(creates, 0);
  assert.equal(updates, 1);
});

test('refuses to overwrite a schedule owned outside the application', async () => {
  const external = schedule({ managed_by: 'stripe-dashboard' });
  await assert.rejects(
    ensureDeferredDowngradeSchedule({
      create: async () => external,
      retrieve: async () => external,
      update: async () => external,
      release: async () => external,
    }, {
      subscription: subscription('sub_sched_test'),
      operationId: 'operation-external',
      sourcePlan: 'business',
      sourceBillingInterval: 'monthly',
      targetPlan: 'pro',
      targetBillingInterval: 'monthly',
      targetPriceId: 'price_pro_month',
      accountId: 42,
      changedAt: '2026-09-03T10:00:00.000Z',
    }),
    UnsupportedSubscriptionScheduleError,
  );
});

test('releases a newly attached schedule if phase configuration fails', async () => {
  const managed = schedule({
    managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
    change_kind: MANAGED_PLAN_SCHEDULE_KIND,
  });
  let released = 0;
  await assert.rejects(
    ensureDeferredDowngradeSchedule({
      create: async () => managed,
      retrieve: async () => managed,
      update: async () => { throw new Error('forced update failure'); },
      release: async () => { released += 1; return managed; },
    }, {
      subscription: subscription(),
      operationId: 'operation-failure',
      sourcePlan: 'business',
      sourceBillingInterval: 'monthly',
      targetPlan: 'pro',
      targetBillingInterval: 'monthly',
      targetPriceId: 'price_pro_month',
      accountId: 42,
      changedAt: '2026-09-03T10:00:00.000Z',
    }),
    /forced update failure/,
  );
  assert.equal(released, 1);
});

test('release helper refuses unmanaged schedules and releases managed ones', async () => {
  const external = schedule({ managed_by: 'external' });
  await assert.rejects(
    releaseManagedPlanSchedule({
      create: async () => external,
      retrieve: async () => external,
      update: async () => external,
      release: async () => external,
    }, subscription('sub_sched_test'), 'test'),
    UnsupportedSubscriptionScheduleError,
  );

  const managed = schedule({
    managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
    change_kind: MANAGED_PLAN_SCHEDULE_KIND,
  });
  let releases = 0;
  const releasedId = await releaseManagedPlanSchedule({
    create: async () => managed,
    retrieve: async () => managed,
    update: async () => managed,
    release: async () => { releases += 1; return managed; },
  }, subscription('sub_sched_test'), 'test');
  assert.equal(releasedId, 'sub_sched_test');
  assert.equal(releases, 1);
});

test('exact schedule rollback verifies ownership before releasing', async () => {
  const managed = schedule({
    managed_by: MANAGED_PLAN_SCHEDULE_OWNER,
    change_kind: MANAGED_PLAN_SCHEDULE_KIND,
  });
  let releasedId = '';
  await releaseManagedPlanScheduleById({
    create: async () => managed,
    retrieve: async (id) => {
      assert.equal(id, 'sub_sched_test');
      return managed;
    },
    update: async () => managed,
    release: async (id) => {
      releasedId = id;
      return managed;
    },
  }, 'sub_sched_test', 'database-failure');
  assert.equal(releasedId, 'sub_sched_test');

  const external = schedule({ managed_by: 'external' });
  await assert.rejects(
    releaseManagedPlanScheduleById({
      create: async () => external,
      retrieve: async () => external,
      update: async () => external,
      release: async () => external,
    }, 'sub_sched_external', 'database-failure'),
    UnsupportedSubscriptionScheduleError,
  );
});

test('accepts plan changes only for active or trialing Stripe subscriptions', () => {
  assert.equal(isPlanChangeEligibleSubscriptionStatus('active'), true);
  assert.equal(isPlanChangeEligibleSubscriptionStatus('trialing'), true);
  for (const status of ['past_due', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'canceled']) {
    assert.equal(isPlanChangeEligibleSubscriptionStatus(status), false, status);
  }
});
