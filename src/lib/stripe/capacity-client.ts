/** Client-safe contracts for the paid-capacity API. */

export interface PaidQuantities {
  extraBrands: number;
  extraLocations: number;
}

export type CapacityKind = 'brand' | 'location';

/** Change one billable resource while preserving the other exact quantity. */
export function buildCapacityTarget(
  current: PaidQuantities,
  kind: CapacityKind,
  targetExtra: number,
): PaidQuantities {
  const validTarget = readNonNegativeInteger(targetExtra, 'target quantity');
  return kind === 'brand'
    ? { ...current, extraBrands: validTarget }
    : { ...current, extraLocations: validTarget };
}

export function needsCapacityRetention(
  active: { brands: number; locations: number },
  limits: { brands: number; locations: number },
): boolean {
  return active.brands > limits.brands || active.locations > limits.locations;
}

export interface CapacityOverview {
  enabled: true;
  canPurchase: boolean;
  basePlan: 'pro' | 'business';
  paidCapacity: PaidQuantities;
  effectiveLimits: {
    maxBrands: number;
    maxLocationsPerAccount: number;
  };
  catalogue: {
    brand: { monthlyEur: number; maxQuantity: number };
    location: { monthlyEur: number; maxQuantity: number };
  };
  pendingPayment: boolean;
  pendingOperation: {
    operationId: string;
    target: PaidQuantities;
    expiresAt: string;
  } | null;
}

export interface CapacityQuote {
  operationId: string;
  expiresAt: string;
  current: PaidQuantities;
  target: PaidQuantities;
  quote: {
    currency: 'eur';
    amountDueNowCents: number;
    prorationCents: number;
    monthlySubtotalCents: number;
  };
}

export interface CapacitySuccess {
  success: true;
  status: 'applied';
  operationId: string;
  paidCapacity: PaidQuantities;
  archivedBrands?: number;
  archivedLocations?: number;
}

export interface CapacityApiResult {
  response: Response;
  data: Record<string, unknown>;
}

export class CapacityUiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CapacityUiError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${label} response.`);
  return value as number;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  const integer = readInteger(value, label);
  if (integer < 0) throw new Error(`Invalid ${label} response.`);
  return integer;
}

function readPaidQuantities(value: unknown): PaidQuantities {
  if (!isRecord(value)) throw new Error('Invalid paid-capacity response.');
  return {
    extraBrands: readNonNegativeInteger(value.extraBrands, 'extra brand quantity'),
    extraLocations: readNonNegativeInteger(value.extraLocations, 'extra location quantity'),
  };
}

export function readCapacityOverview(value: unknown): CapacityOverview {
  if (!isRecord(value) || value.enabled !== true) {
    throw new Error('Invalid capacity overview response.');
  }
  if (value.basePlan !== 'pro' && value.basePlan !== 'business') {
    throw new Error('Invalid capacity plan response.');
  }
  if (!isRecord(value.effectiveLimits) || !isRecord(value.catalogue)) {
    throw new Error('Invalid capacity limits response.');
  }
  const brand = value.catalogue.brand;
  const location = value.catalogue.location;
  if (!isRecord(brand) || !isRecord(location)) {
    throw new Error('Invalid capacity catalogue response.');
  }

  let pendingOperation: CapacityOverview['pendingOperation'] = null;
  if (value.pendingOperation !== null && value.pendingOperation !== undefined) {
    if (
      !isRecord(value.pendingOperation)
      || typeof value.pendingOperation.operationId !== 'string'
      || !UUID_V4.test(value.pendingOperation.operationId)
      || typeof value.pendingOperation.expiresAt !== 'string'
      || !Number.isFinite(Date.parse(value.pendingOperation.expiresAt))
    ) {
      throw new Error('Invalid pending capacity operation response.');
    }
    pendingOperation = {
      operationId: value.pendingOperation.operationId,
      target: readPaidQuantities(value.pendingOperation.target),
      expiresAt: value.pendingOperation.expiresAt,
    };
  }

  return {
    enabled: true,
    canPurchase: value.canPurchase === true,
    basePlan: value.basePlan,
    paidCapacity: readPaidQuantities(value.paidCapacity),
    effectiveLimits: {
      maxBrands: readNonNegativeInteger(value.effectiveLimits.maxBrands, 'brand limit'),
      maxLocationsPerAccount: readNonNegativeInteger(
        value.effectiveLimits.maxLocationsPerAccount,
        'location limit',
      ),
    },
    catalogue: {
      brand: {
        monthlyEur: readNonNegativeInteger(brand.monthlyEur, 'brand price'),
        maxQuantity: readNonNegativeInteger(brand.maxQuantity, 'brand maximum'),
      },
      location: {
        monthlyEur: readNonNegativeInteger(location.monthlyEur, 'location price'),
        maxQuantity: readNonNegativeInteger(location.maxQuantity, 'location maximum'),
      },
    },
    pendingPayment: value.pendingPayment === true,
    pendingOperation,
  };
}

export function readCapacityQuote(value: unknown): CapacityQuote {
  if (
    !isRecord(value)
    || typeof value.operationId !== 'string'
    || !UUID_V4.test(value.operationId)
    || typeof value.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(value.expiresAt))
    || !isRecord(value.quote)
    || value.quote.currency !== 'eur'
  ) {
    throw new Error('Invalid Stripe price response.');
  }
  return {
    operationId: value.operationId,
    expiresAt: value.expiresAt,
    current: readPaidQuantities(value.current),
    target: readPaidQuantities(value.target),
    quote: {
      currency: 'eur',
      amountDueNowCents: readNonNegativeInteger(value.quote.amountDueNowCents, 'amount due'),
      prorationCents: readInteger(value.quote.prorationCents, 'proration'),
      monthlySubtotalCents: readNonNegativeInteger(
        value.quote.monthlySubtotalCents,
        'monthly subtotal',
      ),
    },
  };
}

export function readCapacitySuccess(value: unknown): CapacitySuccess {
  if (
    !isRecord(value)
    || value.success !== true
    || value.status !== 'applied'
    || typeof value.operationId !== 'string'
    || !UUID_V4.test(value.operationId)
  ) {
    throw new Error('Invalid capacity confirmation response.');
  }
  return {
    success: true,
    status: 'applied',
    operationId: value.operationId,
    paidCapacity: readPaidQuantities(value.paidCapacity),
    archivedBrands: value.archivedBrands === undefined
      ? undefined
      : readNonNegativeInteger(value.archivedBrands, 'archived brand count'),
    archivedLocations: value.archivedLocations === undefined
      ? undefined
      : readNonNegativeInteger(value.archivedLocations, 'archived location count'),
  };
}

export async function readCapacityApiResult(response: Response): Promise<CapacityApiResult> {
  const value = await response.json().catch(() => null);
  return { response, data: isRecord(value) ? value : {} };
}

export function capacityApiFailure(
  result: CapacityApiResult,
  fallback: string,
): CapacityUiError {
  const code = typeof result.data.code === 'string'
    ? result.data.code
    : 'CAPACITY_CHANGE_FAILED';
  const message = typeof result.data.error === 'string' ? result.data.error : fallback;
  return new CapacityUiError(code, message);
}
