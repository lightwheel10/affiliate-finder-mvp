LOCK TABLE crewcast.stripe_payment_method_update_operations
  IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.stripe_payment_method_update_operations
    WHERE status = 'abandoned'
  ) THEN
    RAISE EXCEPTION
      'Refusing rollback: abandoned Stripe payment-method update history exists.';
  END IF;
END;
$guard$;

ALTER TABLE crewcast.stripe_payment_method_update_operations
  DROP CONSTRAINT stripe_payment_method_update_operations_lifecycle_check,
  DROP CONSTRAINT stripe_payment_method_update_operations_failure_code_check,
  DROP CONSTRAINT stripe_payment_method_update_operations_status_check,
  DROP COLUMN failure_code,
  DROP COLUMN abandoned_at;

ALTER TABLE crewcast.stripe_payment_method_update_operations
  ADD CONSTRAINT stripe_payment_method_update_operations_status_check
    CHECK (status IN ('prepared', 'completed')),
  ADD CONSTRAINT stripe_payment_method_update_operations_lifecycle_check
    CHECK (
      (status = 'prepared' AND completed_at IS NULL)
      OR (status = 'completed' AND completed_at IS NOT NULL)
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

  IF OLD.status = 'prepared' THEN
    IF NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'A prepared Stripe payment-method update may only complete.';
    END IF;
  ELSE
    RAISE EXCEPTION 'A completed Stripe payment-method update is immutable.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;
