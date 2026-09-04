import 'server-only';

import {
  resolveBrandLocationContext as resolveWithLookup,
  type BrandLocationContext,
  type BrandLocationContextLookup,
  type BrandLocationContextLookupRow,
  type ResolveBrandLocationContextInput,
} from '@/lib/brand-locations/context';
import { sql } from '@/lib/db';

export interface BrandLocationSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

function createLookup(
  executor: BrandLocationSqlExecutor,
): BrandLocationContextLookup {
  return async ({ accountId, requestedBrandLocationId }) => {
    const rows = await executor<BrandLocationContextLookupRow>`
      SELECT
        ${accountId}::integer AS account_id,
        brands.user_id AS brand_user_id,
        locations.user_id AS location_user_id,
        brands.id::text AS brand_id,
        locations.id::text AS brand_location_id,
        brands.name AS brand_name,
        brands.normalized_domain,
        brands.bio,
        brands.affiliate_types,
        brands.is_default AS brand_is_default,
        brands.archived_at AS brand_archived_at,
        locations.country_code,
        locations.language_code,
        locations.topics,
        locations.competitors,
        locations.is_default AS location_is_default,
        locations.auto_scan_enabled,
        locations.archived_at AS location_archived_at
      FROM crewcast.brand_locations AS locations
      JOIN crewcast.brands AS brands
        ON brands.id = locations.brand_id
       AND brands.user_id = locations.user_id
      WHERE brands.user_id = ${accountId}
        AND locations.user_id = ${accountId}
        AND brands.archived_at IS NULL
        AND locations.archived_at IS NULL
        AND (
          (
            ${requestedBrandLocationId}::bigint IS NOT NULL
            AND locations.id = ${requestedBrandLocationId}::bigint
          )
          OR (
            ${requestedBrandLocationId}::bigint IS NULL
            AND brands.is_default
            AND locations.is_default
          )
        )
      ORDER BY brands.id, locations.id
      LIMIT 2
    `;

    return rows;
  };
}

export async function resolveServerBrandLocationContext(
  input: ResolveBrandLocationContextInput,
  executor: BrandLocationSqlExecutor = sql as BrandLocationSqlExecutor,
): Promise<BrandLocationContext> {
  return resolveWithLookup(input, createLookup(executor));
}
