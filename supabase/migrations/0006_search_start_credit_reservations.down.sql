DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_credit_reservations
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0006 rollback: search-credit reservation history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER search_jobs_provenance_immutable
  ON crewcast.search_jobs;

CREATE OR REPLACE FUNCTION crewcast.enforce_search_job_provenance_immutable()
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

DROP TRIGGER search_credit_reservations_immutable
  ON crewcast.search_credit_reservations;
DROP FUNCTION crewcast.enforce_search_credit_reservation_immutable();

DROP TABLE crewcast.search_credit_reservations;
