-- 006: open-records request log. One row per request a resident filed with an
-- agency, and one row per document uploaded against it. Idempotent by
-- convention (see ignore/setup.md §4).
--
-- The log exists so neighbors stop filing the same request twice, which is why
-- the requester's name is required and public: the point is that someone who
-- wants the same records can find the person who already asked.
CREATE TABLE IF NOT EXISTS records_requests (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL,             -- Auth0 `sub` of whoever logged it
  requester_name  text NOT NULL,             -- as typed, shown publicly
  agency          text NOT NULL,
  custodian       text,                      -- the records officer, if known
  description     text NOT NULL,             -- what was asked for
  sent_on         date NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fulfilled', 'partial', 'denied', 'withdrawn')),
  fulfilled_on    date,
  -- § 50-18-71(d) requires a denial to cite the code section relied on; the
  -- citation is what makes a denial challengeable, so it is kept verbatim.
  denial_citation text,
  -- The request's folder in the desk's Drive, created on first upload.
  drive_folder_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The public log: newest first.
CREATE INDEX IF NOT EXISTS records_requests_sent_idx
  ON records_requests (sent_on DESC, id DESC);

-- Uploaded documents. The original lives only in the private Drive folder; the
-- public copies are the redacted files an organizer committed under
-- research/records/, recorded in published_paths once they are live. Usually
-- one; a workbook publishes one CSV per sheet.
CREATE TABLE IF NOT EXISTS records_files (
  id              bigserial PRIMARY KEY,
  request_id      bigint NOT NULL REFERENCES records_requests (id) ON DELETE CASCADE,
  uploaded_by     text NOT NULL,             -- Auth0 `sub`
  filename        text NOT NULL,             -- as uploaded, for the reviewer
  kind            text NOT NULL CHECK (kind IN ('pdf', 'png', 'jpeg', 'xlsx', 'xls', 'csv')),
  byte_size       bigint NOT NULL,
  sha256          text NOT NULL,
  -- NULL once the original has been deleted from Drive (published or rejected).
  drive_file_id   text,
  -- received: in Drive, waiting for redaction.
  -- drafted:  a redacted draft exists on the organizer's machine.
  -- published: the redacted copies are live at published_paths.
  -- rejected: not publishable; review_note says why.
  state           text NOT NULL DEFAULT 'received'
                    CHECK (state IN ('received', 'drafted', 'published', 'rejected')),
  published_paths text[],
  review_note     text,
  reviewed_by     text,                      -- Auth0 `sub` of the organizer
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT records_files_published_shape CHECK (state <> 'published' OR cardinality(published_paths) > 0)
);

CREATE INDEX IF NOT EXISTS records_files_request_idx ON records_files (request_id);

-- The review queue.
CREATE INDEX IF NOT EXISTS records_files_queue_idx
  ON records_files (created_at) WHERE state IN ('received', 'drafted');

-- Per-user quota: what a user currently has sitting in Drive. Published and
-- rejected originals are deleted from Drive, so they stop counting.
CREATE INDEX IF NOT EXISTS records_files_uploader_idx
  ON records_files (uploaded_by) WHERE state IN ('received', 'drafted');
