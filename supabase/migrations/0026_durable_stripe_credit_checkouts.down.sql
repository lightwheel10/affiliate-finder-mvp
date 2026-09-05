DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.stripe_credit_checkout_operations) THEN
    RAISE EXCEPTION
      'Refusing rollback: Stripe credit checkout operation history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER stripe_credit_checkout_operations_lifecycle
  ON crewcast.stripe_credit_checkout_operations;
DROP FUNCTION crewcast.enforce_stripe_credit_checkout_operation_lifecycle();
DROP TABLE crewcast.stripe_credit_checkout_operations;
