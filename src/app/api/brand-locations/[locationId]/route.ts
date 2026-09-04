import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeManagementMutation,
  authenticateManagementAccount,
  invalidManagementInput,
  managementErrorResponse,
  readManagementJson,
} from '@/lib/brand-locations/management-api';
import {
  normalizeManagementId,
  prepareLocationPatch,
} from '@/lib/brand-locations/management';
import { updateLocationSchema } from '@/lib/brand-locations/management-input';
import { updateManagedLocation } from '@/lib/brand-locations/management-postgres';

interface RouteContext {
  params: Promise<{ locationId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, true);
    const { locationId: rawLocationId } = await context.params;
    const locationId = normalizeManagementId(rawLocationId, 'Location ID');
    const parsed = updateLocationSchema.safeParse(await readManagementJson(request));
    if (!parsed.success) return invalidManagementInput();
    const location = await updateManagedLocation(
      accountId,
      locationId,
      prepareLocationPatch(parsed.data),
    );
    return NextResponse.json({ location });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to update location');
  }
}
