import { APIFY_ACTOR_IDS } from '@/lib/search/apify-actors';
import {
  jsonFingerprint,
  parseReconciliationSettingsSnapshot,
  ReconciliationProviderError,
  type SearchReconciliationCase,
} from '@/lib/search/reconciliation';
import {
  buildEnrichmentProviderInput,
  buildGoogleProviderInput,
  enrichmentProviderCorrelationId,
  scopedSearchProviderCorrelationId,
  searchProviderCorrelationId,
} from '@/lib/search/provider-input';

export interface VerifiedProviderRun {
  id: string;
  actorId: string;
  status: string;
  startedAt: string;
}

export interface InspectedProviderRun extends VerifiedProviderRun {
  input: unknown;
}

function expectedActorId(reconciliationCase: SearchReconciliationCase): string {
  if (reconciliationCase.caseType !== 'enrichment_dispatch') {
    return APIFY_ACTOR_IDS.googleSearch;
  }
  switch (reconciliationCase.platform) {
    case 'youtube':
      return APIFY_ACTOR_IDS.youtubeEnrichment;
    case 'instagram':
      return APIFY_ACTOR_IDS.instagramEnrichment;
    case 'tiktok':
      return APIFY_ACTOR_IDS.tiktokEnrichment;
    case 'similarweb':
      return APIFY_ACTOR_IDS.similarwebEnrichment;
    default:
      throw new ReconciliationProviderError('The reconciliation platform is invalid.');
  }
}

function expectedProviderInput(reconciliationCase: SearchReconciliationCase): unknown {
  if (reconciliationCase.caseType === 'enrichment_dispatch') {
    if (
      !reconciliationCase.platform
      || !reconciliationCase.inputUrls
      || !reconciliationCase.dispatchId
    ) {
      throw new ReconciliationProviderError('The enrichment case has no immutable input.');
    }
    return buildEnrichmentProviderInput(
      reconciliationCase.platform,
      reconciliationCase.inputUrls,
      enrichmentProviderCorrelationId(reconciliationCase.dispatchId),
    );
  }

  const snapshot = parseReconciliationSettingsSnapshot(
    reconciliationCase.settingsSnapshot,
    reconciliationCase.caseType,
  );
  const scopedCorrelation = scopedSearchProviderCorrelationId({
    accountId: reconciliationCase.accountId,
    brandId: snapshot.brand.id,
    brandLocationId: snapshot.location.id,
    requestId: snapshot.search.requestId!,
  });
  if (
    reconciliationCase.caseType === 'paid_search'
    && !snapshot.search.providerCorrelationId
  ) {
    throw new ReconciliationProviderError(
      'This pre-migration paid search has no server-scoped provider correlation and cannot be attached safely.',
    );
  }
  if (
    snapshot.search.providerCorrelationId
    && snapshot.search.providerCorrelationId !== scopedCorrelation
  ) {
    throw new ReconciliationProviderError(
      'The provider correlation does not match this account, brand, and location.',
    );
  }
  return buildGoogleProviderInput({
    keywords: snapshot.search.keywords,
    competitors: snapshot.search.competitors,
    sources: snapshot.search.sources,
    targetCountry: snapshot.location.countryName,
    targetLanguage: snapshot.location.languageName,
    correlationId: snapshot.search.providerCorrelationId
      ?? searchProviderCorrelationId(snapshot.search.requestId!),
  });
}

export function validateProviderRunForCase(
  reconciliationCase: SearchReconciliationCase,
  inspected: InspectedProviderRun,
): VerifiedProviderRun {
  if (inspected.actorId !== expectedActorId(reconciliationCase)) {
    throw new ReconciliationProviderError('The provider run belongs to the wrong Actor.');
  }
  if (
    jsonFingerprint(inspected.input)
    !== jsonFingerprint(expectedProviderInput(reconciliationCase))
  ) {
    throw new ReconciliationProviderError(
      'The provider run input does not match this account, brand, location, and search.',
    );
  }

  const attemptedAt = Date.parse(reconciliationCase.sourceLaunchAttemptedAt);
  const providerStartedAt = Date.parse(inspected.startedAt);
  if (
    !Number.isFinite(attemptedAt)
    || !Number.isFinite(providerStartedAt)
    || Math.abs(providerStartedAt - attemptedAt) > 15 * 60 * 1_000
  ) {
    throw new ReconciliationProviderError(
      'The provider run started outside this launch attempt\'s safety window.',
    );
  }

  return {
    id: inspected.id,
    actorId: inspected.actorId,
    status: inspected.status,
    startedAt: inspected.startedAt,
  };
}
