CREATE TABLE crewcast.stripe_credit_checkout_operations (
  operation_id uuid PRIMARY KEY,
  user_id integer NOT NULL,
  request_fingerprint char(64) NOT NULL,
  stripe_customer_id text NOT NULL,
  pack_id varchar(80) NOT NULL,
  stripe_price_id text NOT NULL,
  credit_type varchar(20) NOT NULL,
  credits_amount integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'prepared',
  stripe_checkout_session_id text,
  completed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_credit_checkout_operations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT stripe_credit_checkout_operations_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_credit_checkout_operations_customer_check
    CHECK (
      length(stripe_customer_id) BETWEEN 5 AND 255
      AND stripe_customer_id LIKE 'cus\_%' ESCAPE '\'
      AND stripe_customer_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_credit_checkout_operations_pack_check
    CHECK (pack_id ~ '^[a-z0-9_]{1,80}$'),
  CONSTRAINT stripe_credit_checkout_operations_price_check
    CHECK (
      length(stripe_price_id) BETWEEN 7 AND 255
      AND stripe_price_id LIKE 'price\_%' ESCAPE '\'
      AND stripe_price_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT stripe_credit_checkout_operations_credit_check
    CHECK (
      credit_type IN ('email', 'ai', 'topic_search')
      AND credits_amount > 0
    ),
  CONSTRAINT stripe_credit_checkout_operations_status_check
    CHECK (status IN ('prepared', 'session_created', 'completed', 'expired')),
  CONSTRAINT stripe_credit_checkout_operations_session_check
    CHECK (
      stripe_checkout_session_id IS NULL
      OR (
        length(stripe_checkout_session_id) BETWEEN 6 AND 255
        AND stripe_checkout_session_id LIKE 'cs\_%' ESCAPE '\'
        AND stripe_checkout_session_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT stripe_credit_checkout_operations_lifecycle_check
    CHECK (
      (
        status = 'prepared'
        AND stripe_checkout_session_id IS NULL
        AND completed_at IS NULL
        AND expired_at IS NULL
      )
      OR (
        status = 'session_created'
        AND stripe_checkout_session_id IS NOT NULL
        AND completed_at IS NULL
        AND expired_at IS NULL
      )
      OR (
        status = 'completed'
        AND stripe_checkout_session_id IS NOT NULL
        AND completed_at IS NOT NULL
        AND expired_at IS NULL
      )
      OR (
        status = 'expired'
        AND stripe_checkout_session_id IS NOT NULL
        AND completed_at IS NULL
        AND expired_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX stripe_credit_checkout_operations_session_key
  ON crewcast.stripe_credit_checkout_operations (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX stripe_credit_checkout_operations_user_created_idx
  ON crewcast.stripe_credit_checkout_operations (user_id, created_at DESC);

CREATE FUNCTION crewcast.enforce_stripe_credit_checkout_operation_lifecycle()
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
    NEW.pack_id,
    NEW.stripe_price_id,
    NEW.credit_type,
    NEW.credits_amount,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.operation_id,
    OLD.user_id,
    OLD.request_fingerprint,
    OLD.stripe_customer_id,
    OLD.pack_id,
    OLD.stripe_price_id,
    OLD.credit_type,
    OLD.credits_amount,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe credit checkout operation identity is immutable.';
  END IF;

  IF OLD.status = 'prepared' THEN
    IF NEW.status <> 'session_created' THEN
      RAISE EXCEPTION 'A prepared Stripe credit checkout may only attach its session.';
    END IF;
  ELSIF OLD.status = 'session_created' THEN
    IF NEW.status NOT IN ('completed', 'expired') THEN
      RAISE EXCEPTION 'A Stripe credit checkout session may only complete or expire.';
    END IF;
    IF NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id THEN
      RAISE EXCEPTION 'Stripe credit checkout session identity is immutable.';
    END IF;
  ELSE
    RAISE EXCEPTION 'A terminal Stripe credit checkout operation is immutable.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stripe_credit_checkout_operations_lifecycle
BEFORE UPDATE ON crewcast.stripe_credit_checkout_operations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_stripe_credit_checkout_operation_lifecycle();

ALTER TABLE crewcast.stripe_credit_checkout_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_credit_checkout_operations
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.stripe_credit_checkout_operations IS
  'Private crash-recovery ledger written before creating a one-time Stripe credit checkout.';
COMMENT ON COLUMN crewcast.stripe_credit_checkout_operations.request_fingerprint IS
  'SHA-256 of the authenticated account, Stripe customer and immutable selected credit pack.';
