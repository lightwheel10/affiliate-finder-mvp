/**
 * Starts the free onboarding search through the same attributed, idempotent
 * job-start boundary as a normal Find search. The status endpoint owns result
 * persistence and finalization.
 */
import { NextRequest, NextResponse } from 'next/server';
import { trackApiCall } from '@/app/services/tracking';
import { resolveAuthenticatedAccount, legacyAccountIdMatches } from '@/lib/auth/account';
import { BrandLocationContextError } from '@/lib/brand-locations/context';
import { startSearchInputSchema } from '@/lib/search/input';
import { SearchStartError } from '@/lib/search/start';
import { completeServerSearchStart } from '@/lib/search/start-server';

const ONBOARDING_SOURCES = ['Web', 'YouTube', 'Instagram', 'TikTok'] as const;

interface OnboardingStartResponse {
  success: boolean;
  jobId?: number;
  message: string;
  error?: string;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<OnboardingStartResponse>> {
  const startTime = Date.now();

  try {
    const authenticated = await resolveAuthenticatedAccount();
    if (!authenticated) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      }, { status: 401 });
    }
    if (!authenticated.account) {
      return NextResponse.json({
        success: false,
        message: 'User account not found',
        error: 'USER_NOT_FOUND',
      }, { status: 404 });
    }

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Request body must be valid JSON',
        error: 'INVALID_JSON',
      }, { status: 400 });
    }

    const record = objectRecord(requestBody);
    if (!record) {
      return NextResponse.json({
        success: false,
        message: 'Invalid onboarding search input',
        error: 'INVALID_SEARCH_INPUT',
      }, { status: 400 });
    }

    const requestedUserId = record.userId === undefined
      ? undefined
      : typeof record.userId === 'number'
        && Number.isSafeInteger(record.userId)
        && record.userId > 0
        ? record.userId
        : Number.NaN;
    if (!legacyAccountIdMatches(requestedUserId, authenticated.account.id)) {
      return NextResponse.json({
        success: false,
        message: 'Not authorized to access this resource',
        error: 'FORBIDDEN',
      }, { status: 403 });
    }

    const parsedInput = startSearchInputSchema.safeParse({
      keywords: record.topics,
      competitors: record.competitors,
      sources: [...ONBOARDING_SOURCES],
      requestId: record.requestId,
    });
    if (!parsedInput.success || !parsedInput.data.requestId) {
      return NextResponse.json({
        success: false,
        message: 'Invalid onboarding search input',
        error: 'INVALID_SEARCH_INPUT',
      }, { status: 400 });
    }

    const started = await completeServerSearchStart({
      accountId: authenticated.account.id,
      requestId: parsedInput.data.requestId,
      isOnboarding: true,
      keywords: parsedInput.data.keywords ?? [],
      competitors: parsedInput.data.competitors ?? [],
      sources: [...ONBOARDING_SOURCES],
    });

    if (!started.reused) {
      await trackApiCall({
        userId: authenticated.account.id,
        service: 'apify_google_scraper',
        endpoint: 'onboarding_start',
        keyword: started.combinedKeyword,
        status: 'success',
        apifyRunId: started.runId,
        durationMs: Date.now() - startTime,
        brandId: started.brandId,
        brandLocationId: started.brandLocationId,
      });
    }

    return NextResponse.json({
      success: true,
      jobId: started.jobId,
      message: 'Onboarding search started. Poll /api/search/status for results.',
    });
  } catch (error: unknown) {
    console.error('[Onboarding Start] Error:', error);

    if (error instanceof BrandLocationContextError || error instanceof SearchStartError) {
      return NextResponse.json({
        success: false,
        message: error.status >= 500 ? 'Unable to start onboarding search safely.' : error.message,
        error: error.code,
      }, { status: error.status });
    }

    const errorType = typeof error === 'object' && error !== null && 'type' in error
      ? String(error.type)
      : '';
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorType === 'platform-feature-disabled' || /usage hard limit/i.test(errorMessage)) {
      return NextResponse.json({
        success: false,
        message: 'Search service temporarily at capacity',
        error: 'SERVICE_AT_CAPACITY',
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
