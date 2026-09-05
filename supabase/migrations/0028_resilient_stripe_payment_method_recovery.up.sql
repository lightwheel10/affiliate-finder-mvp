ALTER TABLE crewcast.stripe_payment_method_update_operations
  ADD COLUMN abandoned_at timestamptz,
  ADD COLUMN failure_code varchar(64);

ALTER TABLE crewcast.stripe_payment_method_update_operations
  DROP CONSTRAINT stripe_payment_method_update_operations_status_check,
  DROP CONSTRAINT stripe_payment_method_update_operations_lifecycle_check;

ALTER TABLE crewcast.stripe_payment_method_update_operations
  ADD CONSTRAINT stripe_payment_method_update_operations_status_check
    CHECK (status IN ('prepared', 'completed', 'abandoned')),
  ADD CONSTRAINT stripe_payment_method_update_operations_failure_code_check
    CHECK (
      failure_code IS NULL
      OR failure_code ~ '^[a-z0-9_]{1,64}$'
    ),
  ADD CONSTRAINT stripe_payment_method_update_operations_lifecycle_check
    CHECK (
      (
        status = 'prepared'
        AND completed_at IS NULL
        AND abandoned_at IS NULL
        AND failure_code IS NULL
      )
      OR (
        status = 'completed'
        AND completed_at IS NOT NULL
        AND abandoned_at IS NULL
        AND failure_code IS NULL
      )
      OR (
        status = 'abandoned'
        AND completed_at IS NULL
        AND abandoned_at IS NOT NULL
        AND failure_code IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION crewcast.enforce_stripe_payment_method_update_operation_lifecycle()
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
    NEW.stripe_payment_method_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.operation_id,
    OLD.user_id,
    OLD.request_fingerprint,
    OLD.stripe_customer_id,
    OLD.stripe_subscription_id,
    OLD.stripe_payment_method_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe payment-method update operation identity is immutable.';
  END IF;

  IF OLD.status <> 'prepared' THEN
    RAISE EXCEPTION 'A terminal Stripe payment-method update is immutable.';
  END IF;
  IF NEW.status NOT IN ('completed', 'abandoned') THEN
    RAISE EXCEPTION
      'A prepared Stripe payment-method update may only complete or be abandoned.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

COMMENT ON COLUMN crewcast.stripe_payment_method_update_operations.abandoned_at IS
  'Time a permanently invalid or explicitly replaced operation stopped blocking later card updates.';
COMMENT ON COLUMN crewcast.stripe_payment_method_update_operations.failure_code IS
  'Bounded non-secret reason code for abandoning an operation; provider messages are never stored.';
