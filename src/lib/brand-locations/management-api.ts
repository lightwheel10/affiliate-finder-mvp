import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedAccount } from '@/lib/auth/account';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { BrandLocationManagementError } from '@/lib/brand-locations/management';
import { isMultiBrandLocationsEnabled } from '@/lib/feature-flags';

const MAX_MANAGEMENT_BODY_BYTES = 64 * 1_024;

class ManagementApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ManagementApiError';
  }
}

export async function authenticateManagementAccount(): Promise<number> {
  // A disabled feature behaves like an unavailable route. This prevents
  // rolling clients from discovering or depending on unfinished APIs.
  if (!isMultiBrandLocationsEnabled()) {
    throw new ManagementApiError(404, 'FEATURE_NOT_AVAILABLE', 'Not found.');
  }
  const authentication = await resolveAuthenticatedAccount();
  if (!authentication) {
    throw new ManagementApiError(401, 'UNAUTHORIZED', 'Unauthorized.');
  }
  if (!authentication.account) {
    throw new ManagementApiError(
      404,
      'ACCOUNT_NOT_FOUND',
      'Application account not found.',
    );
  }
  return authentication.account.id;
}

export function assertSafeManagementMutation(
  request: NextRequest,
  expectsJson: boolean,
): void {
  if (!isSameOriginMutation(request.headers.get('origin'), request.nextUrl.origin)) {
    throw new ManagementApiError(
      403,
      'INVALID_REQUEST_ORIGIN',
      'Invalid request origin.',
    );
  }
  if (!expectsJson) return;
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ManagementApiError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.',
    );
  }
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_MANAGEMENT_BODY_BYTES) {
      throw new ManagementApiError(
        413,
        'REQUEST_TOO_LARGE',
        'Request body is too large.',
      );
    }
  }
}

export async function readManagementJson(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return JSON.parse('');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let receivedBytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_MANAGEMENT_BODY_BYTES) {
        await reader.cancel();
        throw new ManagementApiError(
          413,
          'REQUEST_TOO_LARGE',
          'Request body is too large.',
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof ManagementApiError) throw error;
    throw new SyntaxError('Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(body);
}

export function invalidManagementInput() {
  return NextResponse.json(
    { error: 'Invalid request input.', code: 'INVALID_INPUT' },
    { status: 400 },
  );
}

export function managementErrorResponse(error: unknown, operation: string) {
  if (error instanceof ManagementApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof BrandLocationManagementError) {
    if (error.status >= 500) {
      console.error(`[Brand Location Management] ${operation}:`, error);
      return NextResponse.json(
        {
          error: 'The request could not be completed safely.',
          code: error.code,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: 'Invalid JSON body.', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }
  console.error(`[Brand Location Management] ${operation}:`, error);
  return NextResponse.json(
    { error: 'The request could not be completed safely.', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
