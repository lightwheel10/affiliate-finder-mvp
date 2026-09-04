import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import {
  BOUNDED_IMAGE_MAX_CONCURRENCY,
  BoundedImageDownloadError,
  createConcurrencyLimiter,
  downloadBoundedImage,
  isAllowedHttpsImageUrl,
  type BoundedImageDownloadDependencies,
} from '../../src/lib/network/bounded-image';

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
const OPTIONS = {
  allowedHostSuffixes: ['cdninstagram.com'],
  maxBytes: 64,
  maxRedirects: 2,
  timeoutMs: 1_000,
} as const;

function imageResponse(
  bytes: BodyInit = PNG,
  headers: Record<string, string> = { 'content-type': 'image/png' },
): Response {
  return new Response(bytes, { headers, status: 200 });
}

function assertDownloadError(
  error: unknown,
  code: BoundedImageDownloadError['code'],
): boolean {
  assert.ok(error instanceof BoundedImageDownloadError);
  assert.equal(error.code, code);
  return true;
}

test('only standard HTTPS URLs on an exact approved CDN suffix are eligible', () => {
  assert.equal(
    isAllowedHttpsImageUrl('https://scontent.cdninstagram.com/photo.jpg?sig=one', ['cdninstagram.com']),
    true,
  );
  for (const url of [
    'http://scontent.cdninstagram.com/photo.jpg',
    'https://scontent.cdninstagram.com:8443/photo.jpg',
    'https://user:pass@scontent.cdninstagram.com/photo.jpg',
    'https://cdninstagram.com.example.test/photo.jpg',
    'https://127.0.0.1/photo.jpg',
  ]) {
    assert.equal(isAllowedHttpsImageUrl(url, ['cdninstagram.com']), false, url);
  }
});

test('a legitimate bounded raster image keeps its bytes and canonical storage type', async () => {
  const result = await downloadBoundedImage(
    'https://scontent.cdninstagram.com/photo.png',
    OPTIONS,
    { fetch: async () => imageResponse() },
  );
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.extension, 'png');
  assert.deepEqual(result.bytes, Buffer.from(PNG));
});

test('a legitimate JPEG alias is accepted and normalized for storage', async () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const result = await downloadBoundedImage(
    'https://scontent.cdninstagram.com/photo.jpg',
    OPTIONS,
    { fetch: async () => imageResponse(jpeg, { 'content-type': 'image/jpg' }) },
  );
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.extension, 'jpg');
  assert.deepEqual(result.bytes, Buffer.from(jpeg));
});

test('a declared oversized image is rejected before it can be accepted as storage data', async () => {
  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/photo.png',
      OPTIONS,
      {
        fetch: async () => imageResponse(PNG, {
          'content-length': '65',
          'content-type': 'image/png',
        }),
      },
    ),
    (error) => assertDownloadError(error, 'RESPONSE_TOO_LARGE'),
  );
});

test('a response rejected from its headers is cancelled before its body can keep streaming', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(PNG);
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/not-an-image',
      OPTIONS,
      {
        fetch: async () => new Response(body, {
          headers: { 'content-type': 'text/html' },
          status: 200,
        }),
      },
    ),
    (error) => assertDownloadError(error, 'UNSUPPORTED_MEDIA_TYPE'),
  );
  assert.equal(cancelled, true);
});

test('a streamed response cannot bypass the byte limit by omitting Content-Length', async () => {
  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/photo.png',
      { ...OPTIONS, maxBytes: 8 },
      { fetch: async () => imageResponse(PNG) },
    ),
    (error) => assertDownloadError(error, 'RESPONSE_TOO_LARGE'),
  );
});

test('non-images, missing types, and bodies that lie about their image type are rejected', async () => {
  for (const response of [
    imageResponse('<html>not an image</html>', { 'content-type': 'text/html' }),
    imageResponse(PNG, {}),
    imageResponse('not a png', { 'content-type': 'image/png' }),
    imageResponse('<svg></svg>', { 'content-type': 'image/svg+xml' }),
  ]) {
    await assert.rejects(
      downloadBoundedImage(
        'https://scontent.cdninstagram.com/photo.png',
        OPTIONS,
        { fetch: async () => response },
      ),
      (error) => {
        assert.ok(error instanceof BoundedImageDownloadError);
        assert.ok(['UNSUPPORTED_MEDIA_TYPE', 'INVALID_IMAGE_SIGNATURE'].includes(error.code));
        return true;
      },
    );
  }
});

test('redirects are manual and cannot escape to an unapproved destination', async () => {
  const visited: string[] = [];
  const dependencies: BoundedImageDownloadDependencies = {
    fetch: async (input) => {
      visited.push(String(input));
      return new Response(null, {
        headers: { location: 'http://127.0.0.1/latest/meta-data' },
        status: 302,
      });
    },
  };
  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/photo.png',
      OPTIONS,
      dependencies,
    ),
    (error) => assertDownloadError(error, 'DISALLOWED_DESTINATION'),
  );
  assert.deepEqual(visited, ['https://scontent.cdninstagram.com/photo.png']);
});

test('same-CDN redirects work while loops and excessive chains stay bounded', async () => {
  const successful = await downloadBoundedImage(
    'https://scontent.cdninstagram.com/old.png',
    OPTIONS,
    {
      fetch: async (input) => String(input).includes('/old.png')
        ? new Response(null, { headers: { location: '/new.png' }, status: 302 })
        : imageResponse(),
    },
  );
  assert.equal(successful.finalUrl, 'https://scontent.cdninstagram.com/new.png');

  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/a.png',
      OPTIONS,
      {
        fetch: async (input) => new Response(null, {
          headers: { location: String(input).includes('/a.png') ? '/b.png' : '/a.png' },
          status: 302,
        }),
      },
    ),
    (error) => assertDownloadError(error, 'TOO_MANY_REDIRECTS'),
  );
});

test('one total timeout covers a remote host that never returns a response', async () => {
  await assert.rejects(
    downloadBoundedImage(
      'https://scontent.cdninstagram.com/slow.png',
      { ...OPTIONS, timeoutMs: 20 },
      {
        fetch: async (_input, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }),
      },
    ),
    (error) => assertDownloadError(error, 'TIMEOUT'),
  );
});

test('the shared FIFO gate never exceeds its configured active task count', async () => {
  const withSlot = createConcurrencyLimiter(3);
  let active = 0;
  let maximumActive = 0;
  let release: (() => void) | undefined;
  const blocker = new Promise<void>((resolve) => { release = resolve; });
  const tasks = Array.from({ length: 40 }, () => withSlot(async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await blocker;
    active -= 1;
  }));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(maximumActive, 3);
  release?.();
  await Promise.all(tasks);
  assert.equal(active, 0);
});

test('the real downloader shares one concurrency boundary across all callers', async () => {
  let active = 0;
  let maximumActive = 0;
  let release: (() => void) | undefined;
  const blocker = new Promise<void>((resolve) => { release = resolve; });
  const fetchImage: typeof fetch = async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await blocker;
    active -= 1;
    return imageResponse();
  };
  const downloads = Array.from({ length: 40 }, (_, index) => downloadBoundedImage(
    `https://scontent.cdninstagram.com/${index}.png`,
    OPTIONS,
    { fetch: fetchImage },
  ));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(maximumActive, BOUNDED_IMAGE_MAX_CONCURRENCY);
  release?.();
  await Promise.all(downloads);
  assert.equal(active, 0);
});
