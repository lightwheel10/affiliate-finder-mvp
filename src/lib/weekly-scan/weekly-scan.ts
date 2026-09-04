export const WEEKLY_SCAN_INTERVAL_DAYS = 7;
export const WEEKLY_SCAN_LEASE_MINUTES = 10;

export const WEEKLY_SCAN_TERMINAL_LOCATION_STATUSES = [
  'succeeded',
  'skipped',
  'failed',
  'uncertain',
] as const;

export type WeeklyScanLocationStatus =
  | 'pending'
  | 'claimed'
  | 'dispatching'
  | 'running'
  | (typeof WEEKLY_SCAN_TERMINAL_LOCATION_STATUSES)[number];

export type WeeklyScanBatchStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'uncertain'
  | 'no_work';

export type WeeklyScanCreditStatus =
  | 'not_required'
  | 'reserved'
  | 'consumed'
  | 'released';

export interface WeeklyScanSourceCounts {
  youtube: number;
  instagram: number;
  tiktok: number;
  web: number;
}

export interface WeeklyScanSettingsSnapshot {
  brandName: string;
  normalizedDomain: string | null;
  countryCode: string | null;
  languageCode: string | null;
  topics: string[];
  competitors: string[];
}

export interface WeeklyScanWorkItem {
  batchId: string;
  accountId: number;
  brandId: string;
  brandLocationId: string;
  claimToken: string;
  dueAt: string;
  settings: WeeklyScanSettingsSnapshot;
}

export interface WeeklyScanBatchResolution {
  status: Exclude<WeeklyScanBatchStatus, 'pending' | 'running' | 'no_work'>;
  creditStatus: Extract<WeeklyScanCreditStatus, 'consumed' | 'released'>;
}

export interface WeeklyScanWorkerFailure {
  outcome: 'failed' | 'uncertain';
  code: string;
  message: string;
}

export class WeeklyScanExecutionError extends Error {
  constructor(
    public readonly outcome: WeeklyScanWorkerFailure['outcome'],
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WeeklyScanExecutionError';
  }
}

export function classifyWeeklyScanWorkerFailure(
  error: unknown,
  providerRunRecorded: boolean,
): WeeklyScanWorkerFailure {
  if (error instanceof WeeklyScanExecutionError) {
    return {
      outcome: error.outcome,
      code: error.code,
      message: error.message,
    };
  }
  return {
    outcome: providerRunRecorded ? 'uncertain' : 'failed',
    code: providerRunRecorded
      ? 'worker_finalization_uncertain'
      : 'worker_failed_before_provider',
    message: error instanceof Error ? error.message : 'Unknown weekly scan worker error.',
  };
}

function isTerminalLocationStatus(
  status: WeeklyScanLocationStatus,
): status is (typeof WEEKLY_SCAN_TERMINAL_LOCATION_STATUSES)[number] {
  return WEEKLY_SCAN_TERMINAL_LOCATION_STATUSES.includes(
    status as (typeof WEEKLY_SCAN_TERMINAL_LOCATION_STATUSES)[number],
  );
}

/**
 * Resolve a parent only after every captured location is terminal. A provider
 * launch attempt consumes the one account credit even when the provider result
 * becomes uncertain; replaying or refunding ambiguous paid work would be an
 * abuse and double-spend risk.
 */
export function resolveWeeklyScanBatch(
  statuses: readonly WeeklyScanLocationStatus[],
  providerLaunchAttempted: boolean,
): WeeklyScanBatchResolution | null {
  if (statuses.length === 0) {
    throw new Error('A weekly scan batch must contain at least one location.');
  }
  if (!statuses.every(isTerminalLocationStatus)) return null;

  const hasSucceeded = statuses.includes('succeeded');
  const hasFailed = statuses.includes('failed');
  const hasUncertain = statuses.includes('uncertain');

  let status: WeeklyScanBatchResolution['status'];
  if (hasUncertain) status = 'uncertain';
  else if (hasSucceeded && hasFailed) status = 'partial';
  else if (hasFailed) status = 'failed';
  else status = 'completed';

  return {
    status,
    creditStatus: providerLaunchAttempted ? 'consumed' : 'released',
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function readWeeklyScanSettingsSnapshot(
  value: unknown,
): WeeklyScanSettingsSnapshot {
  let parsed = value;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Weekly scan settings snapshot is invalid.');
  }

  const candidate = parsed as Record<string, unknown>;
  const readNullableCode = (field: 'countryCode' | 'languageCode') => {
    const code = candidate[field];
    if (code === null) return null;
    if (typeof code !== 'string' || !/^[a-z]{2}$/.test(code)) {
      throw new Error(`Weekly scan ${field} is invalid.`);
    }
    return code;
  };
  const readStringArray = (field: 'topics' | 'competitors') => {
    const items = candidate[field];
    if (
      !Array.isArray(items)
      || items.length > 5
      || !items.every((item) => typeof item === 'string' && item.trim() === item && item.length > 0)
    ) {
      throw new Error(`Weekly scan ${field} are invalid.`);
    }
    return items as string[];
  };

  if (
    typeof candidate.brandName !== 'string'
    || candidate.brandName.trim() !== candidate.brandName
    || candidate.brandName.length === 0
  ) {
    throw new Error('Weekly scan brand name is invalid.');
  }
  if (
    candidate.normalizedDomain !== null
    && typeof candidate.normalizedDomain !== 'string'
  ) {
    throw new Error('Weekly scan normalized domain is invalid.');
  }

  return {
    brandName: candidate.brandName,
    normalizedDomain: candidate.normalizedDomain as string | null,
    countryCode: readNullableCode('countryCode'),
    languageCode: readNullableCode('languageCode'),
    topics: readStringArray('topics'),
    competitors: readStringArray('competitors'),
  };
}
