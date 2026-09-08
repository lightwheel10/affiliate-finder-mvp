CREATE TABLE crewcast.stripe_capacity_subscriptions (
  user_id integer PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_brand_item_id text UNIQUE,
  stripe_location_item_id text UNIQUE,
  status varchar(32) NOT NULL,
  extra_brand_quantity smallint NOT NULL DEFAULT 0,
  extra_location_quantity smallint NOT NULL DEFAULT 0,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_capacity_subscriptions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT stripe_capacity_subscriptions_customer_check
    CHECK (
      length(stripe_customer_id) BETWEEN 5 AND 255
      AND stripe_customer_id LIKE 'cus\_%' ESCAPE '\'
      AND stripe_customer_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_capacity_subscriptions_subscription_check
    CHECK (
      length(stripe_subscription_id) BETWEEN 5 AND 255
      AND stripe_subscription_id LIKE 'sub\_%' ESCAPE '\'
      AND stripe_subscription_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_capacity_subscriptions_brand_item_check
    CHECK (
      stripe_brand_item_id IS NULL
      OR (
        length(stripe_brand_item_id) BETWEEN 4 AND 255
        AND stripe_brand_item_id LIKE 'si\_%' ESCAPE '\'
        AND stripe_brand_item_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_capacity_subscriptions_location_item_check
    CHECK (
      stripe_location_item_id IS NULL
      OR (
        length(stripe_location_item_id) BETWEEN 4 AND 255
        AND stripe_location_item_id LIKE 'si\_%' ESCAPE '\'
        AND stripe_location_item_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_capacity_subscriptions_status_check
    CHECK (
      status IN (
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused'
      )
    ),
  CONSTRAINT stripe_capacity_subscriptions_quantity_check
    CHECK (
      extra_brand_quantity BETWEEN 0 AND 10
      AND extra_location_quantity BETWEEN 0 AND 25
      AND (extra_brand_quantity = 0) = (stripe_brand_item_id IS NULL)
      AND (extra_location_quantity = 0) = (stripe_location_item_id IS NULL)
    ),
  CONSTRAINT stripe_capacity_subscriptions_live_quantity_check
    CHECK (
      status IN ('incomplete_expired', 'canceled', 'unpaid')
      OR extra_brand_quantity + extra_location_quantity > 0
    )
);

CREATE INDEX stripe_capacity_subscriptions_status_idx
  ON crewcast.stripe_capacity_subscriptions (status, updated_at);

CREATE TABLE crewcast.stripe_capacity_change_operations (
  operation_id uuid PRIMARY KEY,
  user_id integer NOT NULL,
  request_fingerprint char(64) NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_base_subscription_id text NOT NULL,
  base_plan varchar(24) NOT NULL,
  stripe_subscription_id text,
  stripe_invoice_id text,
  from_extra_brand_quantity smallint NOT NULL,
  from_extra_location_quantity smallint NOT NULL,
  to_extra_brand_quantity smallint NOT NULL,
  to_extra_location_quantity smallint NOT NULL,
  proration_date_seconds bigint NOT NULL,
  capacity_selection_version smallint,
  retained_brand_ids bigint[],
  retained_location_ids bigint[],
  reason varchar(24) NOT NULL DEFAULT 'customer_change',
  status varchar(24) NOT NULL DEFAULT 'prepared',
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_capacity_change_operations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT stripe_capacity_change_operations_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_capacity_change_operations_customer_check
    CHECK (
      length(stripe_customer_id) BETWEEN 5 AND 255
      AND stripe_customer_id LIKE 'cus\_%' ESCAPE '\'
      AND stripe_customer_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_capacity_change_operations_subscription_check
    CHECK (
      stripe_subscription_id IS NULL
      OR (
        length(stripe_subscription_id) BETWEEN 5 AND 255
        AND stripe_subscription_id LIKE 'sub\_%' ESCAPE '\'
        AND stripe_subscription_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_capacity_change_operations_base_subscription_check
    CHECK (
      length(stripe_base_subscription_id) BETWEEN 5 AND 255
      AND stripe_base_subscription_id LIKE 'sub\_%' ESCAPE '\'
      AND stripe_base_subscription_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_capacity_change_operations_base_plan_check
    CHECK (base_plan IN ('pro', 'business')),
  CONSTRAINT stripe_capacity_change_operations_invoice_check
    CHECK (
      stripe_invoice_id IS NULL
      OR (
        length(stripe_invoice_id) BETWEEN 4 AND 255
        AND stripe_invoice_id LIKE 'in\_%' ESCAPE '\'
        AND stripe_invoice_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_capacity_change_operations_quantity_check
    CHECK (
      from_extra_brand_quantity BETWEEN 0 AND 10
      AND to_extra_brand_quantity BETWEEN 0 AND 10
      AND from_extra_location_quantity BETWEEN 0 AND 25
      AND to_extra_location_quantity BETWEEN 0 AND 25
      AND ROW(from_extra_brand_quantity, from_extra_location_quantity)
        IS DISTINCT FROM ROW(to_extra_brand_quantity, to_extra_location_quantity)
    ),
  CONSTRAINT stripe_capacity_change_operations_proration_check
    CHECK (proration_date_seconds > 0),
  CONSTRAINT stripe_capacity_change_operations_selection_check
    CHECK (
      (
        capacity_selection_version IS NULL
        AND retained_brand_ids IS NULL
        AND retained_location_ids IS NULL
      )
      OR (
        capacity_selection_version = 1
        AND retained_brand_ids IS NOT NULL
        AND retained_location_ids IS NOT NULL
        AND cardinality(retained_brand_ids) BETWEEN 1 AND 15
        AND cardinality(retained_location_ids) BETWEEN 1 AND 30
        AND array_position(retained_brand_ids, NULL) IS NULL
        AND array_position(retained_location_ids, NULL) IS NULL
        AND array_ndims(retained_brand_ids) = 1
        AND array_ndims(retained_location_ids) = 1
      )
    ),
  CONSTRAINT stripe_capacity_change_operations_reason_check
    CHECK (reason IN ('customer_change', 'payment_failure', 'base_ended')),
  CONSTRAINT stripe_capacity_change_operations_status_check
    CHECK (status IN ('prepared', 'pending_payment', 'completed', 'canceled')),
  CONSTRAINT stripe_capacity_change_operations_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT stripe_capacity_change_operations_lifecycle_check
    CHECK (
      (
        status = 'prepared'
        AND stripe_invoice_id IS NULL
        AND completed_at IS NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'pending_payment'
        AND stripe_subscription_id IS NOT NULL
        AND stripe_invoice_id IS NOT NULL
        AND completed_at IS NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'completed'
        AND stripe_subscription_id IS NOT NULL
        AND completed_at IS NOT NULL
        AND canceled_at IS NULL
      )
      OR (
        status = 'canceled'
        AND completed_at IS NULL
        AND canceled_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX stripe_capacity_change_one_open_user_key
  ON crewcast.stripe_capacity_change_operations (user_id)
  WHERE status IN ('prepared', 'pending_payment');

CREATE INDEX stripe_capacity_change_operations_subscription_created_idx
  ON crewcast.stripe_capacity_change_operations (
    stripe_subscription_id,
    created_at DESC
  )
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX stripe_capacity_change_operations_user_created_idx
  ON crewcast.stripe_capacity_change_operations (user_id, created_at DESC);

ALTER TABLE crewcast.brands
  ADD COLUMN capacity_archived_by_addon_operation_id uuid,
  ADD CONSTRAINT brands_addon_capacity_archive_state_check
    CHECK (
      capacity_archived_by_addon_operation_id IS NULL
      OR archived_at IS NOT NULL
    ),
  ADD CONSTRAINT brands_addon_capacity_archive_operation_fkey
    FOREIGN KEY (capacity_archived_by_addon_operation_id)
    REFERENCES crewcast.stripe_capacity_change_operations (operation_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL;

ALTER TABLE crewcast.brand_locations
  ADD COLUMN capacity_archived_by_addon_operation_id uuid,
  ADD CONSTRAINT brand_locations_addon_capacity_archive_state_check
    CHECK (
      capacity_archived_by_addon_operation_id IS NULL
      OR archived_at IS NOT NULL
    ),
  ADD CONSTRAINT brand_locations_addon_capacity_archive_operation_fkey
    FOREIGN KEY (capacity_archived_by_addon_operation_id)
    REFERENCES crewcast.stripe_capacity_change_operations (operation_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL;

CREATE FUNCTION crewcast.enforce_stripe_capacity_change_operation_lifecycle()
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
    NEW.stripe_base_subscription_id,
    NEW.base_plan,
    NEW.from_extra_brand_quantity,
    NEW.from_extra_location_quantity,
    NEW.to_extra_brand_quantity,
    NEW.to_extra_location_quantity,
    NEW.proration_date_seconds,
    NEW.capacity_selection_version,
    NEW.retained_brand_ids,
    NEW.retained_location_ids,
    NEW.reason,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.operation_id,
    OLD.user_id,
    OLD.request_fingerprint,
    OLD.stripe_customer_id,
    OLD.stripe_base_subscription_id,
    OLD.base_plan,
    OLD.from_extra_brand_quantity,
    OLD.from_extra_location_quantity,
    OLD.to_extra_brand_quantity,
    OLD.to_extra_location_quantity,
    OLD.proration_date_seconds,
    OLD.capacity_selection_version,
    OLD.retained_brand_ids,
    OLD.retained_location_ids,
    OLD.reason,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe capacity-change operation identity is immutable.';
  END IF;

  IF OLD.stripe_subscription_id IS NOT NULL
     AND NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Stripe capacity-change subscription identity is immutable once attached.';
  END IF;
  IF OLD.stripe_invoice_id IS NOT NULL
     AND NEW.stripe_invoice_id IS DISTINCT FROM OLD.stripe_invoice_id THEN
    RAISE EXCEPTION 'Stripe capacity-change invoice identity is immutable once attached.';
  END IF;

  IF OLD.status = 'prepared' THEN
    IF NEW.status NOT IN ('pending_payment', 'completed', 'canceled') THEN
      RAISE EXCEPTION 'A prepared Stripe capacity change has an invalid transition.';
    END IF;
  ELSIF OLD.status = 'pending_payment' THEN
    IF NEW.status NOT IN ('completed', 'canceled') THEN
      RAISE EXCEPTION 'A pending Stripe capacity change may only complete or cancel.';
    END IF;
  ELSE
    RAISE EXCEPTION 'A terminal Stripe capacity-change operation is immutable.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stripe_capacity_change_operations_lifecycle
BEFORE UPDATE ON crewcast.stripe_capacity_change_operations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_stripe_capacity_change_operation_lifecycle();

ALTER TABLE crewcast.stripe_capacity_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crewcast.stripe_capacity_change_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_capacity_subscriptions
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_capacity_change_operations
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.stripe_capacity_subscriptions IS
  'Private application mirror of one isolated monthly Stripe brand/location capacity subscription per account.';
COMMENT ON COLUMN crewcast.stripe_capacity_subscriptions.extra_brand_quantity IS
  'Stripe-confirmed paid extra-brand quantity; effective entitlement also depends on the mirrored subscription status.';
COMMENT ON COLUMN crewcast.stripe_capacity_subscriptions.extra_location_quantity IS
  'Stripe-confirmed paid account-wide extra-location quantity; effective entitlement also depends on the mirrored subscription status.';
COMMENT ON TABLE crewcast.stripe_capacity_change_operations IS
  'Private idempotency and recovery ledger for authenticated Stripe capacity quantity changes.';
COMMENT ON COLUMN crewcast.stripe_capacity_change_operations.request_fingerprint IS
  'SHA-256 of the immutable account, base subscription/plan, Stripe customer, source/target quantities, proration instant and optional required keep-list.';
COMMENT ON COLUMN crewcast.stripe_capacity_change_operations.expires_at IS
  'Prepared-request or Stripe pending-payment expiry; expired open rows are canceled before a replacement operation is prepared.';
COMMENT ON COLUMN crewcast.brands.capacity_archived_by_addon_operation_id IS
  'Set only when a paid-capacity reduction recoverably archives this brand; ordinary manual archives clear it.';
COMMENT ON COLUMN crewcast.brand_locations.capacity_archived_by_addon_operation_id IS
  'Set only when a paid-capacity reduction recoverably archives this location; ordinary manual archives clear it.';
