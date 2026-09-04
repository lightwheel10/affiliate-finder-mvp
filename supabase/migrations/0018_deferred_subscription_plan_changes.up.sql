CREATE TABLE crewcast.subscription_plan_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_schedule_id text NOT NULL,
  from_plan varchar(50) NOT NULL,
  from_billing_interval varchar(20) NOT NULL,
  to_plan varchar(50) NOT NULL,
  to_billing_interval varchar(20) NOT NULL,
  effective_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_plan_changes_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT subscription_plan_changes_stripe_subscription_id_check
    CHECK (
      length(stripe_subscription_id) BETWEEN 5 AND 255
      AND stripe_subscription_id LIKE 'sub\_%' ESCAPE '\'
      AND stripe_subscription_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT subscription_plan_changes_stripe_schedule_id_check
    CHECK (
      length(stripe_schedule_id) BETWEEN 5 AND 255
      AND stripe_schedule_id LIKE 'sub\_sched\_%' ESCAPE '\'
      AND stripe_schedule_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT subscription_plan_changes_plan_check
    CHECK (
      from_plan IN ('pro', 'business', 'enterprise')
      AND to_plan IN ('pro', 'business')
      AND from_plan IS DISTINCT FROM to_plan
    ),
  CONSTRAINT subscription_plan_changes_interval_check
    CHECK (
      from_billing_interval IN ('monthly', 'annual')
      AND to_billing_interval IN ('monthly', 'annual')
    ),
  CONSTRAINT subscription_plan_changes_status_check
    CHECK (status IN ('pending', 'applied', 'canceled')),
  CONSTRAINT subscription_plan_changes_timing_check
    CHECK (effective_at >= created_at),
  CONSTRAINT subscription_plan_changes_lifecycle_check
    CHECK (
      (
        status = 'pending'
        AND applied_at IS NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'applied'
        AND applied_at IS NOT NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'canceled'
        AND applied_at IS NULL
        AND canceled_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX subscription_plan_changes_one_pending_per_user_key
  ON crewcast.subscription_plan_changes (user_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX subscription_plan_changes_one_pending_per_schedule_key
  ON crewcast.subscription_plan_changes (stripe_schedule_id)
  WHERE status = 'pending';

CREATE INDEX subscription_plan_changes_user_created_idx
  ON crewcast.subscription_plan_changes (user_id, created_at DESC, id DESC);

CREATE FUNCTION crewcast.enforce_subscription_plan_change_lifecycle()
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

CREATE TRIGGER subscription_plan_changes_lifecycle
BEFORE UPDATE ON crewcast.subscription_plan_changes
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_subscription_plan_change_lifecycle();

ALTER TABLE crewcast.subscription_plan_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.subscription_plan_changes
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.subscription_plan_changes_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.subscription_plan_changes IS
  'Private durable audit of deferred Stripe plan downgrades. One pending change per account is allowed; terminal rows are immutable.';
COMMENT ON COLUMN crewcast.subscription_plan_changes.effective_at IS
  'The end of the currently paid Stripe phase, when the future price is scheduled to become active.';
