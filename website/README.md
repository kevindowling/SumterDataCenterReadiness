# Sumter Field Desk website

> **New here?** The complete zero-to-deployed walkthrough lives in `ignore/SETUP.md` (kept out of the public repo). This file is the per-topic reference.

This dependency-free site reads its content from `/research/*.md`. To run it:

```bash
cd website
npm run dev
```

Then open `http://localhost:4173/`.

Run `npm run check` to verify that every research file and site asset exists. No package installation is required.

## Layout

The directory is laid out the way the site is served, so a path in the repo is a path in the URL:

| Directory | Holds | Served at |
|---|---|---|
| `client/` | Everything the browser loads: `app.js` and the modules it imports (`content.js`, `petition.js`, `contacts.js`, `meetings.js`, `auth.js`, `auth-config.js`, `map.js`, `gis-sources.js`, `install.js`) | `/client/…` |
| `assets/` | `styles.css`, `favicon.svg`, `manifest.webmanifest`, `icons/`, vendored `vendor/leaflet/` | `/assets/…` |
| `server/` | `server.mjs` (the API and the dev static server) and `server.test.mjs` | not served |
| `build/` | `prerender.mjs` (writes `_site`) and `check.mjs` (the asset checklist) | not served |
| root | `index.html`, `sw.js`, `package.json` | `/`, `/sw.js` |

Two rules keep this from drifting:

- **`sw.js` stays at the root.** A service worker can only control paths under its own URL, so one served from `/client/sw.js` could never claim scope `/`.
- **Anything the browser imports lives in `client/`.** Its modules import each other with plain `./name.js`, which resolves against the served URL — a module moved into another directory has to have every importer updated, and the failure only shows up in the browser.

`server.mjs` and `prerender.mjs` import from `client/` across the directory line; that is Node resolving files on disk, not the browser resolving URLs, so it costs nothing. In production the Pages build copies `client/` and `assets/` verbatim and drops `index.html` and `sw.js` at the root; in development `server.mjs` aliases the same two prefixes into `website/`, so both environments serve identical URLs.

## Auth0 sign-in

The site includes optional Auth0 authentication (the foundation for account profiles, the message board, surveys, and petitions). Until `auth-config.js` is filled in, the site behaves exactly as before — no sign-in button appears.

One-time setup in the [Auth0 dashboard](https://manage.auth0.com/):

1. Create a (free) tenant if you don't have one.
2. **Applications → Create Application** → name it (e.g. "Sumter Field Desk") → choose **Single Page Web Applications**.
3. In the application's **Settings**, copy the **Domain** and **Client ID** into `website/client/auth-config.js`.
4. Still in Settings, set all three of these fields to `http://localhost:4173` plus your production URL (e.g. `https://<user>.github.io`), comma-separated:
   - **Allowed Callback URLs**
   - **Allowed Logout URLs**
   - **Allowed Web Origins**
5. Save. Run the site and use the **Sign in** button in the topbar.

### Protected API routes

`server.mjs` verifies Auth0 access tokens (RS256 via the tenant's JWKS, no dependencies) and exposes an example protected route, `GET /api/me`. To enable it:

1. **Applications → APIs → Create API** → set an Identifier (e.g. `https://sumter-field-desk/api`).
2. Put that Identifier in `audience` in `website/client/auth-config.js`.
3. From the browser, call it with `fetch('/api/me', {headers: await authHeader()})` (see `website/client/auth.js`).

Future backend features (messages, surveys, petition signatures) should follow the `/api/me` pattern: call `verifyToken(request)` and use `claims.sub` as the user ID.

### Split architecture: Pages front-end, VPS API

The static site stays on GitHub Pages and the server only provides `/api/*` — so the research desk never goes down with the server. Signing in opens the **Community desk** (`#/community`), which probes the API and degrades gracefully: if the VPS is unreachable it shows "community server offline" while every research note keeps working.

To wire the Pages site to the VPS, set in `website/client/auth-config.js`:

- `apiBase` — the VPS URL, e.g. `https://api.yourdomain.com` (leave empty for local dev, where `server.mjs` serves both)
- `corsOrigins` — add the Pages origin, e.g. `https://<user>.github.io`, so the server accepts cross-origin API calls

## Interactive site map

`website/client/map.js` renders the signed-in-only map at `#/map` (topbar link and a card on the community desk; neither appears until sign-in). Leaflet 1.9.4 is vendored under `website/assets/vendor/leaflet/` — no npm install, no CDN at runtime. The two files match Leaflet's published SRI hashes:

```
leaflet.js   sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=
leaflet.css  sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=
```

Leaflet and `map.js` are loaded lazily on first visit to `#/map`, so readers who never open the map never download it.

### Where the layers come from

Everything is queried live — nothing is traced from a PDF exhibit, and no geometry is hand-drawn.

| Layer | Source |
|---|---|
| Subject parcel 64-17 (301 Brady Rd, 125.1 ac, zoned Industrial) | Sumter County tax parcel service |
| Council districts (6) and commission districts (5), with rep names | Sumter County GIS; member emails keyed by district from the May 2025 contact sheets |
| FEMA flood zones, lakes/ponds/wetlands, creeks, industrial areas, schools, hospitals, parks | Sumter County GIS public service |
| Churches and care homes | OpenStreetMap via Overpass — the county POI layer has one church countywide |
| Water flow direction | USGS NHDPlus High Resolution — the county creek layer has `FLOWDIR` null on all 1,883 records |
| ½ / 1 / 3 mile rings | Computed by Leaflet in metres from the parcel centroid |
| Address lookup | Nominatim (keyless; keep volume low per OSM's usage policy) |
| Basemaps | Esri World Imagery, OpenStreetMap |

The county service is `https://ga31portal.kcsgis.com/ga31server/rest/services/Public` — the same one behind the [county's public viewer](http://maps.kcsgis.com/ga.americus_sumter_public/). It sends permissive CORS headers, so the browser calls it directly and no API key is needed anywhere.

Each layer fails independently: if one service is down the rest still draw, and the status line under the map names what did not load.

### Where a layer actually comes from

Every request the map makes is listed in `website/gis-sources.js`, shared by the browser and the API server so both ask the county the same questions. Each layer resolves through four steps, first answer wins:

1. **This browser's copy**, if less than a day old (Cache Storage, `field-desk-gis-v2`).
2. **`GET {apiBase}/api/gis?layer=<id>`** — one copy in Postgres, shared by every reader.
3. **The county's ArcGIS service** (or Overpass) directly.
4. **This browser's expired copy**, however old, rather than a blank map.

Step 2 is what keeps the county's server from paying for a fresh set of queries per visitor, and it is the only step that helps a **first-time** reader during an outage — steps 1 and 4 need a copy the device already has. Step 3 stays so the Pages site never goes down with the API server.

The status line under the map names which of the four answered, with the age of anything that wasn't fetched fresh.

### `/api/gis` (public)

Public like the petition routes, because the layers are public record. The security boundary is that **the route never accepts a URL** — it takes a short id from `GIS_SOURCES` and builds the upstream request itself, so it cannot be used as an open proxy. Anything not in the table is a 404. Rate limited to 120 requests/minute per `/24`, since one map load asks for thirteen layers.

Storage is `gis_cache` (migration `deploy/migrations/005-gis-cache.sql`), one row per layer holding the gzipped upstream response. Requests that accept gzip get those bytes untouched.

Refresh is **stale-while-revalidate**: a copy under 24h is returned as-is; an older one is returned *immediately* and a refresh runs behind the response, deduplicated so thirteen layers don't stampede. A failed refresh leaves the good copy in place and records `last_error`/`error_count` beside it. Only a layer with no stored copy at all makes a reader wait, and if upstream is down that single layer 503s and the browser falls through to step 3.

Age is reported in `X-Gis-Fetched-At`, `X-Gis-Age-Ms` and `X-Gis-State`, listed in `Access-Control-Expose-Headers` so the map can read them cross-origin.

### Outages and poisoned copies

The county has taken the whole `Public` folder offline before — `Error: Service Public/Public/MapServer not started`, HTTP 500 on every layer, for longer than a day. Failed requests retry three times with a widening pause (5xx and 429 only; a 404 won't fix itself), and expired copies are kept 90 days, pruned only once something has answered on that page load.

**ArcGIS reports a failed query as HTTP 200 with an error in the body**, so status alone is not enough to decide a response is worth keeping. Both the browser and the server parse and validate before storing (`gisPayloadError`). The client cache name was bumped `v1` → `v2` to evict entries written before that check existed.

**The map is gated, the data is not.** Hiding the route keeps the map off the public front door, but on GitHub Pages `map.js` is still fetchable and every service it calls is public. Treat this as presentation, not access control.

## Public meeting calendar

`website/client/meetings.js` holds every meeting the site publishes, and `/meetings/` renders them month by month. Each one also gets its own page — `/meetings/2026-08-20-council/` — prerendered with its own title and description, so a link to a single meeting previews properly and a search for "Americus city council August 20" can land on it.

**Every date is checked in by hand, never computed.** The county publishes a rule (work session the second Tuesday, regular meeting the third) and it would be easy to generate dates from it. Don't. The city's September 2026 meetings fall on the third and fourth Thursday while February's and March's fell on the second and third; a generated calendar would have published two wrong dates and sent people to a locked building. Each entry records the calendar it was read off (`source`) and `CONFIRMED_ON` says when, so the claim carries its own expiry.

Refreshing it is a manual chore by design:

1. Read the [county calendar](https://www.sumtercountyga.us/calendar.aspx) and the [city agenda portal](https://americuscityga.iqm2.com/Citizens/Calendar.aspx) month by month.
2. Add an `official(date, body, kind, speak)` line per meeting. The source link is derived from the date, so it always points at the month and year actually being cited.
3. Move `CONFIRMED_ON` and `STALE_AFTER` forward.

Past `STALE_AFTER` the page stops presenting itself as current and points readers at both official calendars instead of quietly showing an empty month.

**Nothing is limited to one year.** Dates are full ISO dates, months are grouped and labelled with their year, and `easternInstant` reads the America/New_York offset for whatever date it is handed — leap days and DST changes in any year included. The list currently ends in December 2026 only because that is as far as both bodies have posted: as of August 2026 the city's portal reports "0 meetings" for all of 2027 and the county's calendar shows none. When they post, adding the rows is the only change needed.

**`speak` is the field that matters.** `published` means the body posts how to get on the speakers' list and those rules are quoted on the page; `unknown` means it does not, which is rendered as a finding with a phone number rather than left blank. Only the city's regular meeting is `published` today — five speakers, five minutes each, sign-up opening thirty minutes before and closing when the meeting starts. That is why the home page carries a "next chance to speak" band: a meeting a reader hears about after the sheet closed may as well not have happened.

Times are stored as local wall clock (`time: '18:00'`) and converted to UTC for the `.ics` file by `easternInstant`, which reads the America/New_York offset for that specific date. These meetings straddle the November DST change, so hand-written UTC stamps would have been an hour off for November and December.

## Fonts

Newsreader and DM Mono are served from this origin, not from Google. Regenerate with:

```bash
python3 tools/vendor-fonts.py
```

That asks `fonts.googleapis.com` for the same stylesheet the browser used to request, downloads every `.woff2` it names into `website/assets/fonts/`, and writes `website/assets/fonts.css` with the URLs rewritten to local paths. Google's `unicode-range` rules are kept exactly as served, so a reader whose page has no Vietnamese never downloads the Vietnamese subset — in practice an English page fetches three files, about 157 KB.

Two things the script has to get right, both of which it got wrong first:

- **Newsreader is variable.** All three requested weights resolve to one file per subset, so it must be downloaded once and declared three times. Naming it per weight fetched the same 128 KB three times.
- **DM Mono is not.** Its 400 and 500 are different files, so they must *not* collapse to one name. They did, and the second silently overwrote the first, leaving both weights pointing at the 500.

Only upright faces are vendored, matching what the hosted stylesheet served; italic is synthesised by the browser exactly as it was before, so the change is invisible on the page. Adding true italics would be a real improvement and a real visual change — a separate decision.

The latin subsets are precached by the service worker; latin-ext and vietnamese are fetched on demand, which for this site means never. Because the filenames are stable rather than content-hashed, a font change needs a `VERSION` bump in `sw.js` like any other shell change.

## Icons and install (PWA)

`website/assets/favicon.svg` and `website/assets/icons/*.png` are generated from the **real surveyed boundary of parcel 64-17**, read live from the county tax parcel layer and projected to Web Mercator at true orientation — the same shape, the same way up, as the site map draws. Regenerate with:

```bash
python3 tools/build-favicon.py     # needs rsvg-convert for the PNGs
```

Don't hand-edit `favicon.svg`; re-run the script.

The site installs to a home screen via `manifest.webmanifest` and `sw.js`:

- **Android/Chrome** — `install.js` intercepts `beforeinstallprompt` and offers its own button instead of the browser's mini-infobar.
- **iOS Safari** — no install API exists, so the prompt shows the Share → *Add to Home Screen* steps. Only Safari can install on iOS; Chrome/Firefox on iOS are excluded from the prompt.
- The prompt is quiet: never on a first visit, hidden once installed, and snoozed 30 days after a dismissal.

The service worker caches the app shell and research notes (network-first, so corrections appear immediately). It **never** caches `/api/*`, Auth0, or any GIS/tile/Overpass request — the desk must not report stale data. Bump `VERSION` in `sw.js` to force clients onto new assets.

## Message board

`#/board`, signed in only. Threads are rows in `board_posts` with `parent_id IS NULL`; replies point at their thread (migration `deploy/migrations/003-message-board.sql`).

- **Attribution** — posts carry the Auth0 profile name, snapshotted at post time so a later name change does not rewrite history.
- **Deletes are soft.** `deleted_at` is set and the API stops returning the body, author, and title; the row stays so replies keep their place. A removed post renders as "This post was removed."
- **Moderators** — set the repository variable `BOARD_ADMINS` to a comma-separated list of Auth0 `sub` claims (e.g. `auth0|abc123,google-oauth2|456`). The deploy workflow writes it into `server.env`. Authors can always delete their own posts; moderators can delete anyone's. **Unset means nobody can moderate** — find your own `sub` by signing in and calling `/api/me`.
- **Throttle** — 5 posts per user per minute, in memory. It blunts flooding; it is not moderation, and it resets when the service restarts.
- **Plain text only.** Bodies are HTML-escaped and only newlines are honoured, so no one can inject links or markup into a public thread.

Routes, all behind `verifyToken()`: `GET /api/board`, `POST /api/board`, `GET /api/board/:id`, `POST /api/board/:id/reply`, `DELETE /api/board/:id`.

## Petition

`/petition/` — **public, no sign-in.** A petition is only worth delivering if the people it speaks for could actually sign it, so this is the one community feature without a login wall. The text, the in-person signing details and the Sumter County ZIP list all live in `website/client/petition.js`; the schema is `deploy/migrations/004-petition.sql`; the public methodology page is `research/13-petition-integrity.md`, which is a promise to readers — **if you change the behaviour, change that note in the same commit.**

### How a signature is counted

1. `POST /api/petition/:id/sign` records a **pending** row. No published number moves.
2. Cloudflare Turnstile is validated **server-side**, and what happens next depends on which of four answers comes back. A token Cloudflare **rejects** is refused with 403 and nothing is stored. A token that **expired or was spent twice** is also refused, but the signer is told to press the button again rather than that they failed a test. **No token at all** — a browser blocking `challenges.cloudflare.com`, a dropped script, a Cloudflare outage, or a bot omitting the field — is recorded with a `turnstile-unavailable` flag rather than refused, because none of those are a verdict on the signer and a stricter-than-average browser should not cost the petition a name. An unset `TURNSTILE_SECRET` (local dev and CI) records `skipped`. Set `TURNSTILE_REQUIRED=1` to refuse the unverified path too, if it is ever abused.
   - What still stands behind an unverified signature: it counts for nothing until the emailed link is opened, the honeypot and duplicate-identity checks run either way, a much tighter per-connection rate limit applies (3 an hour, against 8 in 10 minutes), and the flag is on the row for review.
3. A single-use confirmation link (stored as a SHA-256 hash, 24-hour expiry) is emailed.
4. `GET /api/petition/verify?token=…` flips the row to **verified** in one atomic statement that also clears the token, so a replayed link does nothing.
5. Public totals count verified rows only, reported **by locality** — never merged into one headline number.

Withdrawal is a **POST** behind a confirmation button, not a bare link: mail clients and security scanners follow links in email on their own, and a GET that removed a signature would let a scanner quietly undo one.

- **One mailbox, one signature** is enforced by a unique index on `(petition_id, email_key)`, not by an application check — concurrent submissions race past application checks (verified: 10 simultaneous identical submissions produce exactly one row). Addresses are compared after normalisation, so `ann.lee+x@gmail.com` and `annlee@gmail.com` are one signer.
- **Risk flags are recorded, not enforced.** Disposable domains, repeated household names and single-word names go in `risk_flags` for a human to review. Only the hidden honeypot field auto-rejects, and it still returns the same response as everything else. The Turnstile gate is the exception: it refuses before the row is written.
- **The response is identical** for a new address, a repeat, an already-confirmed address and a honeypot catch. Otherwise the form becomes a way to ask "has my neighbour signed?"
- **Rate limits** are per hashed network prefix (8 per 10 min, 60 per day) and per mailbox (2 confirmation emails per hour), deliberately loose because libraries, workplaces and phone carriers put many real people behind one address.

### Paper signatures

Paper sheets signed in person are keyed in by an organizer via `POST /api/petition/:id/paper` (the form appears on the page for accounts in `BOARD_ADMINS`). They are stored with `source = 'paper'` and counted on their own line, because "an organizer watched this person sign" and "this person opened a link in their own mailbox" are different kinds of evidence.

### Audit chain

`POST /api/petition/:id/snapshot` (organizers) writes the current totals, the row count, and the SHA-256 of a canonical export into `petition_snapshots`, each linked to the hash before it. `GET /api/petition/:id/snapshots` is **public**, so anyone can check a total published last month against the chain. `GET /api/petition/:id/export.csv` (organizers) is the copy with email addresses in it — never post it anywhere.

### Before launch

1. **Fill in `inPerson` in `website/client/petition.js`** — place, address, hours, contact. While `address` is empty the page says a location is being arranged instead of naming one.
2. **Verify `SUMTER_ZIPS`** against the USPS ZIP lookup. A wrong entry inflates the one number the council will actually weigh.
3. **Cloudflare Turnstile** — dash.cloudflare.com → Turnstile → Add site. Put the site key in `turnstileSiteKey` in `auth-config.js` and the secret in the `TURNSTILE_SECRET` repository secret.
4. **Mail** — a [Resend](https://resend.com) API key in `RESEND_API_KEY`. `MAIL_FROM` must be an address on a domain verified in Resend (`scc4t.com` is verified; the built-in default is `Sumter Field Desk <petition@scc4t.com>`, so the variable only needs setting to override that). Set `MAIL_REPLY_TO` to an inbox a human reads — someone whose name was signed without their consent will hit reply, and that is the path by which a forged signature gets reported. With no API key the server prints the confirmation link to its log instead of sending, which is how the flow is exercised locally.
5. **`PETITION_SECRET`** — `openssl rand -hex 32`, stored as a repository secret. Set it once and leave it: rotating it orphans every existing deduplication key. **Without it the sign route refuses to record anything**, rather than hashing under a value an attacker could guess.

Repository **secrets**: `PETITION_SECRET`, `TURNSTILE_SECRET`, `RESEND_API_KEY`. Repository **variables**: `MAIL_FROM`, `MAIL_REPLY_TO`, `PUBLIC_ORIGIN`, `API_ORIGIN`, and optionally `TURNSTILE_REQUIRED` (set to `1` to refuse signatures the anti-bot check could not cover).

If confirmation emails stop arriving, the server log names the cause: it prints Resend's own response body on a failed send (unverified domain, bad key, `from` address rejected), and the signer gets a 502 telling them to retry rather than a "check your email" for a message that never left.

### Running the whole flow locally

```bash
docker run -d --rm --name petition-dev -e POSTGRES_PASSWORD=test -e POSTGRES_DB=scc4t -p 55432:5432 postgres:16-alpine
docker exec -i petition-dev psql -U postgres -d scc4t < ../deploy/migrations/001-initial.sql
docker exec -i petition-dev psql -U postgres -d scc4t < ../deploy/migrations/004-petition.sql
DATABASE_URL='postgres://postgres:test@localhost:55432/scc4t' PETITION_SECRET=dev-only npm run dev
```

Sign at `http://localhost:4173/petition/`, then open the confirmation link the server logs to its console.

## Server CI/CD (VPS)

`.github/workflows/deploy-server.yml` is the server-side pipeline:

- **Every push and PR**: validates the report files, syntax-checks all scripts, and runs the server test suite (`npm test` in `website/` — static serving, path allowlist, health endpoint, auth rejection).
- **Push to `main`** (once enabled): checks the installed systemd unit still matches `deploy/sumter-field-desk.service`, rsyncs `website/` and `research/` to the VPS, restarts the service, and fails the deploy if `/api/health` doesn't come back up.

Provisioning the server, the deploy secrets, and what to do when the unit file changes are all in `ignore/SETUP.md`, which is kept out of the public repo.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` validates the project, assembles `website/` and `research/` into a static artifact, and deploys it from `main`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

The Pages artifact contains only the public community report: the website and the research notes. Ignored local working files are never copied into it.
