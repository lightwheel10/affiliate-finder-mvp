DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.stripe_downgrade_operations) THEN
    RAISE EXCEPTION
      'Refusing rollback: Stripe downgrade operation history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER stripe_downgrade_operations_lifecycle
  ON crewcast.stripe_downgrade_operations;
DROP FUNCTION crewcast.enforce_stripe_downgrade_operation_lifecycle();
DROP TABLE crewcast.stripe_downgrade_operations;
