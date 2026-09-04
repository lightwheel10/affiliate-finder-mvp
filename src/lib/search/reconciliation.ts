import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { EnrichmentPlatform } from '@/lib/search/enrichment-dispatch';
import type { SearchSettingsSnapshot } from '@/lib/search/start';

export const RECONCILIATION_ACTIONS = [
  'attach_provider_run',
  'confirm_no_run',
  'cancel_and_refund',
] as const;

export type ReconciliationAction = typeof RECONCILIATION_ACTIONS[number];
export type ReconciliationCaseType =
  | 'enrichment_dispatch'
  | 'onboarding_search'
  | 'paid_search';
export type ReconciliationCaseStatus = 'open' | 'resolved';

export interface SearchReconciliationCase {
  id: string;
  caseType: ReconciliationCaseType;
  status: ReconciliationCaseStatus;
  version: number;
  accountId: number;
  accountEmail: string;
  brandId: string;
  brandLocationId: string;
  searchJobId: number | null;
  dispatchId: string | null;
  platform: EnrichmentPlatform | null;
  requestId: string | null;
  sourceStatus: string;
  sourceErrorMessage: string;
  sourceLaunchAttemptedAt: string;
  inputUrls: string[] | null;
  inputFingerprint: string | null;
  canAttachProviderRun: boolean;
  canCancelAndRefund: boolean;
  settingsSnapshot: SearchSettingsSnapshot | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: ReconciliationAction | null;
  resolutionNote: string | null;
  providerRunId: string | null;
  resolvedByEmail: string | null;
}

export const resolveReconciliationSchema = z.object({
  action: z.enum(RECONCILIATION_ACTIONS),
  expectedVersion: z.number().int().positive(),
  note: z.string().trim().min(10).max(1_000),
  providerRunId: z.string().trim().min(1).max(255)
    .regex(/^[^\u0000-\u001f\u007f]+$/)
    .optional(),
  confirmation: z.string().trim().max(80),
}).strict().superRefine((value, context) => {
  if (value.action === 'attach_provider_run' && !value.providerRunId) {
    context.addIssue({
      code: 'custom',
      path: ['providerRunId'],
      message: 'A provider run ID is required when attaching a run.',
    });
  }
  if (value.action !== 'attach_provider_run' && value.providerRunId) {
    context.addIssue({
      code: 'custom',
      path: ['providerRunId'],
      message: 'A provider run ID is only accepted for an attach action.',
    });
  }
});

export type ResolveReconciliationInput = z.infer<typeof resolveReconciliationSchema>;

const CONFIRMATIONS: Record<ReconciliationAction, string> = {
  attach_provider_run: 'ATTACH VERIFIED RUN',
  confirm_no_run: 'CONFIRM NO RUN',
  cancel_and_refund: 'CANCEL AND REFUND',
};

export function expectedReconciliationConfirmation(
  action: ReconciliationAction,
): string {
  return CONFIRMATIONS[action];
}

export function assertActionAllowed(
  reconciliationCase: SearchReconciliationCase,
  input: ResolveReconciliationInput,
): void {
  if (reconciliationCase.status !== 'open') {
    throw new ReconciliationConflictError('This reconciliation case is already resolved.');
  }
  if (input.expectedVersion !== reconciliationCase.version) {
    throw new ReconciliationConflictError(
      'This case changed after it was loaded. Refresh before taking action.',
    );
  }
  if (input.confirmation !== expectedReconciliationConfirmation(input.action)) {
    throw new ReconciliationInputError('The confirmation phrase does not match the action.');
  }
  if (input.action === 'attach_provider_run' && !reconciliationCase.canAttachProviderRun) {
    throw new ReconciliationConflictError(
      'This pre-migration provider run cannot be attached safely.',
    );
  }
  if (reconciliationCase.caseType !== 'enrichment_dispatch'
      && input.action === 'cancel_and_refund') {
    throw new ReconciliationInputError(
      reconciliationCase.caseType === 'onboarding_search'
        ? 'An onboarding search has no topic-search credit to refund.'
        : 'Use confirm-no-run after verifying that the paid provider run does not exist.',
    );
  }
  if (input.action === 'cancel_and_refund' && !reconciliationCase.canCancelAndRefund) {
    throw new ReconciliationConflictError(
      'This search has no reserved topic-search credit to refund.',
    );
  }
}

export class ReconciliationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationInputError';
  }
}

export class ReconciliationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationConflictError';
  }
}

export class ReconciliationProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ReconciliationProviderError';
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function jsonFingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReconciliationInputError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ReconciliationInputError(`${field} is missing.`);
  }
  return value;
}

function stringArray(value: unknown, field: string, allowEmpty = false): string[] {
  if (
    !Array.isArray(value)
    || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== 'string' || item.trim() === '')
  ) {
    throw new ReconciliationInputError(`${field} must be a non-empty string array.`);
  }
  return [...value] as string[];
}

/** Validates an immutable v1 snapshot before repairing a primary search. */
export function parseReconciliationSettingsSnapshot(
  value: unknown,
  expectedCaseType: 'onboarding_search' | 'paid_search' = 'onboarding_search',
): SearchSettingsSnapshot {
  const snapshot = record(value, 'settings_snapshot');
  if (snapshot.version !== 1) {
    throw new ReconciliationInputError('Only settings snapshot version 1 is supported.');
  }
  const brand = record(snapshot.brand, 'settings_snapshot.brand');
  const location = record(snapshot.location, 'settings_snapshot.location');
  const search = record(snapshot.search, 'settings_snapshot.search');
  const sources = stringArray(search.sources, 'settings_snapshot.search.sources');
  const allowedSources = new Set(['Web', 'YouTube', 'Instagram', 'TikTok']);
  if (sources.some((source) => !allowedSources.has(source))) {
    throw new ReconciliationInputError('The settings snapshot contains an unknown source.');
  }
  const requestId = text(search.requestId, 'settings_snapshot.search.requestId');
  const expectsOnboarding = expectedCaseType === 'onboarding_search';
  if (expectsOnboarding ? search.isOnboarding !== true : search.isOnboarding !== undefined) {
    throw new ReconciliationInputError(
      expectsOnboarding
        ? 'The settings snapshot is not an onboarding search.'
        : 'The settings snapshot is not a paid search.',
    );
  }
  const providerCorrelationId = search.providerCorrelationId === undefined
    ? undefined
    : text(
      search.providerCorrelationId,
      'settings_snapshot.search.providerCorrelationId',
    );
  return {
    version: 1,
    brand: {
      id: text(brand.id, 'settings_snapshot.brand.id'),
      name: text(brand.name, 'settings_snapshot.brand.name'),
      normalizedDomain: brand.normalizedDomain === null
        ? null
        : text(brand.normalizedDomain, 'settings_snapshot.brand.normalizedDomain'),
    },
    location: {
      id: text(location.id, 'settings_snapshot.location.id'),
      countryCode: text(location.countryCode, 'settings_snapshot.location.countryCode'),
      countryName: text(location.countryName, 'settings_snapshot.location.countryName'),
      languageCode: text(location.languageCode, 'settings_snapshot.location.languageCode'),
      languageName: text(location.languageName, 'settings_snapshot.location.languageName'),
    },
    search: {
      keywords: stringArray(search.keywords, 'settings_snapshot.search.keywords'),
      competitors: Array.isArray(search.competitors)
        ? stringArray(search.competitors, 'settings_snapshot.search.competitors', true)
        : [],
      sources: sources as SearchSettingsSnapshot['search']['sources'],
      requestId,
      ...(providerCorrelationId ? { providerCorrelationId } : {}),
      ...(expectsOnboarding ? { isOnboarding: true as const } : {}),
    },
  };
}
