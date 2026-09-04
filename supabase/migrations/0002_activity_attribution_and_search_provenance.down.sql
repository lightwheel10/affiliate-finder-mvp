DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.search_job_results LIMIT 1)
     OR EXISTS (
       SELECT 1
       FROM crewcast.search_jobs
       WHERE brand_id IS NOT NULL
          OR brand_location_id IS NOT NULL
          OR settings_snapshot IS NOT NULL
       LIMIT 1
     )
     OR EXISTS (
       SELECT 1 FROM crewcast.searches
       WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
       LIMIT 1
     )
     OR EXISTS (
       SELECT 1 FROM crewcast.discovered_affiliates
       WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
       LIMIT 1
     )
     OR EXISTS (
       SELECT 1 FROM crewcast.saved_affiliates
       WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
       LIMIT 1
     )
     OR EXISTS (
       SELECT 1 FROM crewcast.api_calls
       WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
       LIMIT 1
     )
     OR EXISTS (
       SELECT 1 FROM crewcast.credit_transactions
       WHERE brand_id IS NOT NULL OR brand_location_id IS NOT NULL
       LIMIT 1
     ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0002: brand/location attribution or search provenance data exists.';
  END IF;
END;
$rollback_guard$;

DROP TABLE crewcast.search_job_results;

DROP TRIGGER search_jobs_provenance_immutable ON crewcast.search_jobs;
DROP FUNCTION crewcast.enforce_search_job_provenance_immutable();

DROP INDEX crewcast.credit_transactions_brand_location_created_at_idx;
DROP INDEX crewcast.api_calls_brand_location_created_at_idx;
DROP INDEX crewcast.saved_affiliates_brand_location_saved_at_idx;
DROP INDEX crewcast.discovered_affiliates_brand_location_discovered_at_idx;
DROP INDEX crewcast.searches_brand_location_searched_at_idx;
DROP INDEX crewcast.search_jobs_brand_location_created_at_idx;

ALTER TABLE crewcast.credit_transactions
  DROP CONSTRAINT credit_transactions_brand_location_owner_fkey,
  DROP CONSTRAINT credit_transactions_brand_location_pair_check,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.api_calls
  DROP CONSTRAINT api_calls_brand_location_owner_fkey,
  DROP CONSTRAINT api_calls_brand_location_context_check,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.saved_affiliates
  DROP CONSTRAINT saved_affiliates_brand_location_owner_fkey,
  DROP CONSTRAINT saved_affiliates_brand_location_pair_check,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.discovered_affiliates
  DROP CONSTRAINT discovered_affiliates_brand_location_owner_fkey,
  DROP CONSTRAINT discovered_affiliates_brand_location_pair_check,
  DROP CONSTRAINT discovered_affiliates_id_user_id_key,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.searches
  DROP CONSTRAINT searches_brand_location_owner_fkey,
  DROP CONSTRAINT searches_brand_location_pair_check,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.search_jobs
  DROP CONSTRAINT search_jobs_brand_location_owner_fkey,
  DROP CONSTRAINT search_jobs_settings_snapshot_object_check,
  DROP CONSTRAINT search_jobs_brand_location_pair_check,
  DROP CONSTRAINT search_jobs_id_user_id_key,
  DROP COLUMN settings_snapshot,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.brand_locations
  DROP CONSTRAINT brand_locations_id_brand_id_user_id_key;
