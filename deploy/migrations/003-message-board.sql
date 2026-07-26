-- 003: community message board. Threads are rows with parent_id IS NULL;
-- replies point at their thread. Deletes are soft so a moderated thread keeps
-- its shape and replies do not silently vanish. Idempotent by convention.
CREATE TABLE IF NOT EXISTS board_posts (
  id          bigserial PRIMARY KEY,
  parent_id   bigint REFERENCES board_posts (id) ON DELETE CASCADE,
  user_id     text NOT NULL,             -- Auth0 `sub` claim
  author_name text NOT NULL,             -- snapshot at post time
  title       text,                      -- threads only; NULL on replies
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  text,

  -- A thread has a title, a reply never does.
  CONSTRAINT board_posts_title_shape CHECK (
    (parent_id IS NULL AND title IS NOT NULL) OR
    (parent_id IS NOT NULL AND title IS NULL)
  )
);

-- Thread list: newest threads first.
CREATE INDEX IF NOT EXISTS board_posts_threads_idx
  ON board_posts (created_at DESC) WHERE parent_id IS NULL;

-- Replies within a thread, oldest first.
CREATE INDEX IF NOT EXISTS board_posts_replies_idx
  ON board_posts (parent_id, created_at);
