import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeManagementMutation,
  authenticateManagementAccount,
  managementErrorResponse,
  readManagementJson,
} from '@/lib/brand-locations/management-api';
import {
  BrandDescriptionError,
  brandDescriptionRequestSchema,
  generateBrandDescription,
} from '@/lib/brand-locations/brand-description';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await authenticateManagementAccount();
    assertSafeManagementMutation(request, true);
    const parsed = brandDescriptionRequestSchema.safeParse(await readManagementJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'INVALID_INPUT', error: 'Invalid request input.' },
        { status: 400 },
      );
    }

    const description = await generateBrandDescription(parsed.data);
    return NextResponse.json({ description });
  } catch (error) {
    if (error instanceof BrandDescriptionError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return managementErrorResponse(error, 'Failed to generate brand description');
  }
}
