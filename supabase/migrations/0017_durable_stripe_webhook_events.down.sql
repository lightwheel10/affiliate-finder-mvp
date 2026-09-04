DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.stripe_webhook_events LIMIT 1) THEN
    RAISE EXCEPTION 'Refusing 0017 rollback: Stripe webhook history exists.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM crewcast.credit_transactions
    WHERE reason = 'reset'
      AND reference_type = 'stripe_invoice'
      AND reference_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Refusing 0017 rollback: invoice-keyed credit reset history exists.';
  END IF;
END;
$guard$;

DROP INDEX crewcast.credit_transactions_stripe_invoice_reset_key;
DROP TRIGGER stripe_webhook_events_lifecycle ON crewcast.stripe_webhook_events;
DROP FUNCTION crewcast.enforce_stripe_webhook_event_lifecycle();
DROP TABLE crewcast.stripe_webhook_events;
