-- The guarded runner executes this file in one transaction. Take the strongest
-- table lock before checking so an application insert cannot race the DROP.
LOCK TABLE crewcast.stripe_payment_method_update_operations
  IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.stripe_payment_method_update_operations) THEN
    RAISE EXCEPTION
      'Refusing rollback: Stripe payment-method update operation history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER stripe_payment_method_update_operations_lifecycle
  ON crewcast.stripe_payment_method_update_operations;
DROP FUNCTION crewcast.enforce_stripe_payment_method_update_operation_lifecycle();
DROP TABLE crewcast.stripe_payment_method_update_operations;
