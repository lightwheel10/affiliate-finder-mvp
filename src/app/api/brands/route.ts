import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeManagementMutation,
  authenticateManagementAccount,
  invalidManagementInput,
  managementErrorResponse,
  readManagementJson,
} from '@/lib/brand-locations/management-api';
import { prepareBrandWrite } from '@/lib/brand-locations/management';
import { createBrandSchema } from '@/lib/brand-locations/management-input';
import {
  createManagedBrand,
  listManagedPortfolio,
} from '@/lib/brand-locations/management-postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const accountId = await authenticateManagementAccount();
    const archivedValue = request.nextUrl.searchParams.get('includeArchived');
    if (archivedValue !== null && archivedValue !== 'true' && archivedValue !== 'false') {
      return invalidManagementInput();
    }
    const portfolio = await listManagedPortfolio(accountId, archivedValue === 'true');
    return NextResponse.json(portfolio);
  } catch (error) {
    return managementErrorResponse(error, 'Failed to list brands');
  }
}

export async function POST(request: NextRequest) {
  try {
    const accountId = await authenticateManagementAccount();
    assertSafeManagementMutation(request, true);
    const parsed = createBrandSchema.safeParse(await readManagementJson(request));
    if (!parsed.success) return invalidManagementInput();
    const brand = await createManagedBrand(accountId, prepareBrandWrite(parsed.data));
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    return managementErrorResponse(error, 'Failed to create brand');
  }
}
