import 'server-only';

import { ApifyClient } from 'apify-client';
import {
  ReconciliationProviderError,
  type SearchReconciliationCase,
} from '@/lib/search/reconciliation';
import {
  validateProviderRunForCase,
  type InspectedProviderRun,
  type VerifiedProviderRun,
} from '@/lib/search/reconciliation-provider-validation';

export type { VerifiedProviderRun } from '@/lib/search/reconciliation-provider-validation';

async function inspectApifyRun(runId: string): Promise<InspectedProviderRun> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ReconciliationProviderError('Apify verification is not configured.');
  }
  const client = new ApifyClient({ token, maxRetries: 2, timeoutSecs: 30 });
  try {
    const runClient = client.run(runId);
    const [run, inputRecord] = await Promise.all([
      runClient.get(),
      runClient.keyValueStore().getRecord('INPUT'),
    ]);
    if (!run || !inputRecord) {
      throw new ReconciliationProviderError('The provider run or its INPUT record was not found.');
    }
    return {
      id: run.id,
      actorId: run.actId,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      input: inputRecord.value,
    };
  } catch (error) {
    if (error instanceof ReconciliationProviderError) throw error;
    throw new ReconciliationProviderError(
      'The provider run could not be verified. No database state was changed.',
      error,
    );
  }
}

/**
 * A run is attachable only when its Actor, exact INPUT payload, and launch time
 * all match the frozen case. This blocks accidental or cross-customer run IDs.
 */
export async function verifyProviderRunForCase(
  reconciliationCase: SearchReconciliationCase,
  runId: string,
): Promise<VerifiedProviderRun> {
  return validateProviderRunForCase(
    reconciliationCase,
    await inspectApifyRun(runId),
  );
}
