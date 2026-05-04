/**
 * Transactional email sender (Resend).
 *
 * Created 2026-05-01.
 * Replaces src/lib/n8n-webhook.ts (deleted — see git history).
 *
 * Safety guarantees:
 * - Fire-and-forget: never throws into the caller. A failed email send NEVER
 *   breaks a user-facing API route. Errors are logged and swallowed.
 * - Kill switch: set EMAILS_ENABLED=false in env to halt ALL sends instantly,
 *   no redeploy needed.
 * - Graceful no-op when RESEND_API_KEY is not configured (e.g. local dev
 *   without the key) — logs a warning and returns.
 */
import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAILS_ENABLED = process.env.EMAILS_ENABLED !== 'false'; // default true

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export type SupportedLocale = 'en' | 'de';

/**
 * Detect locale from the request's Accept-Language header.
 * Used at signup time when we don't yet have a stored language preference.
 * Defaults to 'en' on anything unrecognized.
 */
export function detectLocale(acceptLanguage: string | null | undefined): SupportedLocale {
  if (!acceptLanguage) return 'en';
  return acceptLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
}

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
}

/**
 * Send a transactional email. NEVER throws — always returns.
 * Failures are logged. Caller does not need to handle errors.
 */
export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<void> {
  if (!EMAILS_ENABLED) {
    console.log(`[Email] 🔕 Disabled (EMAILS_ENABLED=false). Would have sent: "${subject}" → ${to}`);
    return;
  }

  if (!resend) {
    console.warn(`[Email] ⚠️ RESEND_API_KEY not configured. Skipping: "${subject}" → ${to}`);
    return;
  }

  if (!EMAIL_FROM) {
    console.warn(`[Email] ⚠️ EMAIL_FROM not configured. Skipping: "${subject}" → ${to}`);
    return;
  }

  try {
    const html = await render(react);
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error(`[Email] ❌ Resend rejected "${subject}" → ${to}:`, result.error);
      return;
    }

    console.log(`[Email] ✅ Sent "${subject}" → ${to} (id: ${result.data?.id ?? 'unknown'})`);
  } catch (error) {
    // Catch-all — template render errors, network errors, anything.
    // Never propagates to the caller.
    console.error(`[Email] ❌ Exception sending "${subject}" → ${to}:`, error);
  }
}
