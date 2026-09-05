import 'server-only';

import { NextRequest } from 'next/server';
import { isSameOriginMutation } from '@/lib/auth/request-origin';

export const MAX_STRIPE_MUTATION_BODY_BYTES = 8 * 1_024;

export type StripeMutationRequestErrorCode =
  | 'INVALID_REQUEST_ORIGIN'
  | 'INVALID_JSON'
  | 'INVALID_MEDIA_TYPE'
  | 'REQUEST_TOO_LARGE';

export class StripeMutationRequestError extends Error {
  constructor(
    readonly status: 400 | 403 | 413 | 415,
    readonly code: StripeMutationRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StripeMutationRequestError';
  }
}

/**
 * Reads a browser-originated Stripe mutation without allowing a missing Origin,
 * a non-JSON body, invalid UTF-8, or chunked input to bypass the byte limit.
 */
export async function readStripeMutationJson(
  request: NextRequest,
  maxBytes = MAX_STRIPE_MUTATION_BODY_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Stripe mutation body limit is invalid.');
  }
  if (!isSameOriginMutation(request.headers.get('origin'), request.nextUrl.origin)) {
    throw new StripeMutationRequestError(
      403,
      'INVALID_REQUEST_ORIGIN',
      'Invalid request origin.',
    );
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new StripeMutationRequestError(
      415,
      'INVALID_MEDIA_TYPE',
      'Content-Type must be application/json.',
    );
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maxBytes) {
      throw new StripeMutationRequestError(413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new StripeMutationRequestError(400, 'INVALID_JSON', 'Invalid JSON body.');
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let receivedBytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new StripeMutationRequestError(
          413,
          'REQUEST_TOO_LARGE',
          'Request body is too large.',
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    try {
      return JSON.parse(body);
    } catch (error) {
      if (error instanceof StripeMutationRequestError) throw error;
      throw new StripeMutationRequestError(400, 'INVALID_JSON', 'Invalid JSON body.');
    }
  } catch (error) {
    if (error instanceof StripeMutationRequestError) throw error;
    throw new StripeMutationRequestError(400, 'INVALID_JSON', 'Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
}
