DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.subscription_plan_changes LIMIT 1) THEN
    RAISE EXCEPTION 'Refusing 0018 rollback: subscription plan-change history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER subscription_plan_changes_lifecycle
  ON crewcast.subscription_plan_changes;
DROP FUNCTION crewcast.enforce_subscription_plan_change_lifecycle();
DROP TABLE crewcast.subscription_plan_changes;
