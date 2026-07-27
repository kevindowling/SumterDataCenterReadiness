-- 004: petitions. One row per attempted signature; only rows that reach
-- status 'verified' are ever counted in public. Idempotent by convention
-- (see ignore/setup.md §4).
--
-- Privacy shape: the raw email is kept because the desk has to be able to
-- confirm the address and let the signer withdraw, but it is never returned by
-- any public route. Everything used for matching and abuse review is a keyed
-- hash (HMAC-SHA256 under PETITION_SECRET) so a database copy on its own does
-- not reveal who signed from which network.
CREATE TABLE IF NOT EXISTS petition_signatures (
  id            bigserial PRIMARY KEY,
  petition_id   text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'withdrawn', 'rejected')),

  -- What the signer typed.
  name          text NOT NULL,
  email         text NOT NULL,
  city          text NOT NULL,
  state         text NOT NULL,
  postal_code   text NOT NULL,
  comment       text,

  -- Whether the name, city and comment may appear on the public page. The
  -- signature counts either way; only the attribution is opt-in.
  public_display boolean NOT NULL DEFAULT false,

  -- 'sumter' (in-county), 'georgia' (elsewhere in the state), 'elsewhere'.
  -- Published as separate totals rather than merged into one headline number.
  tier          text NOT NULL CHECK (tier IN ('sumter', 'georgia', 'elsewhere')),

  -- 'web' — signed on the site and confirmed by email.
  -- 'paper' — signed in person on a paper sheet and keyed in by an organizer,
  --           who is recorded in entered_by. Counted, but reported separately.
  source        text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'paper')),
  entered_by    text,                       -- Auth0 `sub` of the organizer, paper only
  user_id       text,                       -- Auth0 `sub` when signed in, else NULL

  -- Matching and review, all keyed hashes. email_key is the deduplication key;
  -- identity_key (name + postal code) only flags a possible duplicate for a
  -- human to look at, because two real people can share a household name.
  email_key     text NOT NULL,
  identity_key  text NOT NULL,
  ip_prefix_hash text,                      -- /24 (v4) or /48 (v6), hashed
  user_agent_hash text,
  risk_flags    text[] NOT NULL DEFAULT '{}',
  turnstile     text NOT NULL DEFAULT 'skipped',  -- pass | fail | skipped

  -- Single-use tokens, stored as SHA-256 so the database never holds a value
  -- that would let its reader confirm or withdraw somebody else's signature.
  verify_token_hash   text,
  verify_expires_at   timestamptz,
  withdraw_token_hash text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  verified_at   timestamptz,
  withdrawn_at  timestamptz,

  -- A paper signature is verified in person and never carries a verify token;
  -- a web signature must have one until it is used.
  CONSTRAINT petition_paper_is_verified CHECK (source <> 'paper' OR status = 'verified')
);

-- The real uniqueness guarantee. Application-level "have they signed already?"
-- checks lose the race between two concurrent submissions; this does not.
CREATE UNIQUE INDEX IF NOT EXISTS petition_signatures_email_key_idx
  ON petition_signatures (petition_id, email_key);

-- Token lookups on confirmation and withdrawal.
CREATE INDEX IF NOT EXISTS petition_signatures_verify_token_idx
  ON petition_signatures (verify_token_hash) WHERE verify_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS petition_signatures_withdraw_token_idx
  ON petition_signatures (withdraw_token_hash) WHERE withdraw_token_hash IS NOT NULL;

-- Public counts and the public signature list.
CREATE INDEX IF NOT EXISTS petition_signatures_counting_idx
  ON petition_signatures (petition_id, status, tier);
CREATE INDEX IF NOT EXISTS petition_signatures_public_idx
  ON petition_signatures (petition_id, verified_at DESC)
  WHERE status = 'verified' AND public_display;

-- Possible duplicate households, for manual review only.
CREATE INDEX IF NOT EXISTS petition_signatures_identity_idx
  ON petition_signatures (petition_id, identity_key);

-- Append-only audit chain. Each row records the counts at a moment in time and
-- the SHA-256 of the canonical export behind them, so a later silent edit to
-- the signature table is detectable by anyone holding an earlier snapshot.
-- previous_sha256 links each snapshot to the one before it.
CREATE TABLE IF NOT EXISTS petition_snapshots (
  id              bigserial PRIMARY KEY,
  petition_id     text NOT NULL,
  taken_at        timestamptz NOT NULL DEFAULT now(),
  taken_by        text,                     -- Auth0 `sub` of the organizer
  counts          jsonb NOT NULL,
  row_count       integer NOT NULL,
  sha256          text NOT NULL,
  previous_sha256 text
);

CREATE INDEX IF NOT EXISTS petition_snapshots_petition_idx
  ON petition_snapshots (petition_id, taken_at DESC);
