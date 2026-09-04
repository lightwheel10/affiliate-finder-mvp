ALTER TABLE crewcast.subscription_plan_changes
  ADD COLUMN capacity_selection_version smallint,
  ADD COLUMN retained_brand_ids bigint[],
  ADD COLUMN retained_location_ids bigint[],
  ADD COLUMN capacity_reconciled_at timestamptz,
  ADD CONSTRAINT subscription_plan_changes_capacity_selection_check
    CHECK (
      (
        capacity_selection_version IS NULL
        AND retained_brand_ids IS NULL
        AND retained_location_ids IS NULL
        AND capacity_reconciled_at IS NULL
      )
      OR (
        capacity_selection_version = 1
        AND retained_brand_ids IS NOT NULL
        AND retained_location_ids IS NOT NULL
        AND cardinality(retained_brand_ids) BETWEEN 1 AND 100
        AND cardinality(retained_location_ids) BETWEEN 1 AND 500
        AND array_position(retained_brand_ids, NULL) IS NULL
        AND array_position(retained_location_ids, NULL) IS NULL
        AND array_ndims(retained_brand_ids) = 1
        AND array_ndims(retained_location_ids) = 1
        AND (
          (status = 'applied' AND capacity_reconciled_at IS NOT NULL)
          OR (status IN ('pending', 'canceled') AND capacity_reconciled_at IS NULL)
        )
      )
    );

ALTER TABLE crewcast.brands
  ADD COLUMN capacity_archived_by_plan_change_id bigint,
  ADD CONSTRAINT brands_capacity_archive_state_check
    CHECK (
      capacity_archived_by_plan_change_id IS NULL
      OR archived_at IS NOT NULL
    ),
  ADD CONSTRAINT brands_capacity_archive_change_fkey
    FOREIGN KEY (capacity_archived_by_plan_change_id)
    REFERENCES crewcast.subscription_plan_changes (id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL;

ALTER TABLE crewcast.brand_locations
  ADD COLUMN capacity_archived_by_plan_change_id bigint,
  ADD CONSTRAINT brand_locations_capacity_archive_state_check
    CHECK (
      capacity_archived_by_plan_change_id IS NULL
      OR archived_at IS NOT NULL
    ),
  ADD CONSTRAINT brand_locations_capacity_archive_change_fkey
    FOREIGN KEY (capacity_archived_by_plan_change_id)
    REFERENCES crewcast.subscription_plan_changes (id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL;

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
    NEW.created_at,
    NEW.capacity_selection_version,
    NEW.retained_brand_ids,
    NEW.retained_location_ids
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
    OLD.created_at,
    OLD.capacity_selection_version,
    OLD.retained_brand_ids,
    OLD.retained_location_ids
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

COMMENT ON COLUMN crewcast.subscription_plan_changes.retained_brand_ids IS
  'Immutable active-brand keep-list explicitly approved by the customer before a capacity-reducing plan change.';
COMMENT ON COLUMN crewcast.subscription_plan_changes.retained_location_ids IS
  'Immutable active-location keep-list explicitly approved by the customer before a capacity-reducing plan change.';
COMMENT ON COLUMN crewcast.subscription_plan_changes.capacity_reconciled_at IS
  'When the target Stripe plan became authoritative and excess capacity was recoverably archived in the same transaction.';
COMMENT ON COLUMN crewcast.brands.capacity_archived_by_plan_change_id IS
  'Set only when a plan-boundary reconciliation archived this brand; retained for deterministic future restoration.';
COMMENT ON COLUMN crewcast.brand_locations.capacity_archived_by_plan_change_id IS
  'Set only when a plan-boundary reconciliation archived this location; retained for deterministic future restoration.';
