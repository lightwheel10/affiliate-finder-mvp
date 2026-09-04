CREATE TABLE crewcast.search_credit_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  request_id uuid NOT NULL,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  search_job_id integer,
  settings_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  credit_period_start timestamptz NOT NULL,
  subscription_credits_consumed integer NOT NULL,
  topup_credits_consumed integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,

  CONSTRAINT search_credit_reservations_user_request_key
    UNIQUE (user_id, request_id),
  CONSTRAINT search_credit_reservations_search_job_key
    UNIQUE (search_job_id),
  CONSTRAINT search_credit_reservations_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT search_credit_reservations_job_owner_fkey
    FOREIGN KEY (search_job_id, user_id)
    REFERENCES crewcast.search_jobs (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT search_credit_reservations_snapshot_object_check
    CHECK (jsonb_typeof(settings_snapshot) = 'object'),
  CONSTRAINT search_credit_reservations_credit_split_check
    CHECK (
      subscription_credits_consumed IN (0, 1)
      AND topup_credits_consumed IN (0, 1)
      AND subscription_credits_consumed + topup_credits_consumed = 1
    ),
  CONSTRAINT search_credit_reservations_status_check
    CHECK (status IN ('reserved', 'consumed', 'released')),
  CONSTRAINT search_credit_reservations_lifecycle_check
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
    )
);

CREATE INDEX search_credit_reservations_user_status_created_at_idx
  ON crewcast.search_credit_reservations (user_id, status, created_at DESC, id DESC);

CREATE FUNCTION crewcast.enforce_search_credit_reservation_immutable()
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

CREATE TRIGGER search_credit_reservations_immutable
BEFORE UPDATE ON crewcast.search_credit_reservations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_credit_reservation_immutable();

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

  IF OLD.request_id IS NOT NULL
     AND NEW.request_id IS DISTINCT FROM OLD.request_id THEN
    RAISE EXCEPTION 'search_jobs.request_id cannot be changed after assignment';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER search_jobs_provenance_immutable
  ON crewcast.search_jobs;
CREATE TRIGGER search_jobs_provenance_immutable
BEFORE UPDATE OF brand_id, brand_location_id, settings_snapshot, request_id
ON crewcast.search_jobs
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_job_provenance_immutable();

ALTER TABLE crewcast.search_credit_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.search_credit_reservations
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.search_credit_reservations_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.search_credit_reservations IS
  'Durable, account-owned topic-search credit claims created before paid provider launch and finalized with the linked search job.';
COMMENT ON COLUMN crewcast.search_credit_reservations.request_id IS
  'Client-generated UUID that serializes retries for one logical runtime search.';
COMMENT ON COLUMN crewcast.search_credit_reservations.credit_period_start IS
  'Credit period debited at reservation time; prevents an old-period release from decrementing usage in a newer period.';
