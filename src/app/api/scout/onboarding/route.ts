import { NextResponse } from 'next/server';

/**
 * The former synchronous onboarding search bypassed the durable one-time
 * entitlement and launched paid provider work directly. It has no live client
 * caller; the supported flow is POST /api/scout/onboarding/start plus polling.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'This onboarding search endpoint has been retired.',
      error: 'ONBOARDING_SEARCH_ENDPOINT_RETIRED',
    },
    { status: 410 },
  );
}
