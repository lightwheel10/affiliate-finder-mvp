-- Run only after every application writer supplies brand_id and
-- brand_location_id and all pre-cutover application instances have drained.

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates
    WHERE brand_id IS NULL OR brand_location_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot cut over: discovered affiliates contain missing location ownership.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates
    WHERE brand_id IS NULL OR brand_location_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot cut over: saved affiliates contain missing location ownership.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_job_results
    WHERE brand_id IS NULL OR brand_location_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot cut over: search result occurrences contain missing location provenance.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_job_results AS results
    JOIN crewcast.search_jobs AS jobs
      ON jobs.id = results.search_job_id
     AND jobs.user_id = results.user_id
    WHERE results.brand_id IS DISTINCT FROM jobs.brand_id
       OR results.brand_location_id IS DISTINCT FROM jobs.brand_location_id
  ) THEN
    RAISE EXCEPTION 'Cannot cut over: a search result occurrence does not match its search job location.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.search_job_results AS results
    JOIN crewcast.discovered_affiliates AS affiliates
      ON affiliates.id = results.discovered_affiliate_id
     AND affiliates.user_id = results.user_id
    WHERE results.discovered_affiliate_id IS NOT NULL
      AND (
        results.brand_id IS DISTINCT FROM affiliates.brand_id
        OR results.brand_location_id IS DISTINCT FROM affiliates.brand_location_id
      )
  ) THEN
    RAISE EXCEPTION 'Cannot cut over: a search result occurrence points to an affiliate in another location.';
  END IF;
END;
$block$;

ALTER TABLE crewcast.discovered_affiliates
  ALTER COLUMN brand_id SET NOT NULL,
  ALTER COLUMN brand_location_id SET NOT NULL,
  DROP CONSTRAINT discovered_affiliates_user_id_link_key;

ALTER TABLE crewcast.saved_affiliates
  ALTER COLUMN brand_id SET NOT NULL,
  ALTER COLUMN brand_location_id SET NOT NULL,
  DROP CONSTRAINT saved_affiliates_user_id_link_key;

ALTER TABLE crewcast.search_job_results
  ALTER COLUMN brand_id SET NOT NULL,
  ALTER COLUMN brand_location_id SET NOT NULL;

-- Ownership is historical provenance, not editable categorization. API routes
-- already omit these columns from updates; these triggers also protect against
-- future server code accidentally moving an existing customer record.
CREATE FUNCTION crewcast.prevent_affiliate_location_identity_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(NEW.user_id, NEW.brand_id, NEW.brand_location_id)
     IS DISTINCT FROM
     ROW(OLD.user_id, OLD.brand_id, OLD.brand_location_id) THEN
    RAISE EXCEPTION 'Affiliate account, brand and location ownership are immutable once recorded.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER discovered_affiliates_location_identity_immutable
BEFORE UPDATE OF user_id, brand_id, brand_location_id
ON crewcast.discovered_affiliates
FOR EACH ROW
EXECUTE FUNCTION crewcast.prevent_affiliate_location_identity_update();

CREATE TRIGGER saved_affiliates_location_identity_immutable
BEFORE UPDATE OF user_id, brand_id, brand_location_id
ON crewcast.saved_affiliates
FOR EACH ROW
EXECUTE FUNCTION crewcast.prevent_affiliate_location_identity_update();

-- Migration 0005 made result snapshots immutable before brand/location columns
-- existed. Replace that same trigger function so the newly added ownership and
-- canonical-affiliate reference are covered by the provenance boundary too.
-- The one deliberate exception is ON DELETE SET NULL from the exact affiliate
-- foreign key: deleting a canonical row must retain its immutable result
-- snapshot, while changing or attaching a canonical reference remains blocked.
CREATE OR REPLACE FUNCTION crewcast.prevent_search_result_provenance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.search_job_id,
    NEW.user_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.result_link,
    NEW.affiliate_was_new,
    NEW.result_snapshot
  ) IS DISTINCT FROM ROW(
    OLD.search_job_id,
    OLD.user_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.result_link,
    OLD.affiliate_was_new,
    OLD.result_snapshot
  ) OR (
    NEW.discovered_affiliate_id IS DISTINCT FROM OLD.discovered_affiliate_id
    AND NEW.discovered_affiliate_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Search result provenance is immutable once recorded.';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON COLUMN crewcast.discovered_affiliates.brand_location_id IS
  'Required immutable owner location. Duplicate links are rejected only within this location.';

COMMENT ON COLUMN crewcast.saved_affiliates.brand_location_id IS
  'Required immutable owner location. Duplicate links are rejected only within this location.';

COMMENT ON COLUMN crewcast.search_job_results.brand_location_id IS
  'Required immutable location snapshot inherited from the owning search job.';
