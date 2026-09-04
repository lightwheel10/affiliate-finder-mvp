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
  prepareBrandPatch,
} from '@/lib/brand-locations/management';
import { updateBrandSchema } from '@/lib/brand-locations/management-input';
import { updateManagedBrand } from '@/lib/brand-locations/management-postgres';

interface RouteContext {
  params: Promise<{ brandId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, true);
    const { brandId: rawBrandId } = await context.params;
    const brandId = normalizeManagementId(rawBrandId, 'Brand ID');
    const parsed = updateBrandSchema.safeParse(await readManagementJson(request));
    if (!parsed.success) return invalidManagementInput();
    const brand = await updateManagedBrand(
      accountId,
      brandId,
      prepareBrandPatch(parsed.data),
    );
    return NextResponse.json({ brand });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to update brand');
  }
}
