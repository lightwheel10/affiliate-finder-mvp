import { NextResponse } from 'next/server';
import { authenticateSearchReconciliationOperator } from '@/lib/auth/operator';
import { listOpenSearchReconciliationCases } from '@/lib/search/reconciliation-postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authentication = await authenticateSearchReconciliationOperator();
    if (authentication.outcome === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authentication.outcome === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cases = await listOpenSearchReconciliationCases();
    return NextResponse.json({ cases });
  } catch (error) {
    console.error('[Search Reconciliation] Failed to list cases:', error);
    return NextResponse.json(
      { error: 'Unable to load reconciliation cases.' },
      { status: 500 },
    );
  }
}
