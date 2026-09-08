LOCK TABLE crewcast.stripe_capacity_subscriptions,
  crewcast.stripe_capacity_change_operations,
  crewcast.brands,
  crewcast.brand_locations
  IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.stripe_capacity_subscriptions) THEN
    RAISE EXCEPTION
      'Refusing rollback: Stripe paid-capacity subscription history exists.';
  END IF;
  IF EXISTS (SELECT 1 FROM crewcast.stripe_capacity_change_operations) THEN
    RAISE EXCEPTION
      'Refusing rollback: Stripe paid-capacity change history exists.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM crewcast.brands
    WHERE capacity_archived_by_addon_operation_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.brand_locations
    WHERE capacity_archived_by_addon_operation_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Refusing rollback: paid-capacity archive provenance is still referenced.';
  END IF;
END;
$guard$;

ALTER TABLE crewcast.brand_locations
  DROP CONSTRAINT brand_locations_addon_capacity_archive_operation_fkey,
  DROP CONSTRAINT brand_locations_addon_capacity_archive_state_check,
  DROP COLUMN capacity_archived_by_addon_operation_id;

ALTER TABLE crewcast.brands
  DROP CONSTRAINT brands_addon_capacity_archive_operation_fkey,
  DROP CONSTRAINT brands_addon_capacity_archive_state_check,
  DROP COLUMN capacity_archived_by_addon_operation_id;

DROP TRIGGER stripe_capacity_change_operations_lifecycle
  ON crewcast.stripe_capacity_change_operations;
DROP FUNCTION crewcast.enforce_stripe_capacity_change_operation_lifecycle();
DROP TABLE crewcast.stripe_capacity_change_operations;
DROP TABLE crewcast.stripe_capacity_subscriptions;
