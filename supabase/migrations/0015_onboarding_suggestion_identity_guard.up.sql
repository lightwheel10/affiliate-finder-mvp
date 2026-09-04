CREATE TABLE crewcast.onboarding_suggestion_identity_guards (
  auth_user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crewcast.onboarding_suggestion_identity_guards ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.onboarding_suggestion_identity_guards
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.onboarding_suggestion_identity_guards IS
  'Minimal server-owned anti-replay record for onboarding suggestion provider spend. It follows the immutable Supabase identity across email changes and application-account recreation.';
COMMENT ON COLUMN crewcast.onboarding_suggestion_identity_guards.auth_user_id IS
  'Stable Supabase Auth UUID. Retained when account deletion cannot confirm Auth deletion; removed only after that identity is confirmed deleted.';
