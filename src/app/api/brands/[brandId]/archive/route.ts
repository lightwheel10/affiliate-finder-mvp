import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeManagementMutation,
  authenticateManagementAccount,
  managementErrorResponse,
} from '@/lib/brand-locations/management-api';
import { normalizeManagementId } from '@/lib/brand-locations/management';
import { archiveManagedBrand } from '@/lib/brand-locations/management-postgres';

interface RouteContext {
  params: Promise<{ brandId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, false);
    const { brandId: rawBrandId } = await context.params;
    const brandId = normalizeManagementId(rawBrandId, 'Brand ID');
    const brand = await archiveManagedBrand(accountId, brandId);
    return NextResponse.json({ brand });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to archive brand');
  }
}
