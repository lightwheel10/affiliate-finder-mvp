DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.search_reconciliation_cases)
     OR EXISTS (SELECT 1 FROM crewcast.search_reconciliation_operators) THEN
    RAISE EXCEPTION
      'Refusing reconciliation rollback while operator or audit records exist.';
  END IF;
END;
$guard$;

DROP TRIGGER onboarding_search_entitlements_reconciliation_alert
  ON crewcast.onboarding_search_entitlements;
DROP TRIGGER search_jobs_reconciliation_alert ON crewcast.search_jobs;
DROP TRIGGER search_enrichment_dispatches_reconciliation_alert
  ON crewcast.search_enrichment_dispatches;
DROP FUNCTION crewcast.alert_uncertain_onboarding_search();
DROP FUNCTION crewcast.alert_blocked_enrichment_job();
DROP FUNCTION crewcast.alert_uncertain_enrichment_dispatch();

CREATE OR REPLACE FUNCTION crewcast.enforce_search_enrichment_dispatch_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.search_job_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.platform,
    NEW.input_urls,
    NEW.input_fingerprint,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.search_job_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.platform,
    OLD.input_urls,
    OLD.input_fingerprint,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Enrichment dispatch provenance is immutable.';
  END IF;

  IF OLD.provider_run_id IS NOT NULL
     AND NEW.provider_run_id IS DISTINCT FROM OLD.provider_run_id THEN
    RAISE EXCEPTION 'An enrichment dispatch cannot be reassigned to another provider run.';
  END IF;

  IF OLD.status = 'pending' AND NEW.status <> 'claimed' THEN
    RAISE EXCEPTION 'A pending enrichment dispatch must be claimed before launch.';
  ELSIF OLD.status = 'claimed' AND NEW.status NOT IN ('claimed', 'dispatching') THEN
    RAISE EXCEPTION 'A claimed enrichment dispatch must record launch intent before completion.';
  ELSIF OLD.status = 'dispatching'
        AND NEW.status NOT IN ('running', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'A launch-attempted enrichment dispatch cannot be retried automatically.';
  ELSIF OLD.status IN ('running', 'failed', 'uncertain')
        AND ROW(
          NEW.status,
          NEW.claim_token,
          NEW.claimed_at,
          NEW.launch_attempted_at,
          NEW.provider_run_id,
          NEW.dispatched_at,
          NEW.error_message
        ) IS DISTINCT FROM ROW(
          OLD.status,
          OLD.claim_token,
          OLD.claimed_at,
          OLD.launch_attempted_at,
          OLD.provider_run_id,
          OLD.dispatched_at,
          OLD.error_message
        ) THEN
    RAISE EXCEPTION 'A terminal enrichment dispatch is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION crewcast.enforce_onboarding_search_entitlement_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.created_at,
    NEW.legacy_imported_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.created_at,
    OLD.legacy_imported_at
  ) THEN
    RAISE EXCEPTION 'Onboarding-search entitlement provenance is immutable.';
  END IF;

  IF OLD.status = 'available' AND NEW.status <> 'reserved' THEN
    RAISE EXCEPTION 'An available onboarding-search entitlement must be reserved before launch.';
  ELSIF OLD.status = 'reserved' THEN
    IF NEW.status = 'reserved' AND OLD.claim_expires_at > statement_timestamp() THEN
      RAISE EXCEPTION 'A live onboarding-search reservation cannot be reassigned.';
    ELSIF NEW.status NOT IN ('available', 'reserved', 'dispatching') THEN
      RAISE EXCEPTION 'A reserved onboarding-search entitlement has an invalid transition.';
    END IF;
  ELSIF OLD.status = 'dispatching'
        AND NEW.status NOT IN ('available', 'consumed', 'uncertain') THEN
    RAISE EXCEPTION 'A launch-attempted onboarding search has an invalid transition.';
  ELSIF OLD.status IN ('consumed', 'uncertain')
        AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A terminal onboarding-search entitlement is immutable.';
  END IF;

  IF NEW.status <> 'available'
     AND OLD.status <> 'available'
     AND NEW.status <> 'reserved'
     AND ROW(
       NEW.request_id,
       NEW.settings_snapshot,
       NEW.claimed_at
     ) IS DISTINCT FROM ROW(
       OLD.request_id,
       OLD.settings_snapshot,
       OLD.claimed_at
     ) THEN
    RAISE EXCEPTION 'An onboarding-search claim cannot change after launch intent.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER search_reconciliation_cases_audit
  ON crewcast.search_reconciliation_cases;
DROP TRIGGER search_reconciliation_events_immutable
  ON crewcast.search_reconciliation_case_events;
DROP TRIGGER search_reconciliation_cases_lifecycle
  ON crewcast.search_reconciliation_cases;
DROP TRIGGER search_reconciliation_operators_lifecycle
  ON crewcast.search_reconciliation_operators;
DROP FUNCTION crewcast.audit_search_reconciliation_case();
DROP FUNCTION crewcast.reject_search_reconciliation_event_changes();
DROP FUNCTION crewcast.enforce_search_reconciliation_case_lifecycle();
DROP FUNCTION crewcast.enforce_search_reconciliation_operator_lifecycle();
DROP FUNCTION crewcast.require_active_search_reconciliation_operator();
DROP TABLE crewcast.search_reconciliation_case_events;
DROP TABLE crewcast.search_reconciliation_cases;
DROP TABLE crewcast.search_reconciliation_operators;
