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

DO $rollback_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.brands
    WHERE legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.brand_locations
    WHERE legacy_imported_at IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: runtime brand or location data exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.brands
    WHERE legacy_imported_at IS NOT NULL
      AND updated_at IS DISTINCT FROM created_at
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.brand_locations
    WHERE legacy_imported_at IS NOT NULL
      AND updated_at IS DISTINCT FROM created_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: an imported brand or location was edited.';
  END IF;

  IF EXISTS (SELECT 1 FROM crewcast.search_job_results LIMIT 1) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: search result provenance exists.';
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
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: API or credit location attribution exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_jobs
    WHERE brand_id IS NOT NULL AND legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.searches
    WHERE brand_id IS NOT NULL AND legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates
    WHERE brand_id IS NOT NULL AND legacy_imported_at IS NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates
    WHERE brand_id IS NOT NULL AND legacy_imported_at IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: runtime activity attribution exists.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_jobs AS jobs
    WHERE jobs.legacy_imported_at IS NOT NULL
      AND (
        jobs.settings_snapshot IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM crewcast.brand_locations AS locations
          JOIN crewcast.brands AS brands
            ON brands.id = locations.brand_id
           AND brands.user_id = locations.user_id
          WHERE locations.id = jobs.brand_location_id
            AND locations.brand_id = jobs.brand_id
            AND locations.user_id = jobs.user_id
            AND locations.is_default
            AND locations.legacy_imported_at IS NOT NULL
            AND brands.is_default
            AND brands.legacy_imported_at IS NOT NULL
        )
      )
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.searches AS searches
    WHERE searches.legacy_imported_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.brand_locations AS locations
        JOIN crewcast.brands AS brands
          ON brands.id = locations.brand_id
         AND brands.user_id = locations.user_id
        WHERE locations.id = searches.brand_location_id
          AND locations.brand_id = searches.brand_id
          AND locations.user_id = searches.user_id
          AND locations.is_default
          AND locations.legacy_imported_at IS NOT NULL
          AND brands.is_default
          AND brands.legacy_imported_at IS NOT NULL
      )
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates AS affiliates
    WHERE affiliates.legacy_imported_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.brand_locations AS locations
        JOIN crewcast.brands AS brands
          ON brands.id = locations.brand_id
         AND brands.user_id = locations.user_id
        WHERE locations.id = affiliates.brand_location_id
          AND locations.brand_id = affiliates.brand_id
          AND locations.user_id = affiliates.user_id
          AND locations.is_default
          AND locations.legacy_imported_at IS NOT NULL
          AND brands.is_default
          AND brands.legacy_imported_at IS NOT NULL
      )
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates AS affiliates
    WHERE affiliates.legacy_imported_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.brand_locations AS locations
        JOIN crewcast.brands AS brands
          ON brands.id = locations.brand_id
         AND brands.user_id = locations.user_id
        WHERE locations.id = affiliates.brand_location_id
          AND locations.brand_id = affiliates.brand_id
          AND locations.user_id = affiliates.user_id
          AND locations.is_default
          AND locations.legacy_imported_at IS NOT NULL
          AND brands.is_default
          AND brands.legacy_imported_at IS NOT NULL
      )
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0003: imported activity no longer has its exact imported default attribution.';
  END IF;
END;
$rollback_guard$;

DROP TRIGGER saved_affiliates_legacy_import_marker_immutable
  ON crewcast.saved_affiliates;
DROP TRIGGER discovered_affiliates_legacy_import_marker_immutable
  ON crewcast.discovered_affiliates;
DROP TRIGGER searches_legacy_import_marker_immutable
  ON crewcast.searches;
DROP TRIGGER search_jobs_legacy_import_marker_immutable
  ON crewcast.search_jobs;
DROP TRIGGER brand_locations_legacy_import_marker_immutable
  ON crewcast.brand_locations;
DROP TRIGGER brands_legacy_import_marker_immutable
  ON crewcast.brands;
DROP FUNCTION crewcast.enforce_legacy_import_marker_immutable();

DROP TRIGGER search_jobs_provenance_immutable ON crewcast.search_jobs;
DROP FUNCTION crewcast.enforce_search_job_provenance_immutable();

UPDATE crewcast.search_jobs
SET
  brand_id = NULL,
  brand_location_id = NULL,
  settings_snapshot = NULL,
  legacy_imported_at = NULL
WHERE legacy_imported_at IS NOT NULL;

UPDATE crewcast.searches
SET
  brand_id = NULL,
  brand_location_id = NULL,
  legacy_imported_at = NULL
WHERE legacy_imported_at IS NOT NULL;

UPDATE crewcast.discovered_affiliates
SET
  brand_id = NULL,
  brand_location_id = NULL,
  legacy_imported_at = NULL
WHERE legacy_imported_at IS NOT NULL;

UPDATE crewcast.saved_affiliates
SET
  brand_id = NULL,
  brand_location_id = NULL,
  legacy_imported_at = NULL
WHERE legacy_imported_at IS NOT NULL;

DELETE FROM crewcast.brand_locations
WHERE legacy_imported_at IS NOT NULL;

DELETE FROM crewcast.brands
WHERE legacy_imported_at IS NOT NULL;

-- Migration 0002 intentionally made owner foreign keys deferrable. Flush all
-- queued ownership checks before altering the referenced foundation tables.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE crewcast.saved_affiliates
  DROP CONSTRAINT saved_affiliates_legacy_import_consistency_check,
  DROP COLUMN legacy_imported_at;

ALTER TABLE crewcast.discovered_affiliates
  DROP CONSTRAINT discovered_affiliates_legacy_import_consistency_check,
  DROP COLUMN legacy_imported_at;

ALTER TABLE crewcast.searches
  DROP CONSTRAINT searches_legacy_import_consistency_check,
  DROP COLUMN legacy_imported_at;

ALTER TABLE crewcast.search_jobs
  DROP CONSTRAINT search_jobs_legacy_import_consistency_check,
  DROP COLUMN legacy_imported_at;

ALTER TABLE crewcast.brand_locations
  DROP CONSTRAINT brand_locations_legacy_import_default_check,
  DROP COLUMN legacy_imported_at;

ALTER TABLE crewcast.brands
  DROP CONSTRAINT brands_legacy_import_default_check,
  DROP COLUMN legacy_imported_at;

CREATE FUNCTION crewcast.enforce_search_job_provenance_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.settings_snapshot IS NOT NULL
     AND NEW.settings_snapshot IS DISTINCT FROM OLD.settings_snapshot THEN
    RAISE EXCEPTION 'search_jobs.settings_snapshot cannot be changed after assignment';
  END IF;

  IF OLD.brand_id IS NOT NULL
     AND (
       NEW.brand_id IS DISTINCT FROM OLD.brand_id
       OR NEW.brand_location_id IS DISTINCT FROM OLD.brand_location_id
     ) THEN
    RAISE EXCEPTION 'search_jobs brand/location attribution cannot be changed after assignment';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_jobs_provenance_immutable
BEFORE UPDATE OF brand_id, brand_location_id, settings_snapshot
ON crewcast.search_jobs
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_job_provenance_immutable();
