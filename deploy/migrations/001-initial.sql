-- 001: profiles keyed by the Auth0 subject claim. Message board, surveys, and
-- petitions all hang off this table in later migrations. Idempotent by
-- convention (see ignore/setup.md §4).
CREATE TABLE IF NOT EXISTS profiles (
  user_id    text PRIMARY KEY,          -- Auth0 `sub` claim
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
