CREATE TABLE crewcast.stripe_payment_method_update_operations (
  operation_id uuid PRIMARY KEY,
  user_id integer NOT NULL,
  request_fingerprint char(64) NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  stripe_payment_method_id text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'prepared',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_payment_method_update_operations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT stripe_payment_method_update_operations_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_payment_method_update_operations_customer_check
    CHECK (
      length(stripe_customer_id) BETWEEN 5 AND 255
      AND stripe_customer_id LIKE 'cus\_%' ESCAPE '\'
      AND stripe_customer_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_payment_method_update_operations_subscription_check
    CHECK (
      stripe_subscription_id IS NULL
      OR (
        length(stripe_subscription_id) BETWEEN 5 AND 255
        AND stripe_subscription_id LIKE 'sub\_%' ESCAPE '\'
        AND stripe_subscription_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_payment_method_update_operations_method_check
    CHECK (
      length(stripe_payment_method_id) BETWEEN 4 AND 255
      AND stripe_payment_method_id LIKE 'pm\_%' ESCAPE '\'
      AND stripe_payment_method_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_payment_method_update_operations_status_check
    CHECK (status IN ('prepared', 'completed')),
  CONSTRAINT stripe_payment_method_update_operations_lifecycle_check
    CHECK (
      (status = 'prepared' AND completed_at IS NULL)
      OR (status = 'completed' AND completed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX stripe_pm_update_one_prepared_user_key
  ON crewcast.stripe_payment_method_update_operations (user_id)
  WHERE status = 'prepared';

CREATE INDEX stripe_payment_method_update_operations_customer_created_idx
  ON crewcast.stripe_payment_method_update_operations (
    stripe_customer_id,
    created_at DESC
  );

CREATE INDEX stripe_payment_method_update_operations_user_created_idx
  ON crewcast.stripe_payment_method_update_operations (user_id, created_at DESC);

CREATE FUNCTION crewcast.enforce_stripe_payment_method_update_operation_lifecycle()
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
    NEW.stripe_subscription_id,
    NEW.stripe_payment_method_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.operation_id,
    OLD.user_id,
    OLD.request_fingerprint,
    OLD.stripe_customer_id,
    OLD.stripe_subscription_id,
    OLD.stripe_payment_method_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe payment-method update operation identity is immutable.';
  END IF;

  IF OLD.status = 'prepared' THEN
    IF NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'A prepared Stripe payment-method update may only complete.';
    END IF;
  ELSE
    RAISE EXCEPTION 'A completed Stripe payment-method update is immutable.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stripe_payment_method_update_operations_lifecycle
BEFORE UPDATE ON crewcast.stripe_payment_method_update_operations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_stripe_payment_method_update_operation_lifecycle();

ALTER TABLE crewcast.stripe_payment_method_update_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_payment_method_update_operations
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.stripe_payment_method_update_operations IS
  'Private crash-recovery ledger written before changing a Stripe customer or subscription default payment method.';
COMMENT ON COLUMN crewcast.stripe_payment_method_update_operations.request_fingerprint IS
  'SHA-256 of the authenticated account and immutable Stripe customer, subscription and payment-method target.';
