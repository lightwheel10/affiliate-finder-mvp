CREATE TABLE crewcast.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  object_id text,
  event_created_at timestamptz NOT NULL,
  livemode boolean NOT NULL,
  payload_sha256 text NOT NULL,
  status text NOT NULL,
  attempt_count integer NOT NULL,
  claim_token uuid,
  claimed_at timestamptz NOT NULL,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_failed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT stripe_webhook_events_event_id_check
    CHECK (length(event_id) BETWEEN 1 AND 255 AND event_id !~ '[[:cntrl:]]'),
  CONSTRAINT stripe_webhook_events_event_type_check
    CHECK (length(event_type) BETWEEN 1 AND 255 AND event_type !~ '[[:cntrl:]]'),
  CONSTRAINT stripe_webhook_events_object_id_check
    CHECK (
      object_id IS NULL
      OR (length(object_id) BETWEEN 1 AND 255 AND object_id !~ '[[:cntrl:]]')
    ),
  CONSTRAINT stripe_webhook_events_payload_sha256_check
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT stripe_webhook_events_status_check
    CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT stripe_webhook_events_attempt_count_check
    CHECK (attempt_count >= 1),
  CONSTRAINT stripe_webhook_events_error_code_check
    CHECK (last_error_code IS NULL OR last_error_code = 'handler_failed'),
  CONSTRAINT stripe_webhook_events_lifecycle_check
    CHECK (
      (
        status = 'processing'
        AND claim_token IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at > claimed_at
        AND completed_at IS NULL
        AND last_failed_at IS NULL
        AND last_error_code IS NULL
      )
      OR (
        status = 'completed'
        AND claim_token IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NOT NULL
        AND last_failed_at IS NULL
        AND last_error_code IS NULL
      )
      OR (
        status = 'failed'
        AND claim_token IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NULL
        AND last_failed_at IS NOT NULL
        AND last_error_code IS NOT NULL
      )
    )
);

CREATE INDEX stripe_webhook_events_retry_idx
  ON crewcast.stripe_webhook_events (status, lease_expires_at, updated_at);

CREATE FUNCTION crewcast.enforce_stripe_webhook_event_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.event_id,
    NEW.event_type,
    NEW.object_id,
    NEW.event_created_at,
    NEW.livemode,
    NEW.payload_sha256,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.event_id,
    OLD.event_type,
    OLD.object_id,
    OLD.event_created_at,
    OLD.livemode,
    OLD.payload_sha256,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stripe webhook receipt identity is immutable.';
  END IF;

  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'A completed Stripe webhook receipt is immutable.';
  END IF;

  IF OLD.status = 'processing' AND NEW.status = 'processing' THEN
    IF OLD.lease_expires_at > NOW() THEN
      RAISE EXCEPTION 'An active Stripe webhook claim cannot be replaced.';
    END IF;
    IF NEW.claim_token IS NOT DISTINCT FROM OLD.claim_token
       OR NEW.attempt_count <> OLD.attempt_count + 1 THEN
      RAISE EXCEPTION 'An expired Stripe webhook claim requires a new owner and attempt.';
    END IF;
  ELSIF OLD.status = 'processing' AND NEW.status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'A Stripe webhook claim may only complete or fail.';
  ELSIF OLD.status = 'failed' AND NEW.status <> 'processing' THEN
    RAISE EXCEPTION 'A failed Stripe webhook receipt may only be retried.';
  ELSIF OLD.status = 'failed'
        AND (
          NEW.claim_token IS NULL
          OR NEW.attempt_count <> OLD.attempt_count + 1
        ) THEN
    RAISE EXCEPTION 'A Stripe webhook retry requires a new owner and attempt.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER stripe_webhook_events_lifecycle
BEFORE UPDATE ON crewcast.stripe_webhook_events
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_stripe_webhook_event_lifecycle();

ALTER TABLE crewcast.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.stripe_webhook_events
  FROM PUBLIC, anon, authenticated, service_role;

CREATE UNIQUE INDEX credit_transactions_stripe_invoice_reset_key
  ON crewcast.credit_transactions (reference_id, credit_type)
  WHERE reason = 'reset'
    AND reference_type = 'stripe_invoice'
    AND reference_id IS NOT NULL;

COMMENT ON TABLE crewcast.stripe_webhook_events IS
  'Durable claim ledger for signature-verified Stripe events. Completed receipts are immutable; failed or expired claims remain retryable.';
COMMENT ON COLUMN crewcast.stripe_webhook_events.payload_sha256 IS
  'SHA-256 of the exact signed request body, used to reject conflicting reuse of an event ID without storing payment payloads.';
COMMENT ON INDEX crewcast.credit_transactions_stripe_invoice_reset_key IS
  'Prevents one Stripe invoice from resetting the same credit balance more than once.';
