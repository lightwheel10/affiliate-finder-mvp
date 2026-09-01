const PRODUCTION_APP_URL = 'https://afforce.revenueworks.ai';

/**
 * Returns the canonical application URL for the current deployment.
 *
 * Preview branches set both URL variables explicitly. Production keeps the
 * established domain as a safe fallback until its own variables are added.
 */
export function getAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return (configuredUrl || PRODUCTION_APP_URL).replace(/\/+$/, '');
}
