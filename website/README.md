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
5. Push to `main`. Watch the **Server CI/CD** workflow deploy and health-check the service.

Remember to add the production URL (e.g. `https://yourdomain.com`) to the Auth0 application's allowed callback/logout/origin lists.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` validates the project, assembles `website/` and `research/` into a static artifact, and deploys it from `main`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

The Pages artifact contains only the public community report: the website and the research notes. Ignored local working files are never copied into it.
