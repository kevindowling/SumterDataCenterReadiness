-- 002: one-answer-per-user stance survey shown after login. Keys match the
-- `stances` list in website/server.mjs.
CREATE TABLE IF NOT EXISTS stance_responses (
  user_id    text PRIMARY KEY,          -- Auth0 `sub` claim
  stance     text NOT NULL CHECK (stance IN ('learning', 'opposed', 'cautious', 'expedite')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
