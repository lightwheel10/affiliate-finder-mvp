import 'server-only';

import {
  abortGoogleSearchRun,
  startGoogleSearchRun,
} from '@/app/services/apify-google-scraper';
import { resolveServerBrandLocationContext } from '@/lib/brand-locations/server';
import { sql } from '@/lib/db';
import {
  markSearchLaunchAttempted,
  markSearchUncertain,
  releaseSearchCredit,
  reserveSearchCredit,
} from '@/lib/search/credit-reservations-postgres';
import {
  findSearchJobById,
  findSearchJobByRequestId,
  persistSearchJobIfActive,
  type SearchStartSqlExecutor,
} from '@/lib/search/start-postgres';
import {
  markOnboardingLaunchAttempted,
  markOnboardingSearchUncertain,
  releaseOnboardingSearch,
  reserveOnboardingSearch,
} from '@/lib/search/onboarding-entitlements-postgres';
import {
  startAttributedSearch,
  type SearchStartRequest,
  type StartedSearch,
} from '@/lib/search/start';

export function completeServerSearchStart(
  request: SearchStartRequest,
): Promise<StartedSearch> {
  const executor = sql as SearchStartSqlExecutor;

  return startAttributedSearch(request, {
    resolveContext: (input) => resolveServerBrandLocationContext(input, executor),
    reserveCredit: (input) => reserveSearchCredit(executor, input),
    markSearchLaunchAttempted: (accountId, requestId) =>
      markSearchLaunchAttempted(executor, accountId, requestId),
    releaseCredit: (accountId, requestId) =>
      releaseSearchCredit(executor, accountId, requestId),
    markSearchUncertain: (accountId, requestId, message) =>
      markSearchUncertain(executor, accountId, requestId, message),
    reserveOnboardingSearch: (input) =>
      reserveOnboardingSearch(executor, input),
    markOnboardingLaunchAttempted: (accountId, requestId) =>
      markOnboardingLaunchAttempted(executor, accountId, requestId),
    releaseOnboardingSearch: (accountId, requestId) =>
      releaseOnboardingSearch(executor, accountId, requestId),
    markOnboardingSearchUncertain: (accountId, requestId, message) =>
      markOnboardingSearchUncertain(executor, accountId, requestId, message),
    startProvider: startGoogleSearchRun,
    abortProvider: abortGoogleSearchRun,
    findJobByRequestId: (accountId, requestId) =>
      findSearchJobByRequestId(executor, accountId, requestId),
    findJobById: (accountId, jobId) =>
      findSearchJobById(executor, accountId, jobId),
    persistJobIfActive: (input) => persistSearchJobIfActive(executor, input),
  });
}
