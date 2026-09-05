ALTER TABLE crewcast.stripe_downgrade_operations
  DROP CONSTRAINT stripe_downgrade_operations_lifecycle_check;

ALTER TABLE crewcast.stripe_downgrade_operations
  ADD CONSTRAINT stripe_downgrade_operations_lifecycle_check
  CHECK (
    (
      status = 'prepared'
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
  );

CREATE OR REPLACE FUNCTION crewcast.enforce_stripe_downgrade_operation_lifecycle()
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

  IF NEW.status = 'prepared' THEN
    IF OLD.stripe_schedule_id IS NOT NULL
      OR NEW.stripe_schedule_id IS NULL
      OR NEW.effective_at IS NOT NULL
      OR NEW.completed_at IS NOT NULL
      OR NEW.canceled_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'A prepared Stripe downgrade may bind its schedule exactly once.';
    END IF;
  ELSIF NEW.status NOT IN ('completed', 'canceled') THEN
    RAISE EXCEPTION 'A prepared Stripe downgrade may only bind, complete or cancel.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

COMMENT ON COLUMN crewcast.stripe_downgrade_operations.stripe_schedule_id IS
  'Exact Stripe schedule bound after from_subscription creation and before phase configuration; immutable once set.';
