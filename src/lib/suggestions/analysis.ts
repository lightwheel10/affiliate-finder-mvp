import { createHash } from 'node:crypto';
import type { SuggestionAnalysisResult } from '@/lib/suggestions/result';

export interface SuggestionAnalysisInput {
  normalizedDomain: string;
  targetCountry: string | null;
  targetLanguage: string | null;
}

export interface SuggestionAnalysisClaimInput {
  accountId: number;
  authUserId: string;
  requestId: string;
  inputHash: string;
  inputSnapshot: SuggestionAnalysisInput;
}

export type SuggestionAnalysisClaim =
  | { outcome: 'claimed' }
  | { outcome: 'cached'; result: SuggestionAnalysisResult }
  | {
      outcome: 'blocked';
      reason: 'account_not_eligible' | 'in_progress' | 'already_used';
    };

export type SuggestionProviderOutcome =
  | { success: true; result: SuggestionAnalysisResult }
  | { success: false; error: string; userMessage: string };

export type SuggestionAnalysisOutcome =
  | { success: true; result: SuggestionAnalysisResult; cached: boolean }
  | { success: false; error: string; userMessage: string };

export interface SuggestionAnalysisDependencies {
  claim(input: SuggestionAnalysisClaimInput): Promise<SuggestionAnalysisClaim>;
  markProvidersStarted(
    accountId: number,
    requestId: string,
    inputHash: string,
  ): Promise<void>;
  runProviders(input: SuggestionAnalysisInput): Promise<SuggestionProviderOutcome>;
  complete(
    accountId: number,
    requestId: string,
    inputHash: string,
    result: SuggestionAnalysisResult,
  ): Promise<void>;
  fail(
    accountId: number,
    requestId: string,
    inputHash: string,
    errorCode: string,
  ): Promise<void>;
}

export class SuggestionAnalysisError extends Error {
  constructor(
    public readonly code:
      | 'ACCOUNT_NOT_ELIGIBLE'
      | 'ANALYSIS_IN_PROGRESS'
      | 'ANALYSIS_ALREADY_USED'
      | 'ANALYSIS_STATE_UPDATE_FAILED',
    public readonly status: number,
    public readonly userMessage: string,
    options?: ErrorOptions,
  ) {
    super(userMessage, options);
    this.name = 'SuggestionAnalysisError';
  }
}

/**
 * Creates the server-owned identity for the one onboarding analysis. The hash
 * is not an authorization token; it lets exact retries reuse the completed
 * result while a different website or market fails closed.
 */
export function fingerprintSuggestionAnalysis(input: SuggestionAnalysisInput): string {
  return createHash('sha256')
    .update(JSON.stringify([
      input.normalizedDomain,
      input.targetCountry,
      input.targetLanguage,
    ]))
    .digest('hex');
}

function blockedClaimError(reason: Extract<SuggestionAnalysisClaim, { outcome: 'blocked' }>['reason']) {
  if (reason === 'account_not_eligible') {
    return new SuggestionAnalysisError(
      'ACCOUNT_NOT_ELIGIBLE',
      409,
      'AI suggestions are available only during onboarding.',
    );
  }
  if (reason === 'in_progress') {
    return new SuggestionAnalysisError(
      'ANALYSIS_IN_PROGRESS',
      409,
      'Your website analysis is already running. Please wait for it to finish.',
    );
  }
  return new SuggestionAnalysisError(
    'ANALYSIS_ALREADY_USED',
    409,
    'The onboarding website analysis has already been used. Please continue with the saved suggestions or enter them manually.',
  );
}

function boundedFailureCode(error: string): string {
  const normalized = error
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return normalized || 'PROVIDER_FAILURE';
}

/**
 * Owns the provider-spend lifecycle. A durable claim must be committed before
 * either paid provider runs. Once provider work starts, failures are terminal
 * and the UI falls back to manual entry instead of launching an uncertain
 * duplicate charge.
 */
export async function runOnboardingSuggestionAnalysis(
  request: {
    accountId: number;
    authUserId: string;
    requestId: string;
    input: SuggestionAnalysisInput;
  },
  dependencies: SuggestionAnalysisDependencies,
): Promise<SuggestionAnalysisOutcome> {
  const inputHash = fingerprintSuggestionAnalysis(request.input);
  const claim = await dependencies.claim({
    accountId: request.accountId,
    authUserId: request.authUserId,
    requestId: request.requestId,
    inputHash,
    inputSnapshot: request.input,
  });

  if (claim.outcome === 'cached') {
    return { success: true, result: claim.result, cached: true };
  }
  if (claim.outcome === 'blocked') throw blockedClaimError(claim.reason);

  // The reserved claim is reclaimable only until this durable transition.
  // Provider work must never begin unless launch intent is committed first.
  try {
    await dependencies.markProvidersStarted(
      request.accountId,
      request.requestId,
      inputHash,
    );
  } catch (error) {
    throw new SuggestionAnalysisError(
      'ANALYSIS_STATE_UPDATE_FAILED',
      500,
      'The website analysis could not be started safely. Please enter your details manually.',
      { cause: error },
    );
  }

  let providerOutcome: SuggestionProviderOutcome;
  try {
    providerOutcome = await dependencies.runProviders(request.input);
  } catch (error) {
    try {
      await dependencies.fail(
        request.accountId,
        request.requestId,
        inputHash,
        'UNEXPECTED_PROVIDER_FAILURE',
      );
    } catch (stateError) {
      throw new SuggestionAnalysisError(
        'ANALYSIS_STATE_UPDATE_FAILED',
        500,
        'The website analysis could not be completed safely. Please enter your details manually.',
        { cause: new AggregateError([error, stateError]) },
      );
    }
    throw error;
  }

  if (!providerOutcome.success) {
    try {
      await dependencies.fail(
        request.accountId,
        request.requestId,
        inputHash,
        boundedFailureCode(providerOutcome.error),
      );
    } catch (error) {
      throw new SuggestionAnalysisError(
        'ANALYSIS_STATE_UPDATE_FAILED',
        500,
        'The website analysis could not be completed safely. Please enter your details manually.',
        { cause: error },
      );
    }
    return providerOutcome;
  }

  // Do not convert a completion-write failure into a retryable provider
  // failure. The database update may have committed before the connection
  // failed; leaving the claim terminal/running prevents a second paid launch.
  try {
    await dependencies.complete(
      request.accountId,
      request.requestId,
      inputHash,
      providerOutcome.result,
    );
  } catch (error) {
    throw new SuggestionAnalysisError(
      'ANALYSIS_STATE_UPDATE_FAILED',
      500,
      'The website analysis finished, but its result could not be saved safely. Please enter your details manually.',
      { cause: error },
    );
  }

  return { success: true, result: providerOutcome.result, cached: false };
}
