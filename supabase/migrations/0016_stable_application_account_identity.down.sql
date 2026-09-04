DO $rollback_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.users AS application_users
    LEFT JOIN auth.users AS auth_users
      ON auth_users.id = application_users.auth_user_id
    WHERE application_users.auth_user_id IS NOT NULL
      AND (
        auth_users.id IS NULL
        OR lower(btrim(auth_users.email)) IS DISTINCT FROM lower(btrim(application_users.email))
      )
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0016: current email data cannot reconstruct every stable Auth binding.';
  END IF;
END;
$rollback_guard$;

DROP TRIGGER users_assign_auth_user_id_compatibility ON crewcast.users;
DROP FUNCTION crewcast.assign_application_account_auth_identity();
DROP TRIGGER users_auth_user_id_immutable ON crewcast.users;
DROP FUNCTION crewcast.protect_application_account_auth_identity();

ALTER TABLE crewcast.users
  DROP CONSTRAINT users_auth_user_id_fkey,
  DROP CONSTRAINT users_auth_user_id_key,
  DROP COLUMN auth_user_id;
