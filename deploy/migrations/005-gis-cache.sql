-- 005: server-side copy of the county GIS layers.
--
-- Why this table exists: every reader's browser used to query the county's
-- ArcGIS service directly, so the county paid for a fresh set of queries per
-- visitor, and a reader who arrived during an outage saw an empty map because
-- their own browser cache was empty. One stored copy here serves everyone, and
-- keeps serving while the county's service is down — which it has been, for
-- longer than a day at a time ("Error: Service Public/Public/MapServer not
-- started").
--
-- Only ids listed in website/gis-sources.js are ever written here; the route
-- takes a short id, never a URL, so this cannot become an open proxy.
--
-- Idempotent by convention (see ignore/setup.md §4).
CREATE TABLE IF NOT EXISTS gis_cache (
  -- A key of GIS_SOURCES in website/gis-sources.js.
  layer_id      text PRIMARY KEY,

  -- The upstream response body, gzipped. Stored compressed because these run
  -- to hundreds of kilobytes of GeoJSON each, and because the route can then
  -- hand the bytes straight to a browser that accepts gzip without touching
  -- them. Exactly what upstream returned, so a stored copy and a direct fetch
  -- are the same thing; the browser normalises either one.
  payload       bytea NOT NULL,

  -- Uncompressed size and feature count, for the admin view and for noticing a
  -- layer that has quietly started returning nothing.
  byte_size     integer NOT NULL,
  feature_count integer,

  -- When the payload was fetched. Age is served to the client, which shows it
  -- to the reader rather than implying the map is current.
  fetched_at    timestamptz NOT NULL DEFAULT now(),

  -- The last refresh attempt that did NOT produce a stored payload. Kept
  -- alongside the good copy so an outage is visible without having to read the
  -- service logs, and so a layer stuck on an old copy can be explained.
  last_error    text,
  last_error_at timestamptz,
  error_count   integer NOT NULL DEFAULT 0
);

-- The refresh sweep and the admin view both want "what is oldest".
CREATE INDEX IF NOT EXISTS gis_cache_fetched_at_idx ON gis_cache (fetched_at);
