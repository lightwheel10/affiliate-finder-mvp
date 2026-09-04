import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeManagementMutation,
  authenticateManagementAccount,
  managementErrorResponse,
} from '@/lib/brand-locations/management-api';
import { normalizeManagementId } from '@/lib/brand-locations/management';
import { restoreManagedLocation } from '@/lib/brand-locations/management-postgres';

interface RouteContext {
  params: Promise<{ locationId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, false);
    const { locationId: rawLocationId } = await context.params;
    const locationId = normalizeManagementId(rawLocationId, 'Location ID');
    const location = await restoreManagedLocation(accountId, locationId);
    return NextResponse.json({ location });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to restore location');
  }
}
