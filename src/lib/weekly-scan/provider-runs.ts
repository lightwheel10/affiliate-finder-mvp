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

export interface WeeklyProviderExecution<TData> {
  outcome: WeeklyProviderSettlement['outcome'];
  launched: boolean;
  providerRunId: string | null;
  exactCostUsd: number | null;
  data: TData | null;
}

export interface WeeklyProviderExecutionDependencies<TData> {
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
  ) {
    throw new Error('Weekly provider polling limits are invalid.');
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
  await dependencies.prepare(input);

  let providerRunId: string;
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

    const exactCostUsd = await readExactCost(providerRunId, dependencies.fetchExactCost);
    await dependencies.settle(input, {
      outcome: 'failed',
      providerRunId,
      exactCostUsd,
      errorMessage: `Provider run was aborted after receipt persistence failed: ${boundedError(recordError)}`,
    });
    return { outcome: 'failed', launched: true, providerRunId, exactCostUsd, data: null };
  }

  const now = dependencies.now ?? Date.now;
  const deadline = now() + dependencies.maxPollDurationMs;
  let status: WeeklyProviderExternalStatus;
  try {
    while (true) {
      status = (await dependencies.inspect(providerRunId)).status;
      if (TERMINAL_PROVIDER_STATUSES.has(status)) break;
      if (
        status !== 'READY'
        && status !== 'RUNNING'
        && status !== 'ABORTING'
        && status !== 'TIMING-OUT'
      ) {
        throw new Error(`Provider returned unsupported status ${String(status)}.`);
      }
      if (now() >= deadline) {
        throw new Error('Provider polling exceeded its safe time limit.');
      }
      await dependencies.sleep(dependencies.pollIntervalMs);
    }
  } catch (error) {
    const exactCostUsd = await readExactCost(providerRunId, dependencies.fetchExactCost);
    await dependencies.settle(input, {
      outcome: 'uncertain',
      providerRunId,
      exactCostUsd,
      errorMessage: boundedError(error),
    });
    return { outcome: 'uncertain', launched: true, providerRunId, exactCostUsd, data: null };
  }

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
