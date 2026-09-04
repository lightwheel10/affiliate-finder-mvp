import 'server-only';

import {
  abortEnrichmentRun,
  startEnrichmentPlatform,
} from '@/app/services/apify';
import { sql } from '@/lib/db';
import {
  dispatchEnrichmentActors,
  type EnrichmentDispatchContext,
  type EnrichmentDispatchInput,
  type EnrichmentDispatchSetupResult,
} from '@/lib/search/enrichment-dispatch';
import {
  claimEnrichmentDispatch,
  finalizeEnrichmentDispatchSetup,
  initializeEnrichmentDispatches,
  markEnrichmentDispatchFailed,
  markEnrichmentDispatchUncertain,
  markEnrichmentLaunchAttempted,
  recordEnrichmentRun,
  type InitializeEnrichmentDispatchResult,
} from '@/lib/search/enrichment-dispatch-postgres';
import { enrichmentProviderCorrelationId } from '@/lib/search/provider-input';
import type postgres from 'postgres';

const database = sql as postgres.Sql;

export function initializeServerEnrichmentDispatches(
  context: EnrichmentDispatchContext,
  inputs: readonly EnrichmentDispatchInput[],
  rawResults: unknown,
): Promise<InitializeEnrichmentDispatchResult> {
  return initializeEnrichmentDispatches(database, context, inputs, rawResults);
}

export function dispatchServerEnrichmentActors(
  context: EnrichmentDispatchContext,
): Promise<EnrichmentDispatchSetupResult> {
  return dispatchEnrichmentActors(context, {
    claimDispatch: (ownedContext, platform) =>
      claimEnrichmentDispatch(database, ownedContext, platform),
    markLaunchAttempted: (dispatch) =>
      markEnrichmentLaunchAttempted(database, dispatch),
    startProvider: (dispatch) => startEnrichmentPlatform(
      dispatch.platform,
      dispatch.urls,
      enrichmentProviderCorrelationId(dispatch.id),
    ),
    recordRun: (dispatch, runId) =>
      recordEnrichmentRun(database, dispatch, runId),
    markFailed: (dispatch, message, runId) =>
      markEnrichmentDispatchFailed(database, dispatch, message, runId),
    markUncertain: (dispatch, message, runId) =>
      markEnrichmentDispatchUncertain(database, dispatch, message, runId),
    abortProvider: abortEnrichmentRun,
    finalizeSetup: (ownedContext) =>
      finalizeEnrichmentDispatchSetup(database, ownedContext),
  });
}
