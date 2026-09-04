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
  prepareLocationWrite,
} from '@/lib/brand-locations/management';
import { createLocationSchema } from '@/lib/brand-locations/management-input';
import { createManagedLocation } from '@/lib/brand-locations/management-postgres';

interface RouteContext {
  params: Promise<{ brandId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, true);
    const { brandId: rawBrandId } = await context.params;
    const brandId = normalizeManagementId(rawBrandId, 'Brand ID');
    const parsed = createLocationSchema.safeParse(await readManagementJson(request));
    if (!parsed.success) return invalidManagementInput();
    const location = await createManagedLocation(
      accountId,
      brandId,
      prepareLocationWrite(parsed.data),
    );
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to create location');
  }
}
