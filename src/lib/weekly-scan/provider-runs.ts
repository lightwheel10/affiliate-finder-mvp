import { createHash } from 'node:crypto';

export const WEEKLY_SCAN_PROVIDERS = [
  'google',
  'youtube',
  'instagram',
  'tiktok',
] as const;

export type WeeklyScanProvider = typeof WEEKLY_SCAN_PROVIDERS[number];

export type WeeklyProviderExternalStatus =
  | 'READY'
  | 'RUNNING'
  | 'ABORTING'
  | 'TIMING-OUT'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ABORTED'
  | 'TIMED-OUT';

export interface WeeklyProviderLaunchInput {
  provider: WeeklyScanProvider;
  inputFingerprint: string;
  correlationId: string;
}

export interface WeeklyProviderSettlement {
  outcome: 'succeeded' | 'failed' | 'uncertain';
  providerRunId?: string;
  exactCostUsd: number | null;
  errorMessage?: string;
}

export interface WeeklyProviderResumeState {
  status: 'dispatching' | 'running' | WeeklyProviderSettlement['outcome'];
  providerRunId: string | null;
  exactCostUsd: number | null;
  dispatchedAt: string | null;
}

export interface WeeklyProviderExecution<TData> {
  outcome: WeeklyProviderSettlement['outcome'] | 'deferred';
  launched: boolean;
  providerRunId: string | null;
  exactCostUsd: number | null;
  data: TData | null;
}

export interface WeeklyProviderExecutionDependencies<TData> {
  loadExisting(input: WeeklyProviderLaunchInput): Promise<WeeklyProviderResumeState | null>;
  prepare(input: WeeklyProviderLaunchInput): Promise<void>;
  start(input: WeeklyProviderLaunchInput): Promise<string>;
  recordRun(input: WeeklyProviderLaunchInput, providerRunId: string): Promise<void>;
  inspect(providerRunId: string): Promise<{ status: WeeklyProviderExternalStatus }>;
  fetchExactCost(providerRunId: string): Promise<number | null>;
  settle(
    input: WeeklyProviderLaunchInput,
    settlement: WeeklyProviderSettlement,
  ): Promise<void>;
  fetchResults(providerRunId: string): Promise<TData>;
  abort(providerRunId: string): Promise<void>;
  sleep(milliseconds: number): Promise<void>;
  pollIntervalMs: number;
  maxPollDurationMs: number;
  maxProviderAgeMs: number;
  costStabilizationDelayMs: number;
  now?: () => number;
}

const TERMINAL_PROVIDER_STATUSES = new Set<WeeklyProviderExternalStatus>([
  'SUCCEEDED',
  'FAILED',
  'ABORTED',
  'TIMED-OUT',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 2_000) || 'Unknown provider failure';
}

function startMayHaveSucceeded(error: unknown): boolean {
  if (
    typeof error === 'object'
    && error !== null
    && 'externalStartMayHaveSucceeded' in error
    && typeof error.externalStartMayHaveSucceeded === 'boolean'
  ) {
    return error.externalStartMayHaveSucceeded;
  }
  return true;
}

function assertExecutionConfiguration(
  input: WeeklyProviderLaunchInput,
  dependencies: WeeklyProviderExecutionDependencies<unknown>,
): void {
  if (!WEEKLY_SCAN_PROVIDERS.includes(input.provider)) {
    throw new Error('Weekly provider is invalid.');
  }
  if (!/^[0-9a-f]{64}$/.test(input.inputFingerprint)) {
    throw new Error('Weekly provider input fingerprint is invalid.');
  }
  if (
    input.correlationId.length === 0
    || input.correlationId.length > 255
    || /[\u0000-\u001f\u007f]/.test(input.correlationId)
  ) {
    throw new Error('Weekly provider correlation ID is invalid.');
  }
  if (
    !Number.isSafeInteger(dependencies.pollIntervalMs)
    || dependencies.pollIntervalMs <= 0
    || !Number.isSafeInteger(dependencies.maxPollDurationMs)
    || dependencies.maxPollDurationMs <= 0
    || !Number.isSafeInteger(dependencies.maxProviderAgeMs)
    || dependencies.maxProviderAgeMs < dependencies.maxPollDurationMs
    || !Number.isSafeInteger(dependencies.costStabilizationDelayMs)
    || dependencies.costStabilizationDelayMs < 0
  ) {
    throw new Error('Weekly provider polling limits are invalid.');
  }
}

function readResumeTime(value: string | null): number | null {
  if (value === null) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function validateResumeState(state: WeeklyProviderResumeState): void {
  const hasRun = typeof state.providerRunId === 'string'
    && state.providerRunId.trim().length > 0;
  const dispatchedAt = readResumeTime(state.dispatchedAt);
  if (state.status === 'dispatching') {
    if (state.providerRunId !== null || state.dispatchedAt !== null || state.exactCostUsd !== null) {
      throw new Error('Dispatching weekly provider state is invalid.');
    }
    return;
  }
  const hasDispatchIdentity = hasRun && dispatchedAt !== null;
  const hasNoDispatchIdentity = state.providerRunId === null && state.dispatchedAt === null;
  if (
    (state.status === 'running' || state.status === 'succeeded')
    && !hasDispatchIdentity
  ) {
    throw new Error('Recorded weekly provider state is missing its run identity.');
  }
  if (
    (state.status === 'failed' || state.status === 'uncertain')
    && !hasDispatchIdentity
    && !hasNoDispatchIdentity
  ) {
    throw new Error('Recorded weekly provider state has an incomplete run identity.');
  }
  if (
    state.exactCostUsd !== null
    && (!Number.isFinite(state.exactCostUsd) || state.exactCostUsd < 0)
  ) {
    throw new Error('Recorded weekly provider cost is invalid.');
  }
  if (state.status === 'running' && state.exactCostUsd !== null) {
    throw new Error('A running weekly provider cannot already have a final cost.');
  }
  if (!hasDispatchIdentity && state.exactCostUsd !== null) {
    throw new Error('A weekly provider cost requires a recorded run identity.');
  }
}

async function readExactCost(
  providerRunId: string,
  fetchExactCost: (runId: string) => Promise<number | null>,
): Promise<number | null> {
  try {
    const cost = await fetchExactCost(providerRunId);
    if (cost === null) return null;
    if (!Number.isFinite(cost) || cost < 0) return null;
    return Number(cost.toFixed(6));
  } catch {
    // Cost collection is evidence, not a reason to discard valid results. A
    // NULL receipt is honest and can be investigated; a guessed total is not.
    return null;
  }
}

export function weeklyProviderCorrelationId(input: {
  batchId: string;
  brandLocationId: string;
  provider: WeeklyScanProvider;
}): string {
  if (!UUID_PATTERN.test(input.batchId)) {
    throw new Error('Weekly provider correlation requires a canonical batch UUID.');
  }
  if (!/^[1-9][0-9]{0,18}$/.test(input.brandLocationId)) {
    throw new Error('Weekly provider correlation requires a positive location ID.');
  }
  if (!WEEKLY_SCAN_PROVIDERS.includes(input.provider)) {
    throw new Error('Weekly provider correlation requires a supported provider.');
  }
  return `weekly-provider:${input.batchId.toLowerCase()}:${input.brandLocationId}:${input.provider}`;
}

export function weeklyProviderInputFingerprint(
  provider: WeeklyScanProvider,
  canonicalInput: unknown,
): string {
  if (!WEEKLY_SCAN_PROVIDERS.includes(provider)) {
    throw new Error('Weekly provider fingerprint requires a supported provider.');
  }
  const serialized = JSON.stringify({ provider, input: canonicalInput });
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > 1_100_000) {
    throw new Error('Weekly provider input cannot be fingerprinted safely.');
  }
  return createHash('sha256').update(serialized).digest('hex');
}

export function sumExactWeeklyProviderCosts(
  executions: readonly Pick<WeeklyProviderExecution<unknown>, 'launched' | 'exactCostUsd'>[],
): number | null {
  const launched = executions.filter(({ launched }) => launched);
  if (launched.length === 0 || launched.some(({ exactCostUsd }) => exactCostUsd === null)) {
    return null;
  }
  const total = launched.reduce((sum, { exactCostUsd }) => {
    if (!Number.isFinite(exactCostUsd) || (exactCostUsd as number) < 0) {
      throw new Error('Weekly provider cost is invalid.');
    }
    return sum + (exactCostUsd as number);
  }, 0);
  return Number(total.toFixed(6));
}

/**
 * Runs one paid provider behind a durable launch receipt. Preparation is
 * committed before the network call; every known run is recorded immediately;
 * ambiguous starts and status failures are never replayed automatically.
 */
export async function executeWeeklyProvider<TData>(
  input: WeeklyProviderLaunchInput,
  dependencies: WeeklyProviderExecutionDependencies<TData>,
): Promise<WeeklyProviderExecution<TData>> {
  assertExecutionConfiguration(input, dependencies);
  const now = dependencies.now ?? Date.now;
  const existing = await dependencies.loadExisting(input);

  if (existing !== null) {
    validateResumeState(existing);
    if (existing.status === 'dispatching') {
      return {
        outcome: 'uncertain',
        launched: false,
        providerRunId: null,
        exactCostUsd: null,
        data: null,
      };
    }
    if (existing.status === 'succeeded') {
      const data = await dependencies.fetchResults(existing.providerRunId as string);
      return {
        outcome: 'succeeded',
        launched: true,
        providerRunId: existing.providerRunId,
        exactCostUsd: existing.exactCostUsd,
        data,
      };
    }
    if (existing.status === 'failed' || existing.status === 'uncertain') {
      return {
        outcome: existing.status,
        launched: existing.providerRunId !== null,
        providerRunId: existing.providerRunId,
        exactCostUsd: existing.exactCostUsd,
        data: null,
      };
    }
  } else {
    await dependencies.prepare(input);
  }

  let providerRunId: string;
  let providerStartedAt: number;
  if (existing?.status === 'running') {
    providerRunId = existing.providerRunId as string;
    providerStartedAt = readResumeTime(existing.dispatchedAt) as number;
  } else {
    try {
      providerRunId = await dependencies.start(input);
    } catch (error) {
      const outcome = startMayHaveSucceeded(error) ? 'uncertain' : 'failed';
      await dependencies.settle(input, {
        outcome,
        exactCostUsd: null,
        errorMessage: boundedError(error),
      });
      return { outcome, launched: false, providerRunId: null, exactCostUsd: null, data: null };
    }

    try {
      await dependencies.recordRun(input, providerRunId);
    } catch (recordError) {
      let abortError: unknown;
      try {
        await dependencies.abort(providerRunId);
      } catch (error) {
        abortError = error;
      }

      if (abortError !== undefined) {
        await dependencies.settle(input, {
          outcome: 'uncertain',
          providerRunId,
          exactCostUsd: null,
          errorMessage: `${boundedError(recordError)}; abort failed: ${boundedError(abortError)}`,
        });
        return {
          outcome: 'uncertain',
          launched: true,
          providerRunId,
          exactCostUsd: null,
          data: null,
        };
      }

      await dependencies.sleep(dependencies.costStabilizationDelayMs);
      const exactCostUsd = await readExactCost(providerRunId, dependencies.fetchExactCost);
      await dependencies.settle(input, {
        outcome: 'failed',
        providerRunId,
        exactCostUsd,
        errorMessage: `Provider run was aborted after receipt persistence failed: ${boundedError(recordError)}`,
      });
      return { outcome: 'failed', launched: true, providerRunId, exactCostUsd, data: null };
    }
    providerStartedAt = now();
  }

  const requestDeadline = now() + dependencies.maxPollDurationMs;
  const providerDeadline = providerStartedAt + dependencies.maxProviderAgeMs;
  let status: WeeklyProviderExternalStatus;
  while (true) {
    try {
      status = (await dependencies.inspect(providerRunId)).status;
    } catch (error) {
      if (now() < providerDeadline) {
        return { outcome: 'deferred', launched: true, providerRunId, exactCostUsd: null, data: null };
      }
      await dependencies.settle(input, {
        outcome: 'uncertain', providerRunId, exactCostUsd: null, errorMessage: boundedError(error),
      });
      return { outcome: 'uncertain', launched: true, providerRunId, exactCostUsd: null, data: null };
    }
    if (TERMINAL_PROVIDER_STATUSES.has(status)) break;
    if (
      status !== 'READY'
      && status !== 'RUNNING'
      && status !== 'ABORTING'
      && status !== 'TIMING-OUT'
    ) {
      const error = new Error(`Provider returned unsupported status ${String(status)}.`);
      await dependencies.settle(input, {
        outcome: 'uncertain', providerRunId, exactCostUsd: null, errorMessage: boundedError(error),
      });
      return { outcome: 'uncertain', launched: true, providerRunId, exactCostUsd: null, data: null };
    }
    if (now() >= providerDeadline) {
      const error = new Error('Provider exceeded its maximum continuation age.');
      await dependencies.settle(input, {
        outcome: 'uncertain', providerRunId, exactCostUsd: null, errorMessage: boundedError(error),
      });
      return { outcome: 'uncertain', launched: true, providerRunId, exactCostUsd: null, data: null };
    }
    if (now() >= requestDeadline) {
      return { outcome: 'deferred', launched: true, providerRunId, exactCostUsd: null, data: null };
    }
    await dependencies.sleep(dependencies.pollIntervalMs);
  }

  // Apify documents that the first completed response can still contain
  // preliminary usage totals. Delay the billing read rather than labelling a
  // still-settling value as exact customer/provider cost.
  await dependencies.sleep(dependencies.costStabilizationDelayMs);
  const exactCostUsd = await readExactCost(providerRunId, dependencies.fetchExactCost);
  if (status !== 'SUCCEEDED') {
    await dependencies.settle(input, {
      outcome: 'failed',
      providerRunId,
      exactCostUsd,
      errorMessage: `Provider run ended with ${status}.`,
    });
    return { outcome: 'failed', launched: true, providerRunId, exactCostUsd, data: null };
  }

  await dependencies.settle(input, {
    outcome: 'succeeded',
    providerRunId,
    exactCostUsd,
  });
  const data = await dependencies.fetchResults(providerRunId);
  return { outcome: 'succeeded', launched: true, providerRunId, exactCostUsd, data };
}
