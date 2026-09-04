SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

LOCK TABLE
  crewcast.users,
  crewcast.subscriptions,
  crewcast.brands,
  crewcast.brand_locations,
  crewcast.search_jobs,
  crewcast.searches,
  crewcast.discovered_affiliates,
  crewcast.saved_affiliates,
  crewcast.api_calls,
  crewcast.credit_transactions,
  crewcast.search_job_results
IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.brands LIMIT 1)
     OR EXISTS (SELECT 1 FROM crewcast.brand_locations LIMIT 1)
     OR EXISTS (SELECT 1 FROM crewcast.search_job_results LIMIT 1) THEN
    RAISE EXCEPTION
      'Refusing 0003: foundation data already exists. Re-audit before historical backfill.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_jobs
    WHERE brand_id IS NOT NULL
       OR brand_location_id IS NOT NULL
       OR settings_snapshot IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.searches
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.api_calls
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.credit_transactions
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0003: provenance data already exists. Re-audit before historical backfill.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.users
    WHERE (target_country IS NULL) <> (target_language IS NULL)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0003: a legacy user has an incomplete country/language pair.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.users
    WHERE target_country IS NOT NULL
      AND target_country <> ALL (ARRAY[
        'United States',
        'Canada',
        'United Kingdom',
        'Germany',
        'France',
        'Netherlands',
        'Belgium',
        'Switzerland',
        'Austria',
        'Ireland',
        'Denmark',
        'Sweden',
        'Norway',
        'Finland',
        'Spain',
        'Italy',
        'Portugal',
        'Poland',
        'Czech Republic',
        'Australia',
        'New Zealand',
        'Japan',
        'South Korea',
        'Singapore',
        'United Arab Emirates',
        'Israel',
        'Saudi Arabia'
      ]::varchar[])
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0003: a legacy user has a country outside the application catalog.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.users
    WHERE target_language IS NOT NULL
      AND target_language <> ALL (ARRAY[
        'English',
        'Spanish',
        'German',
        'French',
        'Portuguese',
        'Italian',
        'Dutch',
        'Swedish',
        'Danish',
        'Norwegian',
        'Finnish',
        'Polish',
        'Czech',
        'Japanese',
        'Korean',
        'Arabic',
        'Hebrew'
      ]::varchar[])
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0003: a legacy user has a language outside the application catalog.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.users
    WHERE char_length(COALESCE(NULLIF(btrim(brand), ''), 'Unconfigured')) > 255
       OR char_length(bio) > 5000
       OR cardinality(COALESCE(topics, ARRAY[]::text[])) > 5
       OR cardinality(COALESCE(competitors, ARRAY[]::text[])) > 5
       OR cardinality(COALESCE(affiliate_types, ARRAY[]::text[])) > 20
       OR array_position(COALESCE(topics, ARRAY[]::text[]), NULL) IS NOT NULL
       OR array_position(COALESCE(competitors, ARRAY[]::text[]), NULL) IS NOT NULL
       OR array_position(COALESCE(affiliate_types, ARRAY[]::text[]), NULL) IS NOT NULL
       OR (
         array_ndims(COALESCE(topics, ARRAY[]::text[])) IS NOT NULL
         AND array_ndims(COALESCE(topics, ARRAY[]::text[])) <> 1
       )
       OR (
         array_ndims(COALESCE(competitors, ARRAY[]::text[])) IS NOT NULL
         AND array_ndims(COALESCE(competitors, ARRAY[]::text[])) <> 1
       )
       OR (
         array_ndims(COALESCE(affiliate_types, ARRAY[]::text[])) IS NOT NULL
         AND array_ndims(COALESCE(affiliate_types, ARRAY[]::text[])) <> 1
       )
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0003: a legacy profile exceeds the brand/location foundation constraints.';
  END IF;
END;
$preflight$;

ALTER TABLE crewcast.brands
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT brands_legacy_import_default_check
    CHECK (
      legacy_imported_at IS NULL
      OR (is_default AND archived_at IS NULL)
    );

ALTER TABLE crewcast.brand_locations
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT brand_locations_legacy_import_default_check
    CHECK (
      legacy_imported_at IS NULL
      OR (is_default AND archived_at IS NULL)
    );

ALTER TABLE crewcast.search_jobs
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT search_jobs_legacy_import_consistency_check
    CHECK (
      legacy_imported_at IS NULL
      OR (
        brand_id IS NOT NULL
        AND brand_location_id IS NOT NULL
        AND settings_snapshot IS NOT NULL
      )
    );

ALTER TABLE crewcast.searches
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT searches_legacy_import_consistency_check
    CHECK (
      legacy_imported_at IS NULL
      OR (brand_id IS NOT NULL AND brand_location_id IS NOT NULL)
    );

ALTER TABLE crewcast.discovered_affiliates
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT discovered_affiliates_legacy_import_consistency_check
    CHECK (
      legacy_imported_at IS NULL
      OR (brand_id IS NOT NULL AND brand_location_id IS NOT NULL)
    );

ALTER TABLE crewcast.saved_affiliates
  ADD COLUMN legacy_imported_at timestamptz,
  ADD CONSTRAINT saved_affiliates_legacy_import_consistency_check
    CHECK (
      legacy_imported_at IS NULL
      OR (brand_id IS NOT NULL AND brand_location_id IS NOT NULL)
    );

CREATE FUNCTION crewcast.enforce_legacy_import_marker_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.legacy_imported_at IS NOT NULL
     AND NEW.legacy_imported_at IS DISTINCT FROM OLD.legacy_imported_at THEN
    RAISE EXCEPTION 'legacy_imported_at cannot be changed after assignment';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER brands_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.brands
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE TRIGGER brand_locations_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.brand_locations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE TRIGGER search_jobs_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.search_jobs
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE TRIGGER searches_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.searches
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE TRIGGER discovered_affiliates_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.discovered_affiliates
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE TRIGGER saved_affiliates_legacy_import_marker_immutable
BEFORE UPDATE OF legacy_imported_at ON crewcast.saved_affiliates
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_legacy_import_marker_immutable();

CREATE FUNCTION crewcast.parse_legacy_settings_snapshot(input_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  parsed_value jsonb;
BEGIN
  IF input_value IS NULL THEN
    RETURN jsonb_build_object('legacySnapshotUnavailable', true);
  END IF;

  IF jsonb_typeof(input_value) = 'object' THEN
    RETURN input_value;
  END IF;

  IF jsonb_typeof(input_value) = 'string' THEN
    BEGIN
      parsed_value := (input_value #>> '{}')::jsonb;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN jsonb_build_object('legacySnapshotUnavailable', true);
    END;

    IF jsonb_typeof(parsed_value) = 'object' THEN
      RETURN parsed_value;
    END IF;
  END IF;

  RETURN jsonb_build_object('legacySnapshotUnavailable', true);
END;
$function$;

WITH brand_candidates AS (
  SELECT
    users.id AS user_id,
    COALESCE(NULLIF(btrim(users.brand), ''), 'Unconfigured') AS brand_name,
    users.bio,
    COALESCE(users.affiliate_types, ARRAY[]::text[]) AS affiliate_types,
    regexp_replace(
      lower(
        split_part(
          split_part(
            split_part(
              split_part(
                regexp_replace(btrim(users.brand), '^https?://', '', 'i'),
                '/',
                1
              ),
              '?',
              1
            ),
            '#',
            1
          ),
          ':',
          1
        )
      ),
      '^www\.',
      '',
      'i'
    ) AS normalized_domain
  FROM crewcast.users
)
INSERT INTO crewcast.brands (
  user_id,
  name,
  normalized_domain,
  bio,
  affiliate_types,
  is_default,
  legacy_imported_at
)
SELECT
  candidates.user_id,
  candidates.brand_name,
  CASE
    WHEN char_length(candidates.normalized_domain) <= 253
     AND candidates.normalized_domain
       ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
      THEN candidates.normalized_domain
    ELSE NULL
  END,
  candidates.bio,
  candidates.affiliate_types,
  true,
  CURRENT_TIMESTAMP
FROM brand_candidates AS candidates
WHERE NOT EXISTS (
  SELECT 1
  FROM crewcast.brands AS existing
  WHERE existing.user_id = candidates.user_id
    AND existing.archived_at IS NULL
    AND existing.is_default
);

WITH
country_catalog(country_name, country_code) AS (
  VALUES
    ('United States', 'us'),
    ('Canada', 'ca'),
    ('United Kingdom', 'gb'),
    ('Germany', 'de'),
    ('France', 'fr'),
    ('Netherlands', 'nl'),
    ('Belgium', 'be'),
    ('Switzerland', 'ch'),
    ('Austria', 'at'),
    ('Ireland', 'ie'),
    ('Denmark', 'dk'),
    ('Sweden', 'se'),
    ('Norway', 'no'),
    ('Finland', 'fi'),
    ('Spain', 'es'),
    ('Italy', 'it'),
    ('Portugal', 'pt'),
    ('Poland', 'pl'),
    ('Czech Republic', 'cz'),
    ('Australia', 'au'),
    ('New Zealand', 'nz'),
    ('Japan', 'jp'),
    ('South Korea', 'kr'),
    ('Singapore', 'sg'),
    ('United Arab Emirates', 'ae'),
    ('Israel', 'il'),
    ('Saudi Arabia', 'sa')
),
language_catalog(language_name, language_code) AS (
  VALUES
    ('English', 'en'),
    ('Spanish', 'es'),
    ('German', 'de'),
    ('French', 'fr'),
    ('Portuguese', 'pt'),
    ('Italian', 'it'),
    ('Dutch', 'nl'),
    ('Swedish', 'sv'),
    ('Danish', 'da'),
    ('Norwegian', 'no'),
    ('Finnish', 'fi'),
    ('Polish', 'pl'),
    ('Czech', 'cs'),
    ('Japanese', 'ja'),
    ('Korean', 'ko'),
    ('Arabic', 'ar'),
    ('Hebrew', 'he')
)
INSERT INTO crewcast.brand_locations (
  user_id,
  brand_id,
  country_code,
  language_code,
  topics,
  competitors,
  is_default,
  auto_scan_enabled,
  last_auto_scan_at,
  next_auto_scan_at,
  legacy_imported_at
)
SELECT
  users.id,
  brands.id,
  countries.country_code,
  languages.language_code,
  COALESCE(users.topics, ARRAY[]::text[]),
  COALESCE(users.competitors, ARRAY[]::text[]),
  true,
  users.auto_scan_enabled,
  subscriptions.last_auto_scan_at,
  subscriptions.next_auto_scan_at,
  CURRENT_TIMESTAMP
FROM crewcast.users AS users
JOIN crewcast.brands AS brands
  ON brands.user_id = users.id
 AND brands.archived_at IS NULL
 AND brands.is_default
LEFT JOIN crewcast.subscriptions AS subscriptions
  ON subscriptions.user_id = users.id
LEFT JOIN country_catalog AS countries
  ON countries.country_name = users.target_country
LEFT JOIN language_catalog AS languages
  ON languages.language_name = users.target_language
WHERE NOT EXISTS (
  SELECT 1
  FROM crewcast.brand_locations AS existing
  WHERE existing.brand_id = brands.id
    AND existing.archived_at IS NULL
    AND existing.is_default
);

WITH default_locations AS (
  SELECT
    locations.user_id,
    locations.brand_id,
    locations.id AS brand_location_id
  FROM crewcast.brand_locations AS locations
  JOIN crewcast.brands AS brands
    ON brands.id = locations.brand_id
   AND brands.user_id = locations.user_id
  WHERE brands.archived_at IS NULL
    AND brands.is_default
    AND locations.archived_at IS NULL
    AND locations.is_default
)
UPDATE crewcast.search_jobs AS jobs
SET
  brand_id = defaults.brand_id,
  brand_location_id = defaults.brand_location_id,
  settings_snapshot = COALESCE(
    jobs.settings_snapshot,
    crewcast.parse_legacy_settings_snapshot(jobs.user_settings)
  ),
  legacy_imported_at = CURRENT_TIMESTAMP
FROM default_locations AS defaults
WHERE defaults.user_id = jobs.user_id
  AND jobs.brand_id IS NULL
  AND jobs.brand_location_id IS NULL;

WITH default_locations AS (
  SELECT
    locations.user_id,
    locations.brand_id,
    locations.id AS brand_location_id
  FROM crewcast.brand_locations AS locations
  JOIN crewcast.brands AS brands
    ON brands.id = locations.brand_id
   AND brands.user_id = locations.user_id
  WHERE brands.archived_at IS NULL
    AND brands.is_default
    AND locations.archived_at IS NULL
    AND locations.is_default
)
UPDATE crewcast.searches AS searches
SET
  brand_id = defaults.brand_id,
  brand_location_id = defaults.brand_location_id,
  legacy_imported_at = CURRENT_TIMESTAMP
FROM default_locations AS defaults
WHERE defaults.user_id = searches.user_id
  AND searches.brand_id IS NULL
  AND searches.brand_location_id IS NULL;

WITH default_locations AS (
  SELECT
    locations.user_id,
    locations.brand_id,
    locations.id AS brand_location_id
  FROM crewcast.brand_locations AS locations
  JOIN crewcast.brands AS brands
    ON brands.id = locations.brand_id
   AND brands.user_id = locations.user_id
  WHERE brands.archived_at IS NULL
    AND brands.is_default
    AND locations.archived_at IS NULL
    AND locations.is_default
)
UPDATE crewcast.discovered_affiliates AS affiliates
SET
  brand_id = defaults.brand_id,
  brand_location_id = defaults.brand_location_id,
  legacy_imported_at = CURRENT_TIMESTAMP
FROM default_locations AS defaults
WHERE defaults.user_id = affiliates.user_id
  AND affiliates.brand_id IS NULL
  AND affiliates.brand_location_id IS NULL;

WITH default_locations AS (
  SELECT
    locations.user_id,
    locations.brand_id,
    locations.id AS brand_location_id
  FROM crewcast.brand_locations AS locations
  JOIN crewcast.brands AS brands
    ON brands.id = locations.brand_id
   AND brands.user_id = locations.user_id
  WHERE brands.archived_at IS NULL
    AND brands.is_default
    AND locations.archived_at IS NULL
    AND locations.is_default
)
UPDATE crewcast.saved_affiliates AS affiliates
SET
  brand_id = defaults.brand_id,
  brand_location_id = defaults.brand_location_id,
  legacy_imported_at = CURRENT_TIMESTAMP
FROM default_locations AS defaults
WHERE defaults.user_id = affiliates.user_id
  AND affiliates.brand_id IS NULL
  AND affiliates.brand_location_id IS NULL;

DROP FUNCTION crewcast.parse_legacy_settings_snapshot(jsonb);

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.users AS users
    WHERE (
      SELECT count(*)
      FROM crewcast.brands AS brands
      WHERE brands.user_id = users.id
        AND brands.archived_at IS NULL
        AND brands.is_default
    ) <> 1
    OR (
      SELECT count(*)
      FROM crewcast.brand_locations AS locations
      JOIN crewcast.brands AS brands
        ON brands.id = locations.brand_id
       AND brands.user_id = locations.user_id
      WHERE locations.user_id = users.id
        AND locations.archived_at IS NULL
        AND locations.is_default
        AND brands.archived_at IS NULL
        AND brands.is_default
    ) <> 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      '0003 postflight failed: every user must have exactly one imported default brand and location.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_jobs
    WHERE brand_id IS NULL
       OR brand_location_id IS NULL
       OR settings_snapshot IS NULL
       OR jsonb_typeof(settings_snapshot) <> 'object'
       OR legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.searches
    WHERE brand_id IS NULL
       OR brand_location_id IS NULL
       OR legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates
    WHERE brand_id IS NULL
       OR brand_location_id IS NULL
       OR legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates
    WHERE brand_id IS NULL
       OR brand_location_id IS NULL
       OR legacy_imported_at IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      '0003 postflight failed: a historical activity row lacks imported provenance.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.api_calls
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.credit_transactions
    WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (SELECT 1 FROM crewcast.search_job_results LIMIT 1) THEN
    RAISE EXCEPTION
      '0003 postflight failed: uncertain historical provenance was synthesized.';
  END IF;
END;
$postflight$;

COMMENT ON COLUMN crewcast.brands.legacy_imported_at IS
  'Set only on the default brand created by migration 0003 from the legacy account profile.';
COMMENT ON COLUMN crewcast.brand_locations.legacy_imported_at IS
  'Set only on the default location created by migration 0003 from legacy profile and subscription settings.';
COMMENT ON COLUMN crewcast.search_jobs.legacy_imported_at IS
  'Marks a job assigned to its account default location by migration 0003; this does not claim exact historical market provenance.';
COMMENT ON COLUMN crewcast.searches.legacy_imported_at IS
  'Marks a search assigned to its account default location by migration 0003.';
COMMENT ON COLUMN crewcast.discovered_affiliates.legacy_imported_at IS
  'Marks a canonical affiliate assigned to its account default location by migration 0003.';
COMMENT ON COLUMN crewcast.saved_affiliates.legacy_imported_at IS
  'Marks a saved affiliate assigned to its account default location by migration 0003.';
