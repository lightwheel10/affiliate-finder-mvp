-- Hold the table lock through the transaction so a new launch marker cannot
-- appear after the safety check and before its columns are removed.
LOCK TABLE crewcast.search_credit_reservations IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_reconciliation_cases
    WHERE case_type = 'paid_search'
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.search_credit_reservations
    WHERE status = 'uncertain'
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.search_credit_reservations
    WHERE status = 'reserved'
      AND launch_attempted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Refusing 0019 rollback while paid-search reconciliation history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER search_credit_reservations_reconciliation_alert
  ON crewcast.search_credit_reservations;
DROP FUNCTION crewcast.alert_uncertain_paid_search();
DROP INDEX crewcast.search_reconciliation_cases_paid_request_key;

ALTER TABLE crewcast.search_reconciliation_cases
  DROP CONSTRAINT search_reconciliation_cases_type_check,
  DROP CONSTRAINT search_reconciliation_cases_source_shape_check;

ALTER TABLE crewcast.search_reconciliation_cases
  ADD CONSTRAINT search_reconciliation_cases_type_check
    CHECK (case_type IN ('enrichment_dispatch', 'onboarding_search')),
  ADD CONSTRAINT search_reconciliation_cases_source_shape_check
    CHECK (
      (
        case_type = 'enrichment_dispatch'
        AND search_job_id IS NOT NULL
        AND enrichment_dispatch_id IS NOT NULL
        AND platform IS NOT NULL
        AND source_request_id IS NULL
        AND jsonb_typeof(input_urls) = 'array'
        AND jsonb_array_length(input_urls) > 0
        AND input_fingerprint IS NOT NULL
        AND settings_snapshot IS NULL
      )
      OR (
        case_type = 'onboarding_search'
        AND search_job_id IS NULL
        AND enrichment_dispatch_id IS NULL
        AND platform IS NULL
        AND source_request_id IS NOT NULL
        AND input_urls IS NULL
        AND input_fingerprint IS NULL
        AND jsonb_typeof(settings_snapshot) = 'object'
      )
    );

ALTER TABLE crewcast.search_credit_reservations
  DROP CONSTRAINT search_credit_reservations_status_check,
  DROP CONSTRAINT search_credit_reservations_error_check,
  DROP CONSTRAINT search_credit_reservations_lifecycle_check;

ALTER TABLE crewcast.search_credit_reservations
  ADD CONSTRAINT search_credit_reservations_status_check
    CHECK (status IN ('reserved', 'consumed', 'released')),
  ADD CONSTRAINT search_credit_reservations_lifecycle_check
    CHECK (
      (
        status = 'reserved'
        AND consumed_at IS NULL
        AND released_at IS NULL
      )
      OR (
        status = 'consumed'
        AND search_job_id IS NOT NULL
        AND consumed_at IS NOT NULL
        AND released_at IS NULL
      )
      OR (
        status = 'released'
        AND consumed_at IS NULL
        AND released_at IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION crewcast.enforce_search_credit_reservation_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.request_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.settings_snapshot,
    NEW.credit_period_start,
    NEW.subscription_credits_consumed,
    NEW.topup_credits_consumed,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.request_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.settings_snapshot,
    OLD.credit_period_start,
    OLD.subscription_credits_consumed,
    OLD.topup_credits_consumed,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Search-credit reservation provenance is immutable.';
  END IF;

  IF OLD.search_job_id IS NOT NULL
     AND NEW.search_job_id IS DISTINCT FROM OLD.search_job_id THEN
    RAISE EXCEPTION 'A search-credit reservation cannot be reassigned to another job.';
  END IF;

  IF OLD.status <> 'reserved'
     AND ROW(
       NEW.status,
       NEW.search_job_id,
       NEW.consumed_at,
       NEW.released_at
     ) IS DISTINCT FROM ROW(
       OLD.status,
       OLD.search_job_id,
       OLD.consumed_at,
       OLD.released_at
     ) THEN
    RAISE EXCEPTION 'A terminal search-credit reservation is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE crewcast.search_credit_reservations
  DROP COLUMN error_message,
  DROP COLUMN uncertain_at,
  DROP COLUMN launch_attempted_at;
