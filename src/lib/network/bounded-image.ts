import 'server-only';

import { Buffer } from 'node:buffer';

const MAX_URL_LENGTH = 4_096;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
export const BOUNDED_IMAGE_MAX_CONCURRENCY = 4;

const CONTENT_TYPES = new Map<string, { canonical: string; extension: string }>([
  ['image/jpeg', { canonical: 'image/jpeg', extension: 'jpg' }],
  ['image/jpg', { canonical: 'image/jpeg', extension: 'jpg' }],
  ['image/pjpeg', { canonical: 'image/jpeg', extension: 'jpg' }],
  ['image/png', { canonical: 'image/png', extension: 'png' }],
  ['image/x-png', { canonical: 'image/png', extension: 'png' }],
  ['image/webp', { canonical: 'image/webp', extension: 'webp' }],
  ['image/gif', { canonical: 'image/gif', extension: 'gif' }],
  ['image/avif', { canonical: 'image/avif', extension: 'avif' }],
]);

export type BoundedImageDownloadErrorCode =
  | 'DISALLOWED_DESTINATION'
  | 'EMPTY_RESPONSE'
  | 'HTTP_ERROR'
  | 'INVALID_IMAGE_SIGNATURE'
  | 'INVALID_RESPONSE_LENGTH'
  | 'INVALID_URL'
  | 'RESPONSE_TOO_LARGE'
  | 'TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'UNSUPPORTED_MEDIA_TYPE';

export class BoundedImageDownloadError extends Error {
  constructor(
    public readonly code: BoundedImageDownloadErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BoundedImageDownloadError';
  }
}

export interface DownloadedImage {
  bytes: Buffer;
  contentType: string;
  extension: string;
  finalUrl: string;
}

export interface BoundedImageDownloadOptions {
  allowedHostSuffixes: readonly string[];
  headers?: Readonly<Record<string, string>>;
  maxBytes: number;
  maxRedirects: number;
  timeoutMs: number;
}

export interface BoundedImageDownloadDependencies {
  fetch?: typeof fetch;
}

function normalizedAllowedSuffixes(values: readonly string[]): string[] {
  if (values.length === 0 || values.length > 20) {
    throw new TypeError('At least one and at most twenty image hosts must be allowed.');
  }
  return values.map((value) => {
    const normalized = value.trim().toLowerCase().replace(/^\.+/, '');
    if (
      normalized.length === 0
      || normalized.length > 253
      || !normalized.includes('.')
      || !/^[a-z0-9.-]+$/.test(normalized)
    ) {
      throw new TypeError('An allowed image host suffix is invalid.');
    }
    return normalized;
  });
}

function validateOptions(options: BoundedImageDownloadOptions): string[] {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }
  if (
    !Number.isSafeInteger(options.maxRedirects)
    || options.maxRedirects < 0
    || options.maxRedirects > 10
  ) {
    throw new TypeError('maxRedirects must be an integer between zero and ten.');
  }
  if (
    !Number.isSafeInteger(options.timeoutMs)
    || options.timeoutMs <= 0
    || options.timeoutMs > 30_000
  ) {
    throw new TypeError('timeoutMs must be an integer between one and 30000.');
  }
  return normalizedAllowedSuffixes(options.allowedHostSuffixes);
}

function hostMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function validateImageUrl(rawUrl: string, allowedSuffixes: readonly string[]): URL {
  if (rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    throw new BoundedImageDownloadError('INVALID_URL', 'The image URL is invalid.');
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new BoundedImageDownloadError(
      'INVALID_URL',
      'The image URL is invalid.',
      { cause: error },
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:'
    || url.username !== ''
    || url.password !== ''
    || url.port !== ''
    || !allowedSuffixes.some((suffix) => hostMatches(hostname, suffix))
  ) {
    throw new BoundedImageDownloadError(
      'DISALLOWED_DESTINATION',
      'The image destination is not an approved HTTPS CDN host.',
    );
  }
  url.hostname = hostname;
  url.hash = '';
  return url;
}

export function isAllowedHttpsImageUrl(
  rawUrl: string,
  allowedHostSuffixes: readonly string[],
): boolean {
  try {
    validateImageUrl(rawUrl, normalizedAllowedSuffixes(allowedHostSuffixes));
    return true;
  } catch {
    return false;
  }
}

function normalizeContentType(value: string | null): { canonical: string; extension: string } {
  const rawType = value?.split(';', 1)[0].trim().toLowerCase() ?? '';
  const type = CONTENT_TYPES.get(rawType);
  if (!type) {
    throw new BoundedImageDownloadError(
      'UNSUPPORTED_MEDIA_TYPE',
      'The response is not a supported raster image.',
    );
  }
  return type;
}

function declaredResponseLength(value: string | null, maxBytes: number): void {
  if (value === null) return;
  if (!/^[0-9]+$/.test(value)) {
    throw new BoundedImageDownloadError(
      'INVALID_RESPONSE_LENGTH',
      'The image response length is invalid.',
    );
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new BoundedImageDownloadError(
      'INVALID_RESPONSE_LENGTH',
      'The image response length is invalid.',
    );
  }
  if (length > maxBytes) {
    throw new BoundedImageDownloadError(
      'RESPONSE_TOO_LARGE',
      'The image response exceeds the byte limit.',
    );
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is cleanup only. Never replace the original validation error.
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    throw new BoundedImageDownloadError('EMPTY_RESPONSE', 'The image response has no body.');
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel('Image response exceeded the byte limit.');
        } catch {
          // Preserve the size-limit error even if the remote stream rejects cleanup.
        }
        throw new BoundedImageDownloadError(
          'RESPONSE_TOO_LARGE',
          'The image response exceeds the byte limit.',
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (received === 0) {
    throw new BoundedImageDownloadError('EMPTY_RESPONSE', 'The image response is empty.');
  }
  return Buffer.concat(chunks, received);
}

function startsWith(bytes: Buffer, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function hasImageSignature(bytes: Buffer, contentType: string): boolean {
  switch (contentType) {
    case 'image/jpeg':
      return bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return bytes.length >= 8
        && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      return bytes.length >= 6
        && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a'
          || bytes.subarray(0, 6).toString('ascii') === 'GIF89a');
    case 'image/webp':
      return bytes.length >= 12
        && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
        && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'image/avif': {
      if (bytes.length < 16 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
      const brands = bytes.subarray(8, Math.min(bytes.length, 64)).toString('ascii');
      return brands.includes('avif') || brands.includes('avis');
    }
    default:
      return false;
  }
}

/**
 * Downloads one raster image through a strict CDN allow-list. Redirects are
 * manual and must remain on the same allow-list; both declared and streamed
 * byte counts are bounded before the body can be returned to a storage caller.
 */
async function downloadBoundedImageWithinSlot(
  rawUrl: string,
  options: BoundedImageDownloadOptions,
  dependencies: BoundedImageDownloadDependencies = {},
): Promise<DownloadedImage> {
  const allowedSuffixes = validateOptions(options);
  const fetchImage = dependencies.fetch ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const visited = new Set<string>();
  let currentUrl = validateImageUrl(rawUrl, allowedSuffixes);
  let redirects = 0;

  try {
    while (true) {
      if (visited.has(currentUrl.href)) {
        throw new BoundedImageDownloadError(
          'TOO_MANY_REDIRECTS',
          'An image redirect loop was detected.',
        );
      }
      visited.add(currentUrl.href);

      const response = await fetchImage(currentUrl, {
        headers: {
          Referer: currentUrl.origin,
          ...options.headers,
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status)) {
        await cancelResponseBody(response);
        if (location === null) {
          throw new BoundedImageDownloadError(
            'HTTP_ERROR',
            `The image host returned HTTP ${response.status} without a redirect location.`,
          );
        }
        if (redirects >= options.maxRedirects) {
          throw new BoundedImageDownloadError(
            'TOO_MANY_REDIRECTS',
            'The image redirect limit was exceeded.',
          );
        }
        let redirectedUrl: URL;
        try {
          redirectedUrl = new URL(location, currentUrl);
        } catch (error) {
          throw new BoundedImageDownloadError(
            'INVALID_URL',
            'The image response returned an invalid redirect.',
            { cause: error },
          );
        }
        currentUrl = validateImageUrl(redirectedUrl.href, allowedSuffixes);
        redirects += 1;
        continue;
      }
      if (!response.ok) {
        await cancelResponseBody(response);
        throw new BoundedImageDownloadError(
          'HTTP_ERROR',
          `The image host returned HTTP ${response.status}.`,
        );
      }

      let imageType: { canonical: string; extension: string };
      try {
        imageType = normalizeContentType(response.headers.get('content-type'));
        declaredResponseLength(response.headers.get('content-length'), options.maxBytes);
      } catch (error) {
        await cancelResponseBody(response);
        throw error;
      }
      const bytes = await readBoundedBody(response, options.maxBytes);
      if (!hasImageSignature(bytes, imageType.canonical)) {
        throw new BoundedImageDownloadError(
          'INVALID_IMAGE_SIGNATURE',
          'The response body does not match its declared image type.',
        );
      }
      return {
        bytes,
        contentType: imageType.canonical,
        extension: imageType.extension,
        finalUrl: currentUrl.href,
      };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new BoundedImageDownloadError(
        'TIMEOUT',
        'The image download timed out.',
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Creates a FIFO task gate so queued callers cannot increase active work. */
export function createConcurrencyLimiter(maxConcurrency: number) {
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency <= 0 || maxConcurrency > 100) {
    throw new TypeError('maxConcurrency must be an integer between one and one hundred.');
  }
  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (active < maxConcurrency) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  return async function withConcurrencySlot<T>(task: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await task();
    } finally {
      active -= 1;
      waiters.shift()?.();
    }
  };
}

const withBoundedImageDownloadSlot = createConcurrencyLimiter(BOUNDED_IMAGE_MAX_CONCURRENCY);

/**
 * Public entry point. Every caller shares one process-level gate, so adding a
 * new image consumer cannot silently bypass the active-download boundary.
 */
export function downloadBoundedImage(
  rawUrl: string,
  options: BoundedImageDownloadOptions,
  dependencies: BoundedImageDownloadDependencies = {},
): Promise<DownloadedImage> {
  return withBoundedImageDownloadSlot(
    () => downloadBoundedImageWithinSlot(rawUrl, options, dependencies),
  );
}
