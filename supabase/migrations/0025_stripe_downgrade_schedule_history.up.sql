-- One Stripe Subscription Schedule can be intentionally revised several times
-- before it takes effect. Keep every immutable application operation as audit
-- history while indexing (rather than uniquely constraining) the shared Stripe
-- schedule identifier.
DROP INDEX crewcast.stripe_downgrade_operations_schedule_key;

CREATE INDEX stripe_downgrade_operations_schedule_idx
  ON crewcast.stripe_downgrade_operations (stripe_schedule_id)
  WHERE stripe_schedule_id IS NOT NULL;
