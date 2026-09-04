import 'server-only';

import type { NextRequest } from 'next/server';
import { isSameOriginMutation } from '@/lib/auth/request-origin';

const MAX_SUGGESTION_BODY_BYTES = 4 * 1_024;

export class SuggestionRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SuggestionRequestError';
  }
}

export function assertSafeSuggestionRequest(request: NextRequest): void {
  if (!isSameOriginMutation(request.headers.get('origin'), request.nextUrl.origin)) {
    throw new SuggestionRequestError(403, 'INVALID_REQUEST_ORIGIN', 'Invalid request origin.');
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new SuggestionRequestError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.',
    );
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength === null) return;
  const bytes = Number(contentLength);
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_SUGGESTION_BODY_BYTES) {
    throw new SuggestionRequestError(413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
  }
}

export async function readSuggestionJson(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON body.');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let receivedBytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_SUGGESTION_BODY_BYTES) {
        await reader.cancel();
        throw new SuggestionRequestError(413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof SuggestionRequestError) throw error;
    throw new SyntaxError('Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(body) as unknown;
}
