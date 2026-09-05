DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.stripe_downgrade_operations
    WHERE stripe_schedule_id IS NOT NULL
    GROUP BY stripe_schedule_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Refusing rollback: a Stripe schedule has more than one recorded revision.';
  END IF;
END;
$guard$;

DROP INDEX crewcast.stripe_downgrade_operations_schedule_idx;

CREATE UNIQUE INDEX stripe_downgrade_operations_schedule_key
  ON crewcast.stripe_downgrade_operations (stripe_schedule_id)
  WHERE stripe_schedule_id IS NOT NULL;
