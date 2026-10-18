-- 007: volunteer sign-ups from the /join/ page. Idempotent by convention (see
-- ignore/setup.md §4).
--
-- Nothing here is published. Rows are read by organizers on /volunteers/ and
-- each one is also emailed to the group's address when it arrives.
CREATE TABLE IF NOT EXISTS volunteers (
  id            bigserial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  interests     text[] NOT NULL DEFAULT '{}',   -- keys of INTERESTS in client/volunteer.js
  message       text,
  -- 'pass', 'unavailable' or 'skipped': see verifyTurnstile in server.mjs. A
  -- failed check is refused and never stored.
  turnstile     text NOT NULL,
  notified      boolean NOT NULL DEFAULT false, -- the email to the organizers went out
  contacted_at  timestamptz,                    -- an organizer has followed up
  contacted_by  text,                           -- Auth0 `sub` of that organizer
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS volunteers_created_idx ON volunteers (created_at DESC);
