import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateSearchReconciliationOperator,
} from '@/lib/auth/operator';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import {
  assertActionAllowed,
  ReconciliationConflictError,
  ReconciliationInputError,
  ReconciliationProviderError,
  resolveReconciliationSchema,
} from '@/lib/search/reconciliation';
import {
  loadSearchReconciliationCase,
  resolveSearchReconciliationCase,
} from '@/lib/search/reconciliation-postgres';
import { verifyProviderRunForCase } from '@/lib/search/reconciliation-provider';

interface RouteContext {
  params: Promise<{ caseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authentication = await authenticateSearchReconciliationOperator();
    if (authentication.outcome === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authentication.outcome === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Supabase's session cookie authenticates the operator; this additional
    // origin check prevents another website from driving that session.
    if (!isSameOriginMutation(request.headers.get('origin'), request.nextUrl.origin)) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415 });
    }

    const { caseId } = await context.params;
    if (!/^[1-9][0-9]*$/.test(caseId)) {
      return NextResponse.json({ error: 'Invalid case identifier.' }, { status: 400 });
    }
    const parsed = resolveReconciliationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid resolution input.' }, { status: 400 });
    }

    const reconciliationCase = await loadSearchReconciliationCase(caseId);
    if (!reconciliationCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }
    assertActionAllowed(reconciliationCase, parsed.data);

    // Provider inspection is read-only and happens before database locks. The
    // transaction rechecks the case version after verification to close races.
    const verifiedRun = parsed.data.action === 'attach_provider_run'
      ? await verifyProviderRunForCase(reconciliationCase, parsed.data.providerRunId!)
      : null;
    const resolved = await resolveSearchReconciliationCase(
      caseId,
      parsed.data,
      authentication.operator,
      verifiedRun,
    );
    return NextResponse.json({ case: resolved });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ReconciliationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ReconciliationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ReconciliationProviderError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('[Search Reconciliation] Resolution failed:', error);
    return NextResponse.json(
      { error: 'The case could not be resolved safely.' },
      { status: 500 },
    );
  }
}
