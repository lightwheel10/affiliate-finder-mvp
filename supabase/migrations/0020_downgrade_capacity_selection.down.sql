DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.subscription_plan_changes
    WHERE capacity_selection_version IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.brands
    WHERE capacity_archived_by_plan_change_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.brand_locations
    WHERE capacity_archived_by_plan_change_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Refusing 0020 rollback: downgrade capacity selections or archive provenance exist.';
  END IF;
END;
$guard$;

ALTER TABLE crewcast.brand_locations
  DROP CONSTRAINT brand_locations_capacity_archive_change_fkey,
  DROP CONSTRAINT brand_locations_capacity_archive_state_check,
  DROP COLUMN capacity_archived_by_plan_change_id;

ALTER TABLE crewcast.brands
  DROP CONSTRAINT brands_capacity_archive_change_fkey,
  DROP CONSTRAINT brands_capacity_archive_state_check,
  DROP COLUMN capacity_archived_by_plan_change_id;

ALTER TABLE crewcast.subscription_plan_changes
  DROP CONSTRAINT subscription_plan_changes_capacity_selection_check,
  DROP COLUMN capacity_reconciled_at,
  DROP COLUMN retained_location_ids,
  DROP COLUMN retained_brand_ids,
  DROP COLUMN capacity_selection_version;

CREATE OR REPLACE FUNCTION crewcast.enforce_subscription_plan_change_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.id,
    NEW.user_id,
    NEW.stripe_subscription_id,
    NEW.stripe_schedule_id,
    NEW.from_plan,
    NEW.from_billing_interval,
    NEW.to_plan,
    NEW.to_billing_interval,
    NEW.effective_at,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.user_id,
    OLD.stripe_subscription_id,
    OLD.stripe_schedule_id,
    OLD.from_plan,
    OLD.from_billing_interval,
    OLD.to_plan,
    OLD.to_billing_interval,
    OLD.effective_at,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Subscription plan-change identity is immutable.';
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'A terminal subscription plan change is immutable.';
  END IF;
  IF NEW.status NOT IN ('applied', 'canceled') THEN
    RAISE EXCEPTION 'A pending subscription plan change may only be applied or canceled.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;
