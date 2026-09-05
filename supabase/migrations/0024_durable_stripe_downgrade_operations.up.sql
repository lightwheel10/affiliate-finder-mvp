CREATE TABLE crewcast.stripe_downgrade_operations (
  operation_id uuid PRIMARY KEY,
  user_id integer NOT NULL,
  request_fingerprint char(64) NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  from_plan varchar(50) NOT NULL,
  from_billing_interval varchar(20) NOT NULL,
  source_period_end_seconds bigint NOT NULL,
  to_plan varchar(50) NOT NULL,
  to_billing_interval varchar(20) NOT NULL,
  capacity_selection_version integer NOT NULL,
  retained_brand_ids bigint[] NOT NULL,
  retained_location_ids bigint[] NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'prepared',
  stripe_schedule_id text,
  effective_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_downgrade_operations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT stripe_downgrade_operations_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_downgrade_operations_customer_check
    CHECK (
      length(stripe_customer_id) BETWEEN 5 AND 255
      AND stripe_customer_id LIKE 'cus\_%' ESCAPE '\'
      AND stripe_customer_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_downgrade_operations_subscription_check
    CHECK (
      length(stripe_subscription_id) BETWEEN 5 AND 255
      AND stripe_subscription_id LIKE 'sub\_%' ESCAPE '\'
      AND stripe_subscription_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_downgrade_operations_schedule_check
    CHECK (
      stripe_schedule_id IS NULL
      OR (
        length(stripe_schedule_id) BETWEEN 5 AND 255
        AND stripe_schedule_id LIKE 'sub\_sched\_%' ESCAPE '\'
        AND stripe_schedule_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_downgrade_operations_plan_check
    CHECK (
      from_plan IN ('pro', 'business', 'enterprise')
      AND to_plan IN ('pro', 'business')
      AND from_plan IS DISTINCT FROM to_plan
    ),
  CONSTRAINT stripe_downgrade_operations_interval_check
    CHECK (
      from_billing_interval IN ('monthly', 'annual')
      AND to_billing_interval IN ('monthly', 'annual')
    ),
  CONSTRAINT stripe_downgrade_operations_period_check
    CHECK (source_period_end_seconds > 0),
  CONSTRAINT stripe_downgrade_operations_capacity_check
    CHECK (
      capacity_selection_version = 1
      AND cardinality(retained_brand_ids) > 0
      AND cardinality(retained_location_ids) > 0
    ),
  CONSTRAINT stripe_downgrade_operations_status_check
    CHECK (status IN ('prepared', 'completed', 'canceled')),
  CONSTRAINT stripe_downgrade_operations_lifecycle_check
    CHECK (
      (
        status = 'prepared'
        AND stripe_schedule_id IS NULL
        AND effective_at IS NULL
        AND completed_at IS NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'completed'
        AND stripe_schedule_id IS NOT NULL
        AND effective_at IS NOT NULL
        AND completed_at IS NOT NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'canceled'
        AND completed_at IS NULL
        AND canceled_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX stripe_downgrade_operations_one_prepared_per_user_key
  ON crewcast.stripe_downgrade_operations (user_id)
  WHERE status = 'prepared';

CREATE UNIQUE INDEX stripe_downgrade_operations_schedule_key
  ON crewcast.stripe_downgrade_operations (stripe_schedule_id)
  WHERE stripe_schedule_id IS NOT NULL;

CREATE INDEX stripe_downgrade_operations_user_created_idx
  ON crewcast.stripe_downgrade_operations (user_id, created_at DESC);

CREATE FUNCTION crewcast.enforce_stripe_downgrade_operation_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.operation_id,
    NEW.user_id,
    NEW.request_fingerprint,
    NEW.stripe_customer_id,
    NEW.stripe_subscription_id,
    NEW.from_plan,
    NEW.from_billing_interval,
    NEW.source_period_end_seconds,
    NEW.to_plan,
    NEW.to_billing_interval,
    NEW.capacity_selection_version,
    NEW.retained_brand_ids,
    NEW.retained_location_ids,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.operation_id,
    OLD.user_id,
    OLD.request_fingerprint,
    OLD.stripe_customer_id,
    OLD.stripe_subscription_id,
    OLD.from_plan,
    OLD.from_billing_interval,
    OLD.source_period_end_seconds,
    OLD.to_plan,
    OLD.to_billing_interval,
    OLD.capacity_selection_version,
    OLD.retained_brand_ids,
    OLD.retained_location_ids,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe downgrade operation identity is immutable.';
  END IF;

  IF OLD.status <> 'prepared' THEN
    RAISE EXCEPTION 'A terminal Stripe downgrade operation is immutable.';
  END IF;
  IF NEW.status NOT IN ('completed', 'canceled') THEN
    RAISE EXCEPTION 'A prepared Stripe downgrade operation may only complete or cancel.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stripe_downgrade_operations_lifecycle
BEFORE UPDATE ON crewcast.stripe_downgrade_operations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_stripe_downgrade_operation_lifecycle();

ALTER TABLE crewcast.stripe_downgrade_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_downgrade_operations
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.stripe_downgrade_operations IS
  'Private crash-recovery ledger written before a Stripe downgrade schedule is mutated.';
COMMENT ON COLUMN crewcast.stripe_downgrade_operations.request_fingerprint IS
  'SHA-256 of the normalized subscription, target plan and mandatory retained-capacity choice.';
