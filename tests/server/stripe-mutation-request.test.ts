import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '../../src/lib/stripe/mutation-request';

const url = 'https://preview.example.test/api/stripe/change-subscription';

function request(input: {
  origin?: string;
  contentType?: string;
  contentLength?: string;
  body: BodyInit;
}): NextRequest {
  const headers = new Headers();
  if (input.origin) headers.set('origin', input.origin);
  if (input.contentType) headers.set('content-type', input.contentType);
  if (input.contentLength) headers.set('content-length', input.contentLength);
  return new NextRequest(url, { method: 'POST', headers, body: input.body });
}

async function expectedError(candidate: NextRequest, code: string, status: number): Promise<void> {
  await assert.rejects(readStripeMutationJson(candidate), (error: unknown) => {
    assert.ok(error instanceof StripeMutationRequestError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('Stripe mutations require an exact browser origin and JSON media type', async () => {
  await expectedError(request({
    contentType: 'application/json',
    body: '{}',
  }), 'INVALID_REQUEST_ORIGIN', 403);
  await expectedError(request({
    origin: 'https://attacker.example',
    contentType: 'application/json',
    body: '{}',
  }), 'INVALID_REQUEST_ORIGIN', 403);
  await expectedError(request({
    origin: 'https://preview.example.test',
    contentType: 'text/plain',
    body: '{}',
  }), 'INVALID_MEDIA_TYPE', 415);
});

test('Stripe mutation byte limit covers declared and chunked bodies', async () => {
  await expectedError(request({
    origin: 'https://preview.example.test',
    contentType: 'application/json',
    contentLength: String(8 * 1_024 + 1),
    body: '{}',
  }), 'REQUEST_TOO_LARGE', 413);
  await expectedError(request({
    origin: 'https://preview.example.test',
    contentType: 'application/json',
    body: JSON.stringify({ value: 'a'.repeat(8 * 1_024) }),
  }), 'REQUEST_TOO_LARGE', 413);
});

test('Stripe mutation JSON parser accepts valid input and rejects malformed input', async () => {
  const parsed = await readStripeMutationJson(request({
    origin: 'https://preview.example.test',
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ userId: 42 }),
  }));
  assert.deepEqual(parsed, { userId: 42 });

  await expectedError(request({
    origin: 'https://preview.example.test',
    contentType: 'application/json',
    body: '{',
  }), 'INVALID_JSON', 400);
});
