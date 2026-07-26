# Sumter Field Desk website

> **New here?** The complete zero-to-deployed walkthrough lives in `ignore/SETUP.md` (kept out of the public repo). This file is the per-topic reference.

This dependency-free site reads its content from `/research/*.md`. To run it:

```bash
cd website
npm run dev
```

Then open `http://localhost:4173/`.

Run `npm run check` to verify that every research file and site asset exists. No package installation is required.

## Auth0 sign-in

The site includes optional Auth0 authentication (the foundation for account profiles, the message board, surveys, and petitions). Until `auth-config.js` is filled in, the site behaves exactly as before — no sign-in button appears.

One-time setup in the [Auth0 dashboard](https://manage.auth0.com/):

1. Create a (free) tenant if you don't have one.
2. **Applications → Create Application** → name it (e.g. "Sumter Field Desk") → choose **Single Page Web Applications**.
3. In the application's **Settings**, copy the **Domain** and **Client ID** into `website/auth-config.js`.
4. Still in Settings, set all three of these fields to `http://localhost:4173` plus your production URL (e.g. `https://<user>.github.io`), comma-separated:
   - **Allowed Callback URLs**
   - **Allowed Logout URLs**
   - **Allowed Web Origins**
5. Save. Run the site and use the **Sign in** button in the topbar.

### Protected API routes

`server.mjs` verifies Auth0 access tokens (RS256 via the tenant's JWKS, no dependencies) and exposes an example protected route, `GET /api/me`. To enable it:

1. **Applications → APIs → Create API** → set an Identifier (e.g. `https://sumter-field-desk/api`).
2. Put that Identifier in `audience` in `website/auth-config.js`.
3. From the browser, call it with `fetch('/api/me', {headers: await authHeader()})` (see `website/auth.js`).

Future backend features (messages, surveys, petition signatures) should follow the `/api/me` pattern: call `verifyToken(request)` and use `claims.sub` as the user ID.

### Split architecture: Pages front-end, VPS API

The static site stays on GitHub Pages and the server only provides `/api/*` — so the research desk never goes down with the server. Signing in opens the **Community desk** (`#/community`), which probes the API and degrades gracefully: if the VPS is unreachable it shows "community server offline" while every research note keeps working.

To wire the Pages site to the VPS, set in `website/auth-config.js`:

- `apiBase` — the VPS URL, e.g. `https://api.yourdomain.com` (leave empty for local dev, where `server.mjs` serves both)
- `corsOrigins` — add the Pages origin, e.g. `https://<user>.github.io`, so the server accepts cross-origin API calls

## Interactive site map

`website/map.js` renders the signed-in-only map at `#/map` (topbar link and a card on the community desk; neither appears until sign-in). Leaflet 1.9.4 is vendored under `website/vendor/leaflet/` — no npm install, no CDN at runtime. The two files match Leaflet's published SRI hashes:

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

**The map is gated, the data is not.** Hiding the route keeps the map off the public front door, but on GitHub Pages `map.js` is still fetchable and every service it calls is public. Treat this as presentation, not access control.

## Icons and install (PWA)

`website/favicon.svg` and `website/icons/*.png` are generated from the **real surveyed boundary of parcel 64-17**, read live from the county tax parcel layer and projected to Web Mercator at true orientation — the same shape, the same way up, as the site map draws. Regenerate with:

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

## Server CI/CD (VPS)

`.github/workflows/deploy-server.yml` is the full server-side pipeline:

- **Every push and PR**: validates the report files, syntax-checks all scripts, and runs the server test suite (`npm test` in `website/` — static serving, path allowlist, health endpoint, auth rejection).
- **Push to `main`** (once enabled): rsyncs `website/` and `research/` to the VPS, restarts the systemd service, and fails the deploy if `/api/health` doesn't come back up.

### One-time VPS setup

1. Create the VPS (Ubuntu 22.04/24.04 works). Point your domain's DNS A record at it.
2. Generate a deploy key on your machine: `ssh-keygen -t ed25519 -f deploy_key -N '' -C github-actions`
3. Copy `deploy/` to the VPS and run, as root:
   ```bash
   sudo bash deploy/setup-vps.sh yourdomain.com "$(cat deploy_key.pub)"
   ```
   This creates a locked-down `deploy` user (it can rsync files and restart the one service, nothing else), installs Node 22, the systemd unit (`deploy/sumter-field-desk.service`), and Caddy for automatic HTTPS.
4. In the GitHub repo, **Settings → Secrets and variables → Actions**:
   - Secret `VPS_HOST` — the server's hostname or IP
   - Secret `VPS_SSH_KEY` — the contents of the private `deploy_key` file
   - Variable `DEPLOY_ENABLED` — set to `true` (the deploy job is skipped until this exists, so CI stays green before the VPS is ready)
   - Variable `BOARD_ADMINS` (optional) — comma-separated Auth0 `sub` claims allowed to moderate the message board
5. Push to `main`. Watch the **Server CI/CD** workflow deploy and health-check the service.

Remember to add the production URL (e.g. `https://yourdomain.com`) to the Auth0 application's allowed callback/logout/origin lists.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` validates the project, assembles `website/` and `research/` into a static artifact, and deploys it from `main`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

The Pages artifact contains only the public community report: the website and the research notes. Ignored local working files are never copied into it.
