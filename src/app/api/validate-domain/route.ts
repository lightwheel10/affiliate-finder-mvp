import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { normalizeBrandDomain } from '@/lib/brands/domain';
import {
  probePublicWebsite,
  PublicWebsiteRequestError,
  type PublicWebsiteMethod,
} from '@/lib/network/public-website';
import { getAuthenticatedUser } from '@/lib/supabase/server';

const MAX_REQUEST_BODY_BYTES = 2 * 1_024;
const REACHABILITY_DEADLINE_MS = 12_000;

export const runtime = 'nodejs';

interface ReachabilityAttempt {
  method: PublicWebsiteMethod;
  protocol: 'http' | 'https';
}

const REACHABILITY_ATTEMPTS: readonly ReachabilityAttempt[] = [
  { method: 'HEAD', protocol: 'https' },
  { method: 'GET', protocol: 'https' },
  { method: 'HEAD', protocol: 'http' },
  { method: 'GET', protocol: 'http' },
];

class DomainValidationApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainValidationApiError';
  }
}

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_REQUEST_BODY_BYTES) {
      throw new DomainValidationApiError(413, 'Request body is too large');
    }
  }

  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON body');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let receivedBytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new DomainValidationApiError(413, 'Request body is too large');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof DomainValidationApiError) throw error;
    throw new SyntaxError('Invalid JSON body');
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(body) as unknown;
}

async function isDomainReachable(
  domain: string,
): Promise<{ reachable: boolean; protocol: 'https' | 'http' | null }> {
  const deadline = Date.now() + REACHABILITY_DEADLINE_MS;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; DomainValidator/2.0)',
  };

  for (const attempt of REACHABILITY_ATTEMPTS) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    try {
      const response = await probePublicWebsite(
        `${attempt.protocol}://${domain}`,
        {
          headers,
          method: attempt.method,
          timeoutMs: remainingMs,
        },
      );

      // Any syntactically valid HTTP response proves that the web server is
      // reachable. This preserves the previous onboarding behavior for 4xx and
      // 5xx sites while the network boundary remains fail-closed.
      if (response.status < 600) {
        return { reachable: true, protocol: attempt.protocol };
      }
    } catch (error) {
      const code = error instanceof PublicWebsiteRequestError ? error.code : 'UNKNOWN';
      console.info(
        `[validate-domain] ${attempt.protocol.toUpperCase()} ${attempt.method} failed`,
        { code, domain },
      );
    }
  }

  return { reachable: false, protocol: null };
}

export async function POST(request: NextRequest) {
  try {
    // Onboarding is an authenticated workflow. The old public endpoint let any
    // internet client spend server network resources.
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    if (!isSameOriginMutation(request.headers.get('origin'), request.nextUrl.origin)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid request origin' },
        { status: 403 },
      );
    }

    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return NextResponse.json(
        { valid: false, error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }

    const body = await readBoundedJson(request);
    const domain = body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).domain
      : undefined;
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Domain is required' },
        { status: 400 },
      );
    }

    const normalizedDomain = normalizeBrandDomain(domain);
    if (!normalizedDomain) {
      return NextResponse.json(
        { valid: false, error: 'Invalid domain format' },
        { status: 400 },
      );
    }

    const { reachable, protocol } = await isDomainReachable(normalizedDomain);
    if (!reachable) {
      return NextResponse.json({
        valid: false,
        normalizedDomain,
        error: 'Domain is not reachable. Please check the domain and try again.',
      });
    }

    return NextResponse.json({
      valid: true,
      normalizedDomain,
      protocol,
      message: 'Domain verified successfully',
    });
  } catch (error) {
    if (error instanceof DomainValidationApiError) {
      return NextResponse.json(
        { valid: false, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { valid: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    console.error('[validate-domain] Unexpected error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate domain' },
      { status: 500 },
    );
  }
}
