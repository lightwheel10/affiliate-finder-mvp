import 'server-only';

import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_DNS_ANSWERS = 32;
const MAX_RESPONSE_HEADER_BYTES = 16 * 1_024;
const MAX_URL_LENGTH = 4_096;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOST_SUFFIXES = [
  '.corp',
  '.internal',
  '.intranet',
  '.lan',
  '.local',
  '.localhost',
  '.private',
];

export type PublicWebsiteMethod = 'GET' | 'HEAD';

export interface PublicAddress {
  address: string;
  family: 4 | 6;
}

export interface PublicWebsiteProbeResult {
  finalUrl: string;
  redirects: number;
  status: number;
}

interface PinnedResponse {
  headers: IncomingHttpHeaders;
  status: number;
}

export interface PublicWebsiteProbeDependencies {
  request?: (
    url: URL,
    address: PublicAddress,
    method: PublicWebsiteMethod,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
  ) => Promise<PinnedResponse>;
  resolve?: (hostname: string) => Promise<readonly PublicAddress[]>;
}

export interface PublicWebsiteProbeOptions {
  headers?: Readonly<Record<string, string>>;
  maxRedirects?: number;
  method?: PublicWebsiteMethod;
  timeoutMs?: number;
}

export type PublicWebsiteRequestErrorCode =
  | 'DNS_LOOKUP_FAILED'
  | 'INVALID_DESTINATION'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'UNSAFE_DESTINATION';

export class PublicWebsiteRequestError extends Error {
  constructor(
    public readonly code: PublicWebsiteRequestErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PublicWebsiteRequestError';
  }
}

function stripIpv6Brackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function canonicalHostname(url: URL): string {
  return stripIpv6Brackets(url.hostname.toLowerCase()).replace(/\.$/, '');
}

function isBlockedHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    || hostname.startsWith('instance-data.')
    || hostname.startsWith('metadata.');
}

/**
 * Only ordinary globally-routable unicast addresses may be contacted.
 * `process` converts IPv4-mapped IPv6 first, so private IPv4 cannot be hidden
 * inside an IPv6 representation.
 */
export function isPublicIpAddress(address: string): boolean {
  const candidate = stripIpv6Brackets(address);
  if (!ipaddr.isValid(candidate)) return false;

  try {
    return ipaddr.process(candidate).range() === 'unicast';
  } catch {
    return false;
  }
}

function normalizeAddress(address: PublicAddress): PublicAddress {
  const candidate = stripIpv6Brackets(address.address);
  if (!isPublicIpAddress(candidate)) {
    throw new PublicWebsiteRequestError(
      'UNSAFE_DESTINATION',
      'The destination resolves to a non-public address.',
    );
  }

  const parsed = ipaddr.process(candidate);
  const family = parsed.kind() === 'ipv4' ? 4 : 6;
  if (family !== address.family) {
    throw new PublicWebsiteRequestError(
      'DNS_LOOKUP_FAILED',
      'The DNS response contains an inconsistent address family.',
    );
  }

  return { address: parsed.toString(), family };
}

function canonicalIpAddress(address: string | undefined): string | null {
  if (!address) return null;
  const candidate = stripIpv6Brackets(address);
  if (!ipaddr.isValid(candidate)) return null;
  return ipaddr.process(candidate).toString();
}

async function defaultResolve(hostname: string): Promise<readonly PublicAddress[]> {
  const literal = stripIpv6Brackets(hostname);
  if (ipaddr.isValid(literal)) {
    const parsed = ipaddr.process(literal);
    return [{
      address: parsed.toString(),
      family: parsed.kind() === 'ipv4' ? 4 : 6,
    }];
  }

  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
}

function validateUrl(rawUrl: string): URL {
  if (rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    throw new PublicWebsiteRequestError('INVALID_DESTINATION', 'The destination URL is invalid.');
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new PublicWebsiteRequestError(
      'INVALID_DESTINATION',
      'The destination URL is invalid.',
      { cause: error },
    );
  }

  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:')
    || url.username.length > 0
    || url.password.length > 0
    || url.port.length > 0
  ) {
    throw new PublicWebsiteRequestError(
      'INVALID_DESTINATION',
      'Only standard public HTTP and HTTPS destinations are allowed.',
    );
  }

  const hostname = canonicalHostname(url);
  if (
    hostname.length === 0
    || hostname.length > 253
    || isBlockedHostname(hostname)
    || (!ipaddr.isValid(hostname) && !hostname.includes('.'))
  ) {
    throw new PublicWebsiteRequestError(
      'UNSAFE_DESTINATION',
      'The destination hostname is not a public website hostname.',
    );
  }

  url.hash = '';
  return url;
}

async function resolvePublicAddresses(
  hostname: string,
  resolve: NonNullable<PublicWebsiteProbeDependencies['resolve']>,
): Promise<PublicAddress[]> {
  let resolved: readonly PublicAddress[];
  try {
    resolved = await resolve(hostname);
  } catch (error) {
    if (error instanceof PublicWebsiteRequestError) throw error;
    throw new PublicWebsiteRequestError(
      'DNS_LOOKUP_FAILED',
      'The destination hostname could not be resolved.',
      { cause: error },
    );
  }

  if (resolved.length === 0 || resolved.length > MAX_DNS_ANSWERS) {
    throw new PublicWebsiteRequestError(
      'DNS_LOOKUP_FAILED',
      'The destination returned an invalid number of DNS addresses.',
    );
  }

  // Fail closed when DNS mixes public and non-public answers. Selecting only a
  // public answer would leave later retries vulnerable to an unsafe address.
  const unique = new Map<string, PublicAddress>();
  for (const answer of resolved) {
    const normalized = normalizeAddress(answer);
    unique.set(`${normalized.family}:${normalized.address}`, normalized);
  }
  return [...unique.values()];
}

function pinnedLookup(address: PublicAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

async function defaultPinnedRequest(
  url: URL,
  address: PublicAddress,
  method: PublicWebsiteMethod,
  headers: Readonly<Record<string, string>>,
  timeoutMs: number,
): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const hostname = canonicalHostname(url);
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)({
      agent: false,
      headers: {
        Accept: '*/*',
        Connection: 'close',
        ...headers,
      },
      hostname,
      lookup: pinnedLookup(address),
      maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
      method,
      path: `${url.pathname}${url.search}`,
      port: url.protocol === 'https:' ? 443 : 80,
      protocol: url.protocol,
      servername: url.protocol === 'https:' && !ipaddr.isValid(hostname) ? hostname : undefined,
    }, (response) => {
      const status = response.statusCode;
      const responseHeaders = response.headers;
      const remoteAddress = canonicalIpAddress(response.socket.remoteAddress);
      response.destroy();

      // Verify the socket actually reached the address we resolved and pinned.
      // This turns an ignored/customized lookup into a hard failure instead of
      // silently reopening the DNS validation-to-use gap.
      if (remoteAddress !== address.address) {
        reject(new PublicWebsiteRequestError(
          'UNSAFE_DESTINATION',
          'The connected address did not match the validated DNS address.',
        ));
        return;
      }
      if (status === undefined) {
        reject(new PublicWebsiteRequestError('NETWORK_ERROR', 'The destination returned no status.'));
        return;
      }
      resolve({ headers: responseHeaders, status });
    });

    const timeout = setTimeout(() => {
      request.destroy(new PublicWebsiteRequestError('TIMEOUT', 'The destination request timed out.'));
    }, timeoutMs);

    request.once('close', () => clearTimeout(timeout));
    request.once('error', (error) => {
      clearTimeout(timeout);
      reject(
        error instanceof PublicWebsiteRequestError
          ? error
          : new PublicWebsiteRequestError(
              'NETWORK_ERROR',
              'The destination request failed.',
              { cause: error },
            ),
      );
    });
    request.end();
  });
}

function remainingTime(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new PublicWebsiteRequestError('TIMEOUT', 'The public website probe timed out.');
  }
  return remaining;
}

async function withDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
  const timeoutMs = remainingTime(deadline);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new PublicWebsiteRequestError('TIMEOUT', 'The public website probe timed out.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Makes a header-only website probe through a DNS-pinned connection.
 * Every DNS answer and every redirect target is validated before a socket is
 * opened. Redirects are deliberately manual; native `fetch(..., follow)` would
 * resolve the next hostname outside this security boundary.
 */
export async function probePublicWebsite(
  rawUrl: string,
  options: PublicWebsiteProbeOptions = {},
  dependencies: PublicWebsiteProbeDependencies = {},
): Promise<PublicWebsiteProbeResult> {
  const method = options.method ?? 'HEAD';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) {
    throw new TypeError('timeoutMs must be an integer between 1 and 30000.');
  }
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
    throw new TypeError('maxRedirects must be an integer between 0 and 10.');
  }

  const resolve = dependencies.resolve ?? defaultResolve;
  const request = dependencies.request ?? defaultPinnedRequest;
  const deadline = Date.now() + timeoutMs;
  const visited = new Set<string>();
  let currentUrl = validateUrl(rawUrl);
  let redirects = 0;

  while (true) {
    const visitKey = currentUrl.href;
    if (visited.has(visitKey)) {
      throw new PublicWebsiteRequestError('TOO_MANY_REDIRECTS', 'A redirect loop was detected.');
    }
    visited.add(visitKey);

    const hostname = canonicalHostname(currentUrl);
    const addresses = await withDeadline(resolvePublicAddresses(hostname, resolve), deadline);
    let response: PinnedResponse | null = null;
    let lastNetworkError: unknown;

    for (const address of addresses) {
      try {
        response = await request(
          currentUrl,
          address,
          method,
          options.headers ?? {},
          remainingTime(deadline),
        );
        break;
      } catch (error) {
        if (error instanceof PublicWebsiteRequestError && error.code === 'TIMEOUT') throw error;
        lastNetworkError = error;
      }
    }

    if (!response) {
      throw lastNetworkError instanceof PublicWebsiteRequestError
        ? lastNetworkError
        : new PublicWebsiteRequestError(
            'NETWORK_ERROR',
            'Every public address for the destination failed.',
            { cause: lastNetworkError },
          );
    }

    const location = response.headers.location;
    if (!REDIRECT_STATUSES.has(response.status) || typeof location !== 'string') {
      return {
        finalUrl: currentUrl.href,
        redirects,
        status: response.status,
      };
    }

    if (redirects >= maxRedirects) {
      throw new PublicWebsiteRequestError('TOO_MANY_REDIRECTS', 'The redirect limit was exceeded.');
    }

    let redirectedUrl: URL;
    try {
      redirectedUrl = new URL(location, currentUrl);
    } catch (error) {
      throw new PublicWebsiteRequestError(
        'INVALID_DESTINATION',
        'The destination returned an invalid redirect.',
        { cause: error },
      );
    }

    currentUrl = validateUrl(redirectedUrl.href);
    redirects += 1;
  }
}
