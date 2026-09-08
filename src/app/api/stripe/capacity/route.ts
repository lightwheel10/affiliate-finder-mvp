import type postgres from 'postgres';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PAID_CAPACITY_ENABLED,
  STRIPE_BASE_PRICE_CONFIGURATION,
  STRIPE_CAPACITY_PRICE_CONFIGURATION,
  stripe,
} from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  CapacityChangeError,
  capacityChangeDirection,
  capacitySelectionIdentity,
} from '@/lib/stripe/capacity-change';
import {
  CAPACITY_ADDON_CATALOG,
  effectiveCapacityLimits,
  effectivePaidCapacity,
  type PaidCapacityQuantities,
  type StripeCapacitySubscriptionSnapshot,
} from '@/lib/stripe/capacity-subscription';
import {
  applyCapacityChange,
  previewCapacityInvoice,
  readAuthoritativeCapacityBillingState,
  readCapacityBaseSubscriptionState,
  readCapacityChangeOutcome,
  retryPendingCapacityInvoicePayment,
  type AppliedCapacityChange,
  type AuthoritativeCapacityBillingState,
  type CapacityBaseSubscriptionState,
} from '@/lib/stripe/capacity-change-server';
import {
  assertNoPendingBasePlanChange,
  bindPendingCapacityPayment,
  cancelCapacityChangeOperation,
  CapacityChangeOperationConflictError,
  lockCapacityBillingOwner,
  prepareCapacityChangeOperation,
  readCapacityBillingOwner,
  readCapacityChangeOperation,
  readPendingCapacityChangeOperation,
  type CapacityBillingOwner,
  type CapacityChangeOperation,
  type CapacityChangeSql,
} from '@/lib/stripe/capacity-change-postgres';
import { finalizeAppliedCapacityChange } from '@/lib/stripe/capacity-change-finalize-server';
import { preparePaidCapacityReductionSelection } from '@/lib/stripe/downgrade-capacity-postgres';
import {
  DowngradeCapacityError,
  type DowngradeRetentionSelection,
} from '@/lib/plans/downgrade-capacity';
import { persistStripeCapacitySubscriptionSnapshot } from '@/lib/stripe/capacity-subscription-sync-server';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';
import { StripeCustomerOwnershipError } from '@/lib/stripe-customer-ownership';

export const dynamic = 'force-dynamic';

const PREPARED_QUOTE_TTL_SECONDS = 30 * 60;
const INITIAL_PAYMENT_TTL_SECONDS = 24 * 60 * 60;
const ZERO_CAPACITY: PaidCapacityQuantities = { extraBrands: 0, extraLocations: 0 };

const quantitiesSchema = z.object({
  extraBrands: z.number().int().min(0).max(CAPACITY_ADDON_CATALOG.brand.maxQuantity),
  extraLocations: z.number().int().min(0).max(CAPACITY_ADDON_CATALOG.location.maxQuantity),
}).strict();
const postgresBigintId = z.string().regex(/^[1-9][0-9]{0,18}$/);
const retentionSchema = z.object({
  brandIds: z.array(postgresBigintId).min(1).max(15),
  locationIds: z.array(postgresBigintId).min(1).max(30),
}).strict();
const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('preview'),
    userId: z.number().int().positive(),
    requestId: z.string().uuid({ version: 'v4' }),
    target: quantitiesSchema,
    retention: retentionSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('confirm'),
    userId: z.number().int().positive(),
    operationId: z.string().uuid({ version: 'v4' }),
  }).strict(),
]);

class CapacityApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CapacityApiError';
  }
}

interface VerifiedStripeState {
  base: CapacityBaseSubscriptionState;
  capacity: AuthoritativeCapacityBillingState;
}

function capacityDatabase() {
  return sql as unknown as {
    begin<T>(operation: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
  };
}

function assertFeatureEnabled(): void {
  if (!PAID_CAPACITY_ENABLED) {
    throw new CapacityApiError(
      'PAID_CAPACITY_DISABLED',
      404,
      'Paid brand and location capacity is not available yet.',
    );
  }
}

function assertStripeCapacityOwner(
  state: AuthoritativeCapacityBillingState,
  userId: number,
): void {
  if (
    state.currentSubscription
    && state.currentSubscription.metadata.neon_user_id !== String(userId)
  ) {
    throw new Error('Stripe capacity subscription belongs to another application account.');
  }
}

function snapshotQuantities(
  snapshot: StripeCapacitySubscriptionSnapshot | null,
): PaidCapacityQuantities {
  return snapshot
    ? { extraBrands: snapshot.extraBrands, extraLocations: snapshot.extraLocations }
    : ZERO_CAPACITY;
}

function quantitiesMatch(
  left: PaidCapacityQuantities,
  right: PaidCapacityQuantities,
): boolean {
  return left.extraBrands === right.extraBrands
    && left.extraLocations === right.extraLocations;
}

function assertBaseStateMatchesDatabase(
  owner: CapacityBillingOwner,
  base: CapacityBaseSubscriptionState,
): void {
  if (owner.plan !== base.plan || owner.status !== base.status) {
    throw new CapacityApiError(
      'BASE_SUBSCRIPTION_SYNC_REQUIRED',
      409,
      'Your plan changed recently. Refresh billing before changing paid capacity.',
    );
  }
}

async function readOwner(userId: number): Promise<CapacityBillingOwner> {
  const owner = await readCapacityBillingOwner(sql as CapacityChangeSql, userId);
  if (!owner) {
    throw new CapacityApiError('ACCOUNT_NOT_FOUND', 404, 'Application account not found.');
  }
  return owner;
}

async function readVerifiedStripeState(
  owner: CapacityBillingOwner,
  allowPendingChange = false,
): Promise<VerifiedStripeState> {
  const [base, capacity] = await Promise.all([
    readCapacityBaseSubscriptionState(stripe, {
      stripeSubscriptionId: owner.stripeSubscriptionId,
      stripeCustomerId: owner.stripeCustomerId,
      prices: STRIPE_BASE_PRICE_CONFIGURATION,
    }),
    readAuthoritativeCapacityBillingState(
      stripe,
      owner.stripeCustomerId,
      STRIPE_CAPACITY_PRICE_CONFIGURATION,
      { allowPendingChange },
    ),
  ]);
  assertBaseStateMatchesDatabase(owner, base);
  assertStripeCapacityOwner(capacity, owner.userId);
  return { base, capacity };
}

async function prepareQuoteOperation(input: {
  owner: CapacityBillingOwner;
  state: VerifiedStripeState;
  operationId: string;
  target: PaidCapacityQuantities;
  direction: 'increase' | 'decrease';
  requestedRetention?: DowngradeRetentionSelection;
}): Promise<CapacityChangeOperation> {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const expiresAt = new Date(
    (nowSeconds + PREPARED_QUOTE_TTL_SECONDS) * 1_000,
  ).toISOString();

  return capacityDatabase().begin(async (rawTransaction) => {
    const transaction = rawTransaction as CapacityChangeSql;
    const owner = await lockCapacityBillingOwner(transaction, input.owner);
    assertBaseStateMatchesDatabase(owner, input.state.base);
    await assertNoPendingBasePlanChange(transaction, owner.userId);

    if (input.state.capacity.authoritative) {
      await persistStripeCapacitySubscriptionSnapshot(
        transaction,
        owner.userId,
        input.state.capacity.authoritative,
      );
    }

    const targetLimits = effectiveCapacityLimits(owner.plan, input.target);
    const selection = input.direction === 'decrease'
      ? await preparePaidCapacityReductionSelection(transaction, {
          userId: owner.userId,
          targetLimits: {
            maxBrands: targetLimits.maxBrands,
            maxLocations: targetLimits.maxLocationsPerAccount,
          },
          requestedSelection: input.requestedRetention,
        })
      : null;
    const selectionIdentity = capacitySelectionIdentity(selection?.selection);

    return prepareCapacityChangeOperation(transaction, {
      operationId: input.operationId,
      userId: owner.userId,
      stripeCustomerId: owner.stripeCustomerId,
      stripeBaseSubscriptionId: owner.stripeSubscriptionId,
      basePlan: owner.plan,
      stripeSubscriptionId: input.state.capacity.current?.subscriptionId ?? null,
      from: snapshotQuantities(input.state.capacity.current),
      to: input.target,
      prorationDateSeconds: nowSeconds,
      ...selectionIdentity,
      expiresAt,
      replacePrepared: true,
    });
  });
}

async function readOperationForConfirmation(
  owner: CapacityBillingOwner,
  operationId: string,
): Promise<{ operation: CapacityChangeOperation; expired: boolean }> {
  return capacityDatabase().begin(async (rawTransaction) => {
    const transaction = rawTransaction as CapacityChangeSql;
    const lockedOwner = await lockCapacityBillingOwner(transaction, owner);
    await assertNoPendingBasePlanChange(transaction, lockedOwner.userId);
    const operation = await readCapacityChangeOperation(transaction, {
      userId: lockedOwner.userId,
      operationId,
    });
    if (!operation) {
      throw new CapacityApiError(
        'CAPACITY_OPERATION_NOT_FOUND',
        404,
        'This paid-capacity request was not found.',
      );
    }
    if (
      operation.stripeCustomerId !== lockedOwner.stripeCustomerId
      || operation.stripeBaseSubscriptionId !== lockedOwner.stripeSubscriptionId
      || operation.basePlan !== lockedOwner.plan
    ) {
      throw new CapacityChangeOperationConflictError(
        'The base subscription changed after this paid-capacity quote.',
      );
    }
    const expired = operation.status !== 'completed'
      && operation.status !== 'canceled'
      && Date.parse(operation.expiresAt) <= Date.now();
    if (expired) {
      await cancelCapacityChangeOperation(transaction, {
        userId: lockedOwner.userId,
        operationId,
      });
    }
    return { operation, expired };
  });
}

async function bindPendingPayment(
  owner: CapacityBillingOwner,
  operation: CapacityChangeOperation,
  outcome: AppliedCapacityChange,
): Promise<void> {
  if (!outcome.invoiceId) {
    throw new Error('Stripe returned a pending capacity change without an invoice.');
  }
  const expiresAt = new Date(
    (outcome.pendingExpiresAtSeconds
      ?? Math.floor(Date.now() / 1_000) + INITIAL_PAYMENT_TTL_SECONDS) * 1_000,
  ).toISOString();
  await capacityDatabase().begin(async (rawTransaction) => {
    const transaction = rawTransaction as CapacityChangeSql;
    await lockCapacityBillingOwner(transaction, owner);
    await bindPendingCapacityPayment(transaction, {
      userId: owner.userId,
      operationId: operation.operationId,
      stripeSubscriptionId: outcome.snapshot.subscriptionId,
      stripeInvoiceId: outcome.invoiceId!,
      expiresAt,
    });
  });
}

async function cancelOpenOperation(
  owner: CapacityBillingOwner,
  operationId: string,
): Promise<void> {
  await capacityDatabase().begin(async (rawTransaction) => {
    const transaction = rawTransaction as CapacityChangeSql;
    await lockCapacityBillingOwner(transaction, owner);
    await cancelCapacityChangeOperation(transaction, {
      userId: owner.userId,
      operationId,
    });
  });
}

function pendingPaymentResponse(
  operationId: string,
  outcome: AppliedCapacityChange,
): NextResponse {
  if (!outcome.clientSecret) {
    return NextResponse.json(
      {
        error: 'Stripe could not charge the saved card. Update the payment method and try again.',
        code: 'CAPACITY_PAYMENT_FAILED',
        operationId,
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    {
      error: 'Confirm the card payment to finish this capacity change.',
      code: 'CAPACITY_PAYMENT_ACTION_REQUIRED',
      operationId,
      clientSecret: outcome.clientSecret,
      invoiceId: outcome.invoiceId,
    },
    { status: 402 },
  );
}

async function finalizeOutcome(
  owner: CapacityBillingOwner,
  operation: CapacityChangeOperation,
  outcome: AppliedCapacityChange,
): Promise<NextResponse> {
  const finalized = await finalizeAppliedCapacityChange(capacityDatabase(), {
    owner,
    operationId: operation.operationId,
    snapshot: outcome.snapshot,
    stripeInvoiceId: outcome.invoiceId,
  });
  return NextResponse.json({
    success: true,
    status: 'applied',
    operationId: finalized.operation.operationId,
    paidCapacity: operation.to,
    archivedBrands: finalized.archivedBrands,
    archivedLocations: finalized.archivedLocations,
  });
}

async function handlePreview(
  userId: number,
  requestId: string,
  target: PaidCapacityQuantities,
  requestedRetention?: DowngradeRetentionSelection,
): Promise<NextResponse> {
  const owner = await readOwner(userId);
  const state = await readVerifiedStripeState(owner);
  const current = snapshotQuantities(state.capacity.current);
  const direction = capacityChangeDirection(current, target);
  if (direction === 'mixed') {
    throw new CapacityApiError(
      'CAPACITY_MIXED_CHANGE',
      409,
      'Increase and decrease paid capacity as two separate confirmed changes.',
    );
  }
  if (state.base.hasPendingPlanChange) {
    throw new CapacityApiError(
      'BASE_PLAN_CHANGE_PENDING',
      409,
      'Finish the pending base-plan change before changing paid capacity.',
    );
  }
  if (direction === 'increase' && !state.base.canIncrease) {
    throw new CapacityApiError(
      'ACTIVE_BASE_SUBSCRIPTION_REQUIRED',
      409,
      'An active paid plan with no pending plan change is required to buy more capacity.',
    );
  }
  if (
    state.capacity.current
    && state.capacity.current.status !== 'active'
    && !(state.capacity.current.status === 'past_due' && direction === 'decrease')
  ) {
    throw new CapacityApiError(
      'CAPACITY_PAYMENT_PENDING',
      409,
      'Finish the existing capacity payment before starting another change.',
    );
  }

  const operation = await prepareQuoteOperation({
    owner,
    state,
    operationId: requestId,
    target,
    direction,
    requestedRetention,
  });
  if (operation.status !== 'prepared') {
    throw new CapacityChangeOperationConflictError(
      'This paid-capacity change has already moved to payment confirmation.',
    );
  }
  const quote = await previewCapacityInvoice(stripe, {
    stripeCustomerId: owner.stripeCustomerId,
    current: state.capacity.current,
    target: operation.to,
    prorationDateSeconds: operation.prorationDateSeconds,
    prices: STRIPE_CAPACITY_PRICE_CONFIGURATION,
  });
  return NextResponse.json({
    operationId: operation.operationId,
    expiresAt: operation.expiresAt,
    current,
    target: operation.to,
    quote,
  });
}

async function handleConfirm(
  userId: number,
  operationId: string,
): Promise<NextResponse> {
  const owner = await readOwner(userId);
  const locked = await readOperationForConfirmation(owner, operationId);
  const operation = locked.operation;
  if (locked.expired || operation.status === 'canceled') {
    throw new CapacityApiError(
      'CAPACITY_QUOTE_EXPIRED',
      409,
      'This capacity quote expired. Review the current price again.',
    );
  }
  if (operation.status === 'completed') {
    return NextResponse.json({
      success: true,
      status: 'applied',
      operationId: operation.operationId,
      paidCapacity: operation.to,
      alreadyCompleted: true,
    });
  }

  const state = await readVerifiedStripeState(owner, true);
  if (operation.basePlan !== state.base.plan) {
    throw new CapacityChangeOperationConflictError(
      'The base plan changed after this paid-capacity quote.',
    );
  }
  const direction = capacityChangeDirection(operation.from, operation.to);
  if (direction === 'mixed') {
    throw new Error('A stored paid-capacity operation contains a mixed change.');
  }
  if (state.base.hasPendingPlanChange) {
    throw new CapacityApiError(
      'BASE_PLAN_CHANGE_PENDING',
      409,
      'Finish the pending base-plan change before changing paid capacity.',
    );
  }
  if (direction === 'increase' && !state.base.canIncrease) {
    throw new CapacityApiError(
      'ACTIVE_BASE_SUBSCRIPTION_REQUIRED',
      409,
      'The base subscription is no longer eligible for this capacity purchase.',
    );
  }

  const stripeSubscription = state.capacity.currentSubscription;
  const authoritative = state.capacity.authoritative;
  let outcome: AppliedCapacityChange | null = null;
  if (operation.status === 'pending_payment') {
    if (!operation.stripeSubscriptionId) {
      throw new Error('Pending capacity payment has no Stripe subscription.');
    }
    if (!operation.stripeInvoiceId) {
      throw new Error('Pending capacity payment has no Stripe invoice.');
    }
    await retryPendingCapacityInvoicePayment(stripe, {
      operationId: operation.operationId,
      stripeInvoiceId: operation.stripeInvoiceId,
      stripeCustomerId: owner.stripeCustomerId,
      customer: state.capacity.customer,
    });
    try {
      outcome = await readCapacityChangeOutcome(stripe, {
        stripeSubscriptionId: operation.stripeSubscriptionId,
        stripeCustomerId: owner.stripeCustomerId,
        target: operation.to,
        prices: STRIPE_CAPACITY_PRICE_CONFIGURATION,
      });
    } catch (error) {
      if (
        error instanceof CapacityChangeError
        && error.code === 'CAPACITY_CHANGE_NOT_APPLIED'
      ) {
        await cancelOpenOperation(owner, operation.operationId);
        throw new CapacityApiError(
          'CAPACITY_PAYMENT_EXPIRED',
          409,
          'The pending payment expired or failed. Review the current price and try again.',
        );
      }
      throw error;
    }
    if (outcome.invoiceId !== operation.stripeInvoiceId) {
      throw new Error('Stripe pending capacity invoice does not match the durable operation.');
    }
  } else if (stripeSubscription && authoritative) {
    const isOperationSubscription = operation.stripeSubscriptionId === authoritative.subscriptionId;
    const isRecoveredNewSubscription = operation.stripeSubscriptionId === null
      && stripeSubscription.metadata.app_capacity_operation_id === operation.operationId;
    const appliedQuantities = effectivePaidCapacity(authoritative.status, authoritative);
    const looksApplied = quantitiesMatch(appliedQuantities, operation.to);
    if (
      isRecoveredNewSubscription
      || (isOperationSubscription && (stripeSubscription.pending_update || looksApplied))
    ) {
      outcome = await readCapacityChangeOutcome(stripe, {
        stripeSubscriptionId: authoritative.subscriptionId,
        stripeCustomerId: owner.stripeCustomerId,
        target: operation.to,
        prices: STRIPE_CAPACITY_PRICE_CONFIGURATION,
      });
    }
  }

  if (!outcome) {
    const current = snapshotQuantities(state.capacity.current);
    if (
      !quantitiesMatch(current, operation.from)
      || (operation.stripeSubscriptionId !== null
        && operation.stripeSubscriptionId !== state.capacity.current?.subscriptionId)
    ) {
      throw new CapacityChangeOperationConflictError(
        'Stripe capacity changed after this quote. Review the current price again.',
      );
    }
    outcome = await applyCapacityChange(stripe, {
      operationId: operation.operationId,
      userId: owner.userId,
      stripeCustomerId: owner.stripeCustomerId,
      current: state.capacity.current,
      target: operation.to,
      prorationDateSeconds: operation.prorationDateSeconds,
      prices: STRIPE_CAPACITY_PRICE_CONFIGURATION,
    });
  }

  if (outcome.status === 'pending_payment') {
    await bindPendingPayment(owner, operation, outcome);
    return pendingPaymentResponse(operation.operationId, outcome);
  }
  return finalizeOutcome(owner, operation, outcome);
}

export async function GET() {
  try {
    const authenticated = await requireAuthenticatedAccount();
    assertFeatureEnabled();
    const owner = await readOwner(authenticated.account.id);
    const state = await readVerifiedStripeState(owner, true);
    const paidCapacity = effectivePaidCapacity(
      state.capacity.authoritative?.status ?? null,
      snapshotQuantities(state.capacity.authoritative),
    );
    const pendingOperation = await readPendingCapacityChangeOperation(
      sql as CapacityChangeSql,
      owner.userId,
    );
    return NextResponse.json({
      enabled: true,
      canPurchase: state.base.canIncrease,
      basePlan: state.base.plan,
      paidCapacity,
      effectiveLimits: effectiveCapacityLimits(state.base.plan, paidCapacity),
      catalogue: CAPACITY_ADDON_CATALOG,
      pendingPayment: state.capacity.currentSubscription?.status === 'incomplete'
        || Boolean(state.capacity.currentSubscription?.pending_update)
        || pendingOperation !== null,
      pendingOperation: pendingOperation
        ? {
            operationId: pendingOperation.operationId,
            target: pendingOperation.to,
            expiresAt: pendingOperation.expiresAt,
          }
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();
    assertFeatureEnabled();
    const parsed = requestSchema.safeParse(await readStripeMutationJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    assertLegacyAccountId(parsed.data.userId, authenticated.account.id);
    if (parsed.data.action === 'preview') {
      return handlePreview(
        authenticated.account.id,
        parsed.data.requestId,
        parsed.data.target,
        parsed.data.retention,
      );
    }
    return handleConfirm(authenticated.account.id, parsed.data.operationId);
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown): NextResponse {
  if (
    error instanceof CapacityApiError
    || error instanceof CapacityChangeError
    || error instanceof CapacityChangeOperationConflictError
    || error instanceof DowngradeCapacityError
    || error instanceof StripeCustomerOwnershipError
    || error instanceof StripeMutationRequestError
  ) {
    const code = 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'CAPACITY_CHANGE_FAILED';
    return NextResponse.json(
      { error: error.message, code },
      { status: error.status },
    );
  }
  if (error instanceof AccountAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[Stripe Capacity] Error:', error);
  return NextResponse.json(
    { error: 'Unable to change paid capacity. Please try again.' },
    { status: 500 },
  );
}
