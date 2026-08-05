import {createHash, createHmac, createPublicKey, randomBytes, verify as verifySignature} from 'node:crypto';
import {createReadStream, readFileSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {gunzip as gunzipCb, gzip as gzipCb} from 'node:zlib';
import {authConfig} from '../client/auth-config.js';
import {escapeHtml} from '../client/content.js';
import {
  GIS_SOURCES, OVERPASS, arcgisUrl, gisPayloadError, overpassQuery,
} from '../client/gis-sources.js';
import {
  DISPOSABLE_DOMAINS, TIERS, findPetition, normalizeEmail, normalizeIdentity, validateSignature,
} from '../client/petition.js';

const serverDir = fileURLToPath(new URL('.', import.meta.url));         // website/server
const websiteDir = normalize(join(serverDir, '..'));
const projectDir = normalize(join(websiteDir, '..'));
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

// Verifies an Auth0-issued RS256 access token without dependencies. Every
// future protected API route (messages, surveys, petitions) reuses this.
let jwksKeys = null;
async function getSigningKey(kid) {
  if (!jwksKeys?.some((key) => key.kid === kid)) {
    const jwksResponse = await fetch(`https://${authConfig.domain}/.well-known/jwks.json`);
    if (!jwksResponse.ok) throw new Error('Unable to fetch JWKS');
    jwksKeys = (await jwksResponse.json()).keys;
  }
  const jwk = jwksKeys.find((key) => key.kid === kid);
  if (!jwk) throw new Error('Unknown signing key');
  return createPublicKey({key: jwk, format: 'jwk'});
}

async function verifyToken(request) {
  const token = (request.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) throw new Error('Missing bearer token');
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  const header = JSON.parse(Buffer.from(headerPart, 'base64url'));
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url'));
  if (header.alg !== 'RS256') throw new Error('Unexpected algorithm');
  const key = await getSigningKey(header.kid);
  const signed = Buffer.from(`${headerPart}.${payloadPart}`);
  if (!verifySignature('RSA-SHA256', signed, key, Buffer.from(signaturePart, 'base64url'))) throw new Error('Invalid signature');
  if (payload.exp <= Date.now() / 1000) throw new Error('Token expired');
  if (payload.iss !== `https://${authConfig.domain}/`) throw new Error('Wrong issuer');
  if (![].concat(payload.aud).includes(authConfig.audience)) throw new Error('Wrong audience');
  return payload;
}

// Postgres pool, created lazily so the server (and its tests) run fine with
// no database configured. `pg` is only imported once DATABASE_URL is set.
let pool = null;
async function getPool() {
  const url = process.env.DATABASE_URL || '';
  if (!url && !process.env.PGHOST) return null; // pg also reads PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT
  if (!pool) {
    const {default: pg} = await import('pg');
    // Managed instances require TLS but present provider CAs; verify-full
    // needs the CA bundled, so require-mode connections skip chain checks.
    const tls = /sslmode=(require|no-verify|verify-)/.test(url) || /^(require|no-verify|verify-)/.test(process.env.PGSSLMODE || '');
    pool = new pg.Pool({...(url ? {connectionString: url} : {}), max: 5, ...(tls ? {ssl: {rejectUnauthorized: false}} : {})});
  }
  return pool;
}

// Login survey: which group the signed-in resident falls into.
const stances = ['learning', 'opposed', 'cautious', 'expedite'];

const sendJson = (response, status, body) => {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(body));
};

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) { reject(new Error('Body too large')); request.destroy(); }
    });
    request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); } });
    request.on('error', reject);
  });
}

async function handleSurveyStance(request, response, claims) {
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }
  if (request.method === 'GET') {
    const {rows} = await database.query('SELECT stance FROM stance_responses WHERE user_id = $1', [claims.sub]);
    sendJson(response, 200, {stance: rows[0]?.stance ?? null});
    return;
  }
  if (request.method === 'POST') {
    const {stance} = await readJsonBody(request);
    if (!stances.includes(stance)) { sendJson(response, 400, {error: `stance must be one of: ${stances.join(', ')}`}); return; }
    await database.query(
      `INSERT INTO stance_responses (user_id, stance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET stance = EXCLUDED.stance, updated_at = now()`,
      [claims.sub, stance]);
    sendJson(response, 200, {stance});
    return;
  }
  sendJson(response, 405, {error: 'Method not allowed'});
}

// --- Message board ---------------------------------------------------------
// Moderators are Auth0 subject claims listed in BOARD_ADMINS (comma separated).
// Unset means nobody can moderate, which is the safe default for a fresh box.
const boardAdmins = new Set((process.env.BOARD_ADMINS || '').split(',').map((id) => id.trim()).filter(Boolean));
const isAdmin = (claims) => boardAdmins.has(claims.sub);

const TITLE_MAX = 140;
const BODY_MAX = 4000;

// Small in-memory throttle, keyed by whatever the caller wants to limit — an
// account for the board, a hashed network prefix or mailbox for the petition.
// Not a substitute for real moderation, but it stops one source from flooding
// faster than anyone can respond. Resets when the service restarts.
const postTimes = new Map();
function throttled(key, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const recent = (postTimes.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) { postTimes.set(key, recent); return true; }
  recent.push(now);
  postTimes.set(key, recent);
  return false;
}

// The throttle map is the only unbounded structure in the process; a long
// uptime with real traffic would otherwise keep one entry per network forever.
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, times] of postTimes) {
    const recent = times.filter((time) => time > cutoff);
    if (recent.length) postTimes.set(key, recent); else postTimes.delete(key);
  }
}, 60 * 60 * 1000).unref();

// An Auth0 access token issued for a custom API audience carries sub/iss/aud/
// exp/scope and nothing else — name and email live on the ID token and
// /userinfo. So the display name is resolved server-side and cached: token
// claims (in case the tenant adds them via an Action), then the profiles table,
// then one /userinfo call per user.
const FALLBACK_NAME = 'Neighbor';
const nameCache = new Map();

const fromClaims = (claims) => (claims.name || claims.nickname || claims.email || '').trim();

async function fetchUserInfoName(request) {
  const token = (request.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return '';
  try {
    const response = await fetch(`https://${authConfig.domain}/userinfo`, {headers: {Authorization: `Bearer ${token}`}});
    if (!response.ok) return '';
    const profile = await response.json();
    return (profile.name || profile.nickname || profile.email || '').trim();
  } catch {
    return ''; // the board still works with the fallback name
  }
}

async function displayName(request, claims, database) {
  const cached = nameCache.get(claims.sub);
  if (cached) return cached;

  let name = fromClaims(claims);
  if (!name && database) {
    const {rows} = await database.query('SELECT display_name FROM profiles WHERE user_id = $1', [claims.sub]);
    name = (rows[0]?.display_name || '').trim();
  }

  let resolved = true;
  if (!name) {
    name = await fetchUserInfoName(request);
    if (!name) { name = FALLBACK_NAME; resolved = false; }
  }
  name = name.slice(0, 80);

  if (resolved && database) {
    await database.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
      [claims.sub, name]);
    // Posts written before the name could be resolved still say "Neighbor";
    // now that it is known, adopt them rather than leaving them anonymous.
    await database.query(
      'UPDATE board_posts SET author_name = $2 WHERE user_id = $1 AND author_name = $3',
      [claims.sub, name, FALLBACK_NAME]);
  }
  if (resolved) nameCache.set(claims.sub, name);
  return name;
}

// Never leak the body of a removed post; the row survives so replies keep their
// place in the thread.
const publicPost = (row, claims) => ({
  id: String(row.id),
  parentId: row.parent_id === null ? null : String(row.parent_id),
  author: row.deleted_at ? null : row.author_name,
  title: row.deleted_at ? null : row.title,
  body: row.deleted_at ? null : row.body,
  createdAt: row.created_at,
  deleted: Boolean(row.deleted_at),
  replies: row.reply_count === undefined ? undefined : Number(row.reply_count),
  canDelete: !row.deleted_at && (row.user_id === claims.sub || isAdmin(claims)),
  mine: row.user_id === claims.sub,
});

async function handleBoard(pathname, request, response, claims) {
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }

  // GET /api/board -> thread list
  if (pathname === '/api/board' && request.method === 'GET') {
    const {rows} = await database.query(
      `SELECT t.*, (SELECT count(*) FROM board_posts r WHERE r.parent_id = t.id AND r.deleted_at IS NULL) AS reply_count
         FROM board_posts t WHERE t.parent_id IS NULL
        ORDER BY t.created_at DESC LIMIT 100`);
    sendJson(response, 200, {threads: rows.map((row) => publicPost(row, claims)), admin: isAdmin(claims)});
    return;
  }

  // POST /api/board -> new thread
  if (pathname === '/api/board' && request.method === 'POST') {
    const {title, body} = await readJsonBody(request);
    const cleanTitle = String(title ?? '').trim();
    const cleanBody = String(body ?? '').trim();
    if (!cleanTitle || cleanTitle.length > TITLE_MAX) { sendJson(response, 400, {error: `Title must be 1-${TITLE_MAX} characters.`}); return; }
    if (!cleanBody || cleanBody.length > BODY_MAX) { sendJson(response, 400, {error: `Message must be 1-${BODY_MAX} characters.`}); return; }
    if (throttled(claims.sub)) { sendJson(response, 429, {error: 'Too many posts in a row. Wait a minute and try again.'}); return; }
    const {rows} = await database.query(
      `INSERT INTO board_posts (user_id, author_name, title, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [claims.sub, await displayName(request, claims, database), cleanTitle, cleanBody]);
    sendJson(response, 201, {post: publicPost(rows[0], claims)});
    return;
  }

  const threadMatch = pathname.match(/^\/api\/board\/(\d+)$/);
  const replyMatch = pathname.match(/^\/api\/board\/(\d+)\/reply$/);

  // GET /api/board/:id -> one thread with its replies
  if (threadMatch && request.method === 'GET') {
    const {rows} = await database.query(
      `SELECT * FROM board_posts WHERE id = $1 OR parent_id = $1 ORDER BY parent_id NULLS FIRST, created_at`,
      [threadMatch[1]]);
    const thread = rows.find((row) => row.parent_id === null);
    if (!thread) { sendJson(response, 404, {error: 'Thread not found'}); return; }
    sendJson(response, 200, {
      thread: publicPost(thread, claims),
      replies: rows.filter((row) => row.parent_id !== null).map((row) => publicPost(row, claims)),
      admin: isAdmin(claims),
    });
    return;
  }

  // POST /api/board/:id/reply
  if (replyMatch && request.method === 'POST') {
    const {body} = await readJsonBody(request);
    const cleanBody = String(body ?? '').trim();
    if (!cleanBody || cleanBody.length > BODY_MAX) { sendJson(response, 400, {error: `Message must be 1-${BODY_MAX} characters.`}); return; }
    const {rows: parent} = await database.query('SELECT id FROM board_posts WHERE id = $1 AND parent_id IS NULL', [replyMatch[1]]);
    if (!parent.length) { sendJson(response, 404, {error: 'Thread not found'}); return; }
    if (throttled(claims.sub)) { sendJson(response, 429, {error: 'Too many posts in a row. Wait a minute and try again.'}); return; }
    const {rows} = await database.query(
      `INSERT INTO board_posts (parent_id, user_id, author_name, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [replyMatch[1], claims.sub, await displayName(request, claims, database), cleanBody]);
    sendJson(response, 201, {post: publicPost(rows[0], claims)});
    return;
  }

  // DELETE /api/board/:id -> author or moderator, soft delete
  if (threadMatch && request.method === 'DELETE') {
    const {rows} = await database.query('SELECT user_id, deleted_at FROM board_posts WHERE id = $1', [threadMatch[1]]);
    if (!rows.length) { sendJson(response, 404, {error: 'Post not found'}); return; }
    if (rows[0].user_id !== claims.sub && !isAdmin(claims)) { sendJson(response, 403, {error: 'Not your post'}); return; }
    await database.query(
      'UPDATE board_posts SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL',
      [threadMatch[1], claims.sub]);
    sendJson(response, 200, {deleted: true});
    return;
  }

  sendJson(response, 405, {error: 'Method not allowed'});
}

// --- Petition ---------------------------------------------------------------
//
// The one part of the community desk that does not sit behind sign-in: a
// petition only worth delivering is one the people it speaks for could
// actually sign, and requiring an Auth0 account first would lose more real
// residents than it would stop bots.
//
// What replaces the login gate:
//
//   1. Nothing is counted until a single-use link sent to the address is
//      clicked. A submission on its own moves no number on the page.
//   2. A unique index on (petition_id, email_key) makes one address one
//      signature at the database level, where concurrent requests cannot race
//      past it.
//   3. Cloudflare Turnstile is validated server-side, never trusted from the
//      browser.
//   4. Layered rate limits per network prefix and per mailbox.
//   5. Everything else is *recorded, not enforced*: risk flags go in the row
//      for a human to review. Nothing is silently rejected, because dropping a
//      real resident is worse than counting a fake one and then removing it.
//
// The threat that actually matters here is not padding but poisoning — one
// forged signature in a neighbour's name discredits the whole list. That is
// what the confirmation step and the withdrawal link are for.

const PETITION_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Keyed hashes. Without a secret the "privacy-preserving" keys would be plain
// hashes of a small, guessable space (every email in the county), so the route
// refuses to accept signatures at all rather than pretending.
const petitionSecret = () => process.env.PETITION_SECRET || '';
const keyed = (namespace, value) => createHmac('sha256', petitionSecret()).update(`${namespace}:${value}`).digest('hex');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

// Behind Caddy the socket address is always the proxy, so the real client is
// the last hop in X-Forwarded-For — but only when the deployment says it is
// actually behind a proxy. Trusting the header unconditionally would let any
// caller pick their own rate-limit bucket.
function clientIp(request) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = (request.headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean);
    if (forwarded.length) return forwarded[forwarded.length - 1];
  }
  return request.socket.remoteAddress || '';
}

// A /24 (v4) or /48 (v6) rather than the address itself: enough to notice one
// source submitting in bulk, not enough to be a record of who visited. An
// apartment block, a library and a phone carrier all share addresses, so the
// prefix is a rate-limit bucket and a review signal — never a rejection on its
// own.
function ipPrefix(ip) {
  const address = String(ip).replace(/^::ffff:/, '');
  if (address.includes(':')) return address.split(':').slice(0, 3).join(':');
  const parts = address.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : address;
}

// Cloudflare Turnstile, checked server-side — never trusted from the browser.
// The widget token is single-use and expires after five minutes, so a replayed
// one fails here even though it looked fine when the widget issued it.
//
// Four answers, and the difference between them is the difference between
// refusing a bot and refusing a neighbour:
//
//   'pass'        siteverify returned success === true.
//   'fail'        a token was presented and Cloudflare rejected it. Refused.
//   'expired'     the token timed out or was spent twice. Refused, but the
//                 signer is told to press the button again, not that they
//                 failed a test.
//   'unavailable' no token arrived, or siteverify could not be reached. Nobody
//                 can tell a blocked widget from an omitted field here, so this
//                 is recorded rather than refused — see the gate below.
//   'skipped'     no TURNSTILE_SECRET, so the check is not configured on this
//                 deployment (local dev and CI). Recorded, so its absence is
//                 visible in review rather than looking like a pass.
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET || '';
  if (!secret) return 'skipped';
  if (!token) return 'unavailable';
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({secret, response: token, ...(ip ? {remoteip: ip} : {})}),
      signal: AbortSignal.timeout(8000),
    });
    const outcome = await result.json();
    if (outcome.success === true) return 'pass';
    const codes = outcome['error-codes'] || [];
    // 'invalid-input-secret' here means TURNSTILE_SECRET does not match the
    // widget; that is a deployment fault, not a bot, and it would otherwise
    // look identical to a site full of failed challenges.
    console.error(`Turnstile rejected a submission: ${codes.join(', ') || 'no error codes'}`);
    // A token that expired on an open form, or that a double-submit spent
    // twice. Neither is a bot, and both are fixed by trying again — so they are
    // worth telling apart from a challenge that was actually failed.
    return codes.includes('timeout-or-duplicate') ? 'expired' : 'fail';
  } catch (error) {
    // Our own network, not the signer's doing. Refusing here would turn a
    // Cloudflare outage into a petition that quietly stops accepting anyone.
    console.error(`Turnstile siteverify unreachable: ${error.message}`);
    return 'unavailable';
  }
}

// Mail. Resend is one fetch call, so no dependency and no SMTP client. With no
// key configured the link is logged instead, which is what makes the whole flow
// exercisable locally without sending anything to anybody.
async function sendMail({to, subject, text}) {
  const key = process.env.RESEND_API_KEY || '';
  // Must be an address on a domain verified in Resend, or the API refuses it.
  const from = process.env.MAIL_FROM || 'Sumter Field Desk <petition@scc4t.com>';
  // Someone whose name was signed without their consent needs a human to write
  // to, and "reply" is the only route they will think of. Unset means replies
  // go to the from address, which nobody may be reading.
  const replyTo = process.env.MAIL_REPLY_TO || '';
  if (!key) {
    console.log(`[mail: no RESEND_API_KEY, not sent]\n  to: ${to}\n  subject: ${subject}\n${text}\n`);
    return true;
  }
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from, to, subject, text, ...(replyTo ? {reply_to: replyTo} : {})}),
      signal: AbortSignal.timeout(15_000),
    });
    // Resend's body names the cause — unverified domain, bad key, invalid from
    // — and without it a failure is indistinguishable from a bad address.
    if (!result.ok) console.error(`Mail send failed (${result.status}): ${await result.text()}`);
    return result.ok;
  } catch (error) {
    console.error(`Mail send failed: ${error.message}`);
    return false;
  }
}

// Absolute origins for links. The confirmation link has to point at the API
// (that is where the route lives); everything else points at the public site.
const apiOrigin = (request) => process.env.API_ORIGIN
  || `${request.headers['x-forwarded-proto'] || 'http'}://${request.headers.host}`;
const siteOrigin = () => process.env.PUBLIC_ORIGIN || 'https://scc4t.com';

// Confirmation and withdrawal land on the API host, not the app, so they are
// plain server-rendered pages rather than an app route.
function sendPage(response, status, {heading, body, action = ''}) {
  response.writeHead(status, {'Content-Type': 'text/html; charset=utf-8'});
  response.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" /><title>${escapeHtml(heading)} — Sumter Field Desk</title>
<style>
  body{margin:0;padding:9vh 20px;background:#eee8d9;color:#171a18;font:18px/1.5 Georgia,serif}
  main{max-width:620px;margin:auto;padding:36px;border:1px solid #171a18;background:#f8f4e9}
  p.eyebrow{margin:0 0 22px;color:#67695f;font:500 10px/1.2 "Courier New",monospace;letter-spacing:.13em}
  h1{margin:0 0 18px;font-size:38px;line-height:1.05;letter-spacing:-.03em}
  a.back,button{display:inline-block;margin-top:26px;padding:13px 20px;border:1px solid #171a18;background:#171a18;
    color:#f8f4e9;font:500 11px/1 "Courier New",monospace;text-decoration:none;cursor:pointer}
</style></head>
<body><main><p class="eyebrow">SUMTER FIELD DESK · PETITION</p><h1>${escapeHtml(heading)}</h1>${body}
${action || `<a class="back" href="${siteOrigin()}/petition/">Back to the petition</a>`}</main></body></html>`);
}

const tierKeys = TIERS.map((tier) => tier.key);

// Public totals. Only verified rows are counted, and they are reported by
// locality and by how they were collected rather than merged into one number:
// 400 confirmed Sumter County residents is a stronger claim than 10,000
// signatures of unstated origin, and merging the two invites the rebuttal.
async function petitionCounts(database, petitionId) {
  const {rows} = await database.query(
    `SELECT status, tier, source, count(*)::int AS total
       FROM petition_signatures WHERE petition_id = $1 GROUP BY 1, 2, 3`, [petitionId]);
  const counts = {verified: 0, pending: 0, paper: 0, online: 0, ...Object.fromEntries(tierKeys.map((key) => [key, 0]))};
  for (const row of rows) {
    if (row.status === 'pending') counts.pending += row.total;
    if (row.status !== 'verified') continue;
    counts.verified += row.total;
    counts[row.tier] += row.total;
    counts[row.source === 'paper' ? 'paper' : 'online'] += row.total;
  }
  return counts;
}

// Public, but a signed-in organizer gets one extra field so the page can show
// the paper-entry and audit tools without a second round trip. A bad or absent
// token is not an error here — it just means "not an organizer".
async function handlePetitionRead(request, response, petition) {
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }
  let organizer = false;
  if (request.headers.authorization && authConfig.audience) {
    try { organizer = isAdmin(await verifyToken(request)); } catch { /* signed out or stale token */ }
  }
  const counts = await petitionCounts(database, petition.id);
  // Attribution is opt-in: a signature always counts, but the name only appears
  // here if the signer asked for it to.
  const {rows} = await database.query(
    `SELECT name, city, state, comment, verified_at, source FROM petition_signatures
      WHERE petition_id = $1 AND status = 'verified' AND public_display
      ORDER BY verified_at DESC NULLS LAST LIMIT 200`, [petition.id]);
  sendJson(response, 200, {
    counts,
    organizer,
    signatures: rows.map((row) => ({
      name: row.name, city: row.city, state: row.state,
      comment: row.comment || '', signedAt: row.verified_at, source: row.source,
    })),
  });
}

async function handlePetitionSign(request, response, petition) {
  // Shape first, so a malformed submission gets a useful message whether or not
  // the database, Turnstile or mail is configured yet.
  const input = await readJsonBody(request);
  const checked = validateSignature(input);
  if (!checked.ok) { sendJson(response, 400, {error: checked.error}); return; }
  const signature = checked.value;

  const ip = clientIp(request);
  const prefix = ipPrefix(ip);

  // Rate limit before the challenge: it is a local map lookup, and a flood
  // should not turn into one outbound siteverify call per request.
  //
  // Generous, because these buckets are shared: a library, a workplace, a
  // church hall or a phone carrier can put a whole neighbourhood behind one
  // prefix, and a household signing together must not trip it. The email
  // confirmation is what actually gates the count; this only blunts a flood.
  // The message says what to do instead rather than just refusing.
  if (throttled(`petition-ip:${prefix}`, 8, 10 * 60_000) || throttled(`petition-ip-day:${prefix}`, 60, 24 * 60 * 60_000)) {
    sendJson(response, 429, {error: 'Several signatures have already come from this connection recently. If you are on shared wifi, please try again in a few minutes or sign the paper copy in person.'});
    return;
  }

  // The gate, ahead of the database and the pool it would open. A token that
  // Cloudflare actively rejected is refused here and never stored.
  const turnstile = await verifyTurnstile(input.turnstileToken, ip);
  if (turnstile === 'expired') {
    sendJson(response, 403, {error: 'The anti-bot check expired before this reached us. Press the button once more — the check has already restarted.'});
    return;
  }
  if (turnstile === 'fail') {
    sendJson(response, 403, {error: 'The anti-bot check did not pass. Reload the page and try again, or sign the paper copy in person.'});
    return;
  }

  // No token at all is the one case that is not a verdict. It is a browser that
  // blocks challenges.cloudflare.com, a network that dropped the script, a
  // Cloudflare outage — or a bot that simply left the field out. Refusing it
  // meant a resident whose browser is stricter than most could not sign at all,
  // on a petition where every name is the point.
  //
  // So these are taken and flagged rather than refused. What still stands
  // behind them: the signature counts for nothing until the emailed link is
  // opened, the honeypot and duplicate checks run either way, and a reviewer
  // sees 'turnstile-unavailable' on the row. TURNSTILE_REQUIRED=1 restores the
  // hard refusal if this is ever abused.
  if (turnstile === 'unavailable') {
    if (process.env.TURNSTILE_REQUIRED === '1') {
      sendJson(response, 403, {error: 'The anti-bot check did not pass. Reload the page and try again, or sign the paper copy in person.'});
      return;
    }
    // Much tighter than the ordinary bucket, because this path has no proof of
    // a human behind it. A blocked browser signing once is normal; the same
    // connection doing it repeatedly is not.
    if (throttled(`petition-unverified:${prefix}`, 3, 60 * 60_000)) {
      sendJson(response, 429, {error: 'The anti-bot check could not run, and several signatures have already come from this connection. Please try again later, or sign the paper copy in person.'});
      return;
    }
  }

  if (!petitionSecret()) { sendJson(response, 501, {error: 'Petition signing is not configured on this server.'}); return; }
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }

  const emailKey = keyed('email', normalizeEmail(signature.email));

  // Recorded, not enforced. A reviewer sees these; the signer is never silently
  // dropped for tripping one.
  const flags = [];
  if (turnstile === 'skipped') flags.push('turnstile-skipped');
  if (turnstile === 'unavailable') flags.push('turnstile-unavailable');
  if (DISPOSABLE_DOMAINS.has(signature.email.split('@')[1])) flags.push('disposable-domain');
  if (!signature.name.includes(' ')) flags.push('single-word-name');
  // A hidden field no human can see. A bot that fills every input trips it.
  if (String(input.website || '').trim()) flags.push('honeypot');

  const identityKey = keyed('identity', normalizeIdentity(signature.name, signature.postalCode));
  const {rows: sameIdentity} = await database.query(
    'SELECT 1 FROM petition_signatures WHERE petition_id = $1 AND identity_key = $2 LIMIT 1', [petition.id, identityKey]);
  if (sameIdentity.length) flags.push('duplicate-identity');

  // The one flag that is acted on: an obvious bot is recorded as rejected. It
  // still gets the same answer as everybody else, so the form cannot be used to
  // find out which submissions were caught.
  const status = flags.includes('honeypot') ? 'rejected' : 'pending';
  const token = newToken();
  const withdrawToken = newToken();

  // ON CONFLICT DO NOTHING is what makes one mailbox one signature. Checking
  // for a duplicate in JavaScript first would lose the race between two
  // concurrent submissions of the same address.
  const {rows: inserted} = await database.query(
    `INSERT INTO petition_signatures
       (petition_id, status, name, email, city, state, postal_code, comment, public_display, tier,
        source, email_key, identity_key, ip_prefix_hash, user_agent_hash, risk_flags, turnstile,
        verify_token_hash, verify_expires_at, withdraw_token_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'web', $11, $12, $13, $14, $15, $16, $17, $18, $19)
     ON CONFLICT (petition_id, email_key) DO NOTHING
     RETURNING id`,
    [petition.id, status, signature.name, signature.email, signature.city, signature.state,
      signature.postalCode, signature.comment || null, signature.publicDisplay, signature.tier,
      emailKey, identityKey, keyed('ip', prefix), keyed('ua', request.headers['user-agent'] || ''),
      flags, turnstile, sha256(token), new Date(Date.now() + VERIFY_WINDOW_MS), sha256(withdrawToken)]);

  let sendTo = null;
  if (inserted.length && status === 'pending') {
    sendTo = {token, withdrawToken};
  } else if (!inserted.length) {
    // Address already on file. A pending or withdrawn signature can be
    // confirmed again — the link only ever reaches the mailbox that owns the
    // address — but a verified one is left alone and no mail goes out.
    const {rows: existing} = await database.query(
      'SELECT id, status FROM petition_signatures WHERE petition_id = $1 AND email_key = $2', [petition.id, emailKey]);
    const row = existing[0];
    const resendable = row && (row.status === 'pending' || row.status === 'withdrawn');
    if (resendable && !throttled(`petition-mail:${emailKey}`, 2, 60 * 60_000)) {
      await database.query(
        `UPDATE petition_signatures
            SET status = 'pending', verify_token_hash = $2, verify_expires_at = $3, withdraw_token_hash = $4,
                withdrawn_at = NULL
          WHERE id = $1`,
        [row.id, sha256(token), new Date(Date.now() + VERIFY_WINDOW_MS), sha256(withdrawToken)]);
      sendTo = {token, withdrawToken};
    }
  }

  let sent = true;
  if (sendTo) {
    const confirmUrl = `${apiOrigin(request)}/api/petition/verify?token=${sendTo.token}`;
    sent = await sendMail({
      to: signature.email,
      subject: 'Confirm your signature — data center moratorium petition',
      text: [
        `${signature.name},`,
        '',
        'You (or someone using this address) asked to sign the petition asking the Sumter County Board of Commissioners and the Mayor and City Council of Americus to adopt the joint 18-month data center moratorium.',
        '',
        'It is one signature to both bodies — there is no second petition to sign.',
        '',
        'Your signature is NOT counted until you open this link:',
        confirmUrl,
        '',
        'The link works once and expires in 24 hours.',
        '',
        'If you did not sign, ignore this message — nothing has been counted and nothing else will be sent.',
        '',
        'You can remove your signature at any time here:',
        `${apiOrigin(request)}/api/petition/withdraw?token=${sendTo.withdrawToken}`,
        '',
        `How signatures are verified: ${siteOrigin()}/doc/petition/`,
        `The petition: ${siteOrigin()}/petition/`,
      ].join('\n'),
    });
  }

  // A send failure is the server's fault, not a fact about the address, so
  // saying so leaks nothing — and "check your email" for a mail that never left
  // would leave the signer waiting on a link that is not coming. The row stays
  // pending, so signing again resends rather than duplicating.
  if (!sent) {
    sendJson(response, 502, {error: 'We could not send the confirmation email just now. Please try again in a few minutes — your signature has not been counted yet.'});
    return;
  }

  // Deliberately identical for a new address, a repeat, an address already
  // confirmed, and a submission caught by the honeypot. Otherwise the form
  // becomes a way to ask "has this person signed?" about anyone in town.
  sendJson(response, 202, {
    ok: true,
    message: 'Check your email and open the confirmation link. Your signature is not counted until you do. If this address has already signed, no second signature is added.',
  });
}

async function handlePetitionVerify(request, response, url) {
  const database = await getPool();
  if (!database) { sendPage(response, 501, {heading: 'Not available yet', body: '<p>The petition database is not configured on this server.</p>'}); return; }
  const token = url.searchParams.get('token') || '';
  if (!token) { sendPage(response, 400, {heading: 'Link incomplete', body: '<p>That confirmation link is missing its token. Copy the whole link out of the email.</p>'}); return; }

  // Single-use and atomic: the token is cleared in the same statement that
  // flips the status, so a replayed link — or two clicks racing each other —
  // updates nothing the second time.
  const {rows} = await database.query(
    `UPDATE petition_signatures
        SET status = 'verified', verified_at = now(), verify_token_hash = NULL
      WHERE verify_token_hash = $1 AND status = 'pending' AND verify_expires_at > now()
      RETURNING id, name, petition_id, tier`, [sha256(token)]);

  if (!rows.length) {
    // Either already used, expired, or never valid. Say which is plausible
    // without confirming that any particular address exists.
    sendPage(response, 200, {
      heading: 'Nothing to confirm',
      body: '<p>This link has already been used, or it expired. Confirmation links last 24 hours.</p><p>If your signature is not on the petition, sign again and open the new link when it arrives.</p>',
    });
    return;
  }

  const row = rows[0];
  const local = row.tier === 'sumter';
  sendPage(response, 200, {
    heading: 'Signature confirmed',
    body: `<p>Thank you, ${escapeHtml(row.name.split(' ')[0])}. Your signature is now counted${local ? ' as a verified Sumter County resident' : ''}.</p>
      <p>Keep the email — it has a link that removes your signature at any time.</p>
      <p>The one thing that helps more than signing is getting a neighbour to sign, and showing up when the council meets.</p>`,
  });
}

// Withdrawal is a POST behind a confirmation button, not a bare link: mail
// clients and security scanners follow links in email automatically, and a GET
// that removes a signature would let a scanner quietly undo one.
async function handlePetitionWithdraw(request, response, url) {
  const database = await getPool();
  if (!database) { sendPage(response, 501, {heading: 'Not available yet', body: '<p>The petition database is not configured on this server.</p>'}); return; }

  if (request.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    sendPage(response, 200, {
      heading: 'Remove your signature?',
      body: '<p>This removes your signature from the petition and from every published total. You can sign again later if you change your mind.</p>',
      action: `<form method="POST" action="/api/petition/withdraw"><input type="hidden" name="token" value="${escapeHtml(token)}" /><button type="submit">Yes, remove my signature</button></form>`,
    });
    return;
  }

  const body = await new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; if (raw.length > 4000) request.destroy(); });
    request.on('end', () => resolve(raw));
    request.on('error', () => resolve(''));
  });
  const token = new URLSearchParams(body).get('token') || '';
  const {rows} = await database.query(
    `UPDATE petition_signatures
        SET status = 'withdrawn', withdrawn_at = now(), withdraw_token_hash = NULL, verify_token_hash = NULL
      WHERE withdraw_token_hash = $1 AND status IN ('pending', 'verified')
      RETURNING id`, [sha256(token)]);
  sendPage(response, 200, rows.length
    ? {heading: 'Signature removed', body: '<p>Your signature has been removed and is no longer in any published total.</p>'}
    : {heading: 'Nothing to remove', body: '<p>That link has already been used, or the signature it pointed at is already gone.</p>'});
}

// Paper signatures, keyed in by an organizer from the sheets at the in-person
// signing table. Verified on the spot by the person who watched it signed, so
// there is no email step — but recorded as source 'paper' and reported on its
// own line, because "we watched them sign" and "they clicked a link in their
// own mailbox" are different kinds of evidence and the totals should say so.
async function handlePetitionPaper(request, response, petition, claims) {
  if (!isAdmin(claims)) { sendJson(response, 403, {error: 'Organizers only'}); return; }
  if (!petitionSecret()) { sendJson(response, 501, {error: 'Petition signing is not configured on this server.'}); return; }
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }

  const input = await readJsonBody(request);
  // A paper sheet may not have an email on it. Synthesize a per-signature key
  // so the unique index still holds, and record the absence honestly.
  const hasEmail = Boolean(String(input.email || '').trim());
  const checked = validateSignature({...input, consent: true, email: hasEmail ? input.email : 'paper@invalid.local'});
  if (!checked.ok) { sendJson(response, 400, {error: checked.error}); return; }
  const signature = checked.value;

  const emailKey = hasEmail ? keyed('email', normalizeEmail(signature.email)) : keyed('paper', newToken());
  const identityKey = keyed('identity', normalizeIdentity(signature.name, signature.postalCode));
  const {rows} = await database.query(
    `INSERT INTO petition_signatures
       (petition_id, status, name, email, city, state, postal_code, comment, public_display, tier,
        source, entered_by, email_key, identity_key, risk_flags, turnstile, verified_at)
     VALUES ($1, 'verified', $2, $3, $4, $5, $6, $7, $8, $9, 'paper', $10, $11, $12, $13, 'skipped', now())
     ON CONFLICT (petition_id, email_key) DO NOTHING
     RETURNING id`,
    [petition.id, signature.name, hasEmail ? signature.email : '', signature.city, signature.state,
      signature.postalCode, signature.comment || null, signature.publicDisplay, signature.tier,
      claims.sub, emailKey, identityKey, hasEmail ? [] : ['paper-no-email']]);

  if (!rows.length) { sendJson(response, 409, {error: 'That email address has already signed this petition.'}); return; }
  sendJson(response, 201, {added: true, counts: await petitionCounts(database, petition.id)});
}

// The canonical export the audit chain hashes: verified signatures only, in a
// stable order, with no fields that would turn a leaked snapshot into a mailing
// list. The organizer-only CSV below is the one with contact details in it.
async function canonicalExport(database, petitionId) {
  const {rows} = await database.query(
    `SELECT id, email_key, tier, source, verified_at FROM petition_signatures
      WHERE petition_id = $1 AND status = 'verified' ORDER BY id`, [petitionId]);
  const text = rows.map((row) =>
    [row.id, row.email_key, row.tier, row.source, new Date(row.verified_at).toISOString()].join(',')).join('\n');
  return {rows, text, sha256: sha256(text)};
}

async function handlePetitionSnapshot(request, response, petition, claims) {
  if (!isAdmin(claims)) { sendJson(response, 403, {error: 'Organizers only'}); return; }
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }
  const [counts, snapshot] = await Promise.all([
    petitionCounts(database, petition.id), canonicalExport(database, petition.id)]);
  const {rows: previous} = await database.query(
    'SELECT sha256 FROM petition_snapshots WHERE petition_id = $1 ORDER BY taken_at DESC LIMIT 1', [petition.id]);
  const {rows} = await database.query(
    `INSERT INTO petition_snapshots (petition_id, taken_by, counts, row_count, sha256, previous_sha256)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, taken_at, sha256`,
    [petition.id, claims.sub, JSON.stringify(counts), snapshot.rows.length, snapshot.sha256, previous[0]?.sha256 || null]);
  sendJson(response, 201, {snapshot: rows[0], counts});
}

// Public: the audit chain itself. Anyone can check that the count published
// last week still hashes to what the site said it did.
async function handlePetitionSnapshots(response, petition) {
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }
  const {rows} = await database.query(
    `SELECT taken_at, counts, row_count, sha256, previous_sha256 FROM petition_snapshots
      WHERE petition_id = $1 ORDER BY taken_at DESC LIMIT 100`, [petition.id]);
  sendJson(response, 200, {snapshots: rows});
}

async function handlePetitionExport(response, petition, claims) {
  if (!isAdmin(claims)) { sendJson(response, 403, {error: 'Organizers only'}); return; }
  const database = await getPool();
  if (!database) { sendJson(response, 501, {error: 'Database not configured'}); return; }
  const {rows} = await database.query(
    `SELECT id, status, name, email, city, state, postal_code, tier, source, comment, public_display,
            risk_flags, turnstile, created_at, verified_at, withdrawn_at
       FROM petition_signatures WHERE petition_id = $1 ORDER BY id`, [petition.id]);
  const cell = (value) => {
    const text = value === null || value === undefined ? ''
      : Array.isArray(value) ? value.join(' ')
      : value instanceof Date ? value.toISOString() : String(value);
    // Leading =, +, - or @ makes a spreadsheet treat a name as a formula.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ['id', 'status', 'name', 'email', 'city', 'state', 'postal_code', 'tier', 'source',
    'comment', 'public_display', 'risk_flags', 'turnstile', 'created_at', 'verified_at', 'withdrawn_at'];
  const csv = [header.join(','), ...rows.map((row) => header.map((key) => cell(row[key])).join(','))].join('\n');
  response.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${petition.id}-signatures.csv"`,
  });
  response.end(csv);
}

// Routes reachable without signing in are matched here, before the auth gate in
// handleApi. Organizer-only sub-routes verify a token themselves.
async function handlePetition(pathname, request, response, url) {
  const rest = pathname.slice('/api/petition/'.length);

  if (rest === 'verify') {
    if (request.method !== 'GET') { sendJson(response, 405, {error: 'Method not allowed'}); return; }
    await handlePetitionVerify(request, response, url);
    return;
  }
  if (rest === 'withdraw') {
    if (!['GET', 'POST'].includes(request.method)) { sendJson(response, 405, {error: 'Method not allowed'}); return; }
    await handlePetitionWithdraw(request, response, url);
    return;
  }

  const [id, action, ...extra] = rest.split('/');
  if (extra.length || !PETITION_ID_PATTERN.test(id)) { sendJson(response, 404, {error: 'Unknown petition'}); return; }
  const petition = findPetition(id);
  if (!petition) { sendJson(response, 404, {error: 'Unknown petition'}); return; }

  if (!action && request.method === 'GET') { await handlePetitionRead(request, response, petition); return; }
  if (action === 'sign' && request.method === 'POST') { await handlePetitionSign(request, response, petition); return; }
  if (action === 'snapshots' && request.method === 'GET') { await handlePetitionSnapshots(response, petition); return; }

  const organizerRoutes = {paper: 'POST', snapshot: 'POST', 'export.csv': 'GET'};
  if (organizerRoutes[action]) {
    if (organizerRoutes[action] !== request.method) { sendJson(response, 405, {error: 'Method not allowed'}); return; }
    if (!authConfig.audience) { sendJson(response, 501, {error: 'Set authConfig.audience to enable organizer routes.'}); return; }
    let claims;
    try { claims = await verifyToken(request); }
    catch (error) { sendJson(response, 401, {error: error.message}); return; }
    if (action === 'paper') { await handlePetitionPaper(request, response, petition, claims); return; }
    if (action === 'snapshot') { await handlePetitionSnapshot(request, response, petition, claims); return; }
    await handlePetitionExport(response, petition, claims);
    return;
  }

  sendJson(response, 404, {error: 'Unknown petition route'});
}

// --- Server-side copy of the county GIS layers -----------------------------
// One stored copy serves every reader, so the county's ArcGIS service sees a
// handful of queries a day instead of a fresh set per visitor — and a reader
// arriving during an outage gets a map instead of a blank one, which a
// browser-only cache could never do for a first-time visitor.
//
// Public on purpose (see the note above handlePetition): the layers are public
// record, and the map is the reason anyone signs in at all. What keeps a public
// cache from being an open proxy is that the route accepts a short id from
// GIS_SOURCES and builds the upstream URL itself — no caller-supplied URL ever
// reaches fetch().
const gzip = promisify(gzipCb);
const gunzip = promisify(gunzipCb);

const GIS_TTL_MS = 24 * 60 * 60 * 1000;
const GIS_TIMEOUT_MS = 45_000;

async function fetchGisUpstream(id) {
  const source = GIS_SOURCES[id];
  const [target, init] = source.overpass
    ? [OVERPASS, {method: 'POST', body: new URLSearchParams({data: overpassQuery(source.overpass)})}]
    : [arcgisUrl(source), {}];

  const response = await fetch(target, {...init, signal: AbortSignal.timeout(GIS_TIMEOUT_MS)});
  if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}`);
  const text = await response.text();

  let body;
  try { body = JSON.parse(text); } catch { throw new Error('upstream did not return JSON'); }
  // ArcGIS reports a failed query as HTTP 200 with an error in the body, so
  // status alone is not enough to decide this is worth storing.
  const problem = gisPayloadError(source, body);
  if (problem) throw new Error(problem);

  return {text, count: (body.features || body.elements || []).length};
}

// Only ever called after gisPayloadError() passed, so a stored row is always a
// real answer. A failed refresh leaves the previous good copy in place and is
// recorded beside it.
async function storeGisLayer(database, id, {text, count}) {
  const payload = await gzip(Buffer.from(text));
  const {rows} = await database.query(
    `INSERT INTO gis_cache (layer_id, payload, byte_size, feature_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (layer_id) DO UPDATE SET
       payload = EXCLUDED.payload, byte_size = EXCLUDED.byte_size,
       feature_count = EXCLUDED.feature_count, fetched_at = now(),
       last_error = NULL, last_error_at = NULL, error_count = 0
     RETURNING fetched_at, feature_count`,
    [id, payload, Buffer.byteLength(text), count]);
  return {payload, fetchedAt: rows[0].fetched_at, count: rows[0].feature_count};
}

// Deliberately an UPDATE, not an upsert: a layer that has never been fetched
// gets no row at all, so an outage can never leave an empty payload sitting
// where a good copy is expected.
const noteGisFailure = (database, id, message) => database.query(
  `UPDATE gis_cache SET last_error = $2, last_error_at = now(), error_count = error_count + 1
   WHERE layer_id = $1`, [id, String(message).slice(0, 500)]).catch(() => {});

// Thirteen layers refreshing at once, times every reader who arrives after the
// day is up, would be exactly the stampede this table exists to prevent.
const gisRefreshing = new Map();
function refreshGisLayer(database, id) {
  const running = gisRefreshing.get(id);
  if (running) return running;
  const task = (async () => {
    try {
      return await storeGisLayer(database, id, await fetchGisUpstream(id));
    } catch (error) {
      await noteGisFailure(database, id, error.message);
      throw error;
    } finally {
      gisRefreshing.delete(id);
    }
  })();
  gisRefreshing.set(id, task);
  return task;
}

// Stored gzipped, so a browser that accepts gzip gets the bytes untouched.
async function sendGisPayload(request, response, {payload, fetchedAt, count, state}) {
  const acceptsGzip = /\bgzip\b/.test(request.headers['accept-encoding'] || '');
  const body = acceptsGzip ? payload : await gunzip(payload);
  const age = Date.now() - new Date(fetchedAt).getTime();
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    ...(acceptsGzip ? {'Content-Encoding': 'gzip'} : {}),
    // A shared copy that changes at most daily; the age headers let the map
    // tell the reader how old what they are looking at actually is.
    'Cache-Control': 'public, max-age=1800',
    'X-Gis-Fetched-At': new Date(fetchedAt).toISOString(),
    'X-Gis-Age-Ms': String(Math.max(0, age)),
    'X-Gis-State': state,
    ...(count == null ? {} : {'X-Gis-Feature-Count': String(count)}),
  });
  response.end(body);
}

async function handleGis(request, response, url) {
  if (request.method !== 'GET') { sendJson(response, 405, {error: 'Method not allowed'}); return; }

  const id = url.searchParams.get('layer') || '';
  // hasOwn, not `in`: "constructor" and friends are not layers.
  if (!Object.hasOwn(GIS_SOURCES, id)) { sendJson(response, 404, {error: 'Unknown layer'}); return; }

  // A map load asks for thirteen layers, and a household or library shares one
  // prefix, so this is set well above normal use — it is here to stop a script
  // hammering the route, not to ration readers.
  if (throttled(`gis:${ipPrefix(clientIp(request))}`, 120, 60_000)) {
    sendJson(response, 429, {error: 'Too many requests'});
    return;
  }

  const database = await getPool();
  // No database configured (a dev box, or a fresh VPS before migrations). The
  // client falls back to calling the county service directly, so say so plainly
  // rather than pretending the layer does not exist.
  if (!database) { sendJson(response, 503, {error: 'GIS cache not configured'}); return; }

  const {rows} = await database.query(
    `SELECT payload, feature_count, fetched_at FROM gis_cache
     WHERE layer_id = $1 AND byte_size > 0`, [id]);
  const row = rows[0];

  if (row) {
    const age = Date.now() - new Date(row.fetched_at).getTime();
    const fresh = age < GIS_TTL_MS;
    // Stale: answer from the stored copy immediately and refresh behind the
    // response. Nobody waits on the county's server, and if it is down the
    // refresh simply fails and the copy stays.
    if (!fresh) refreshGisLayer(database, id).catch(() => {});
    await sendGisPayload(request, response, {
      payload: row.payload, fetchedAt: row.fetched_at, count: row.feature_count,
      state: fresh ? 'fresh' : 'stale-refreshing',
    });
    return;
  }

  // Nothing stored yet: this reader pays for the first fetch.
  try {
    const stored = await refreshGisLayer(database, id);
    await sendGisPayload(request, response, {...stored, state: 'fetched'});
  } catch (error) {
    sendJson(response, 503, {error: `Upstream unavailable: ${error.message}`, layer: id});
  }
}

async function handleApi(pathname, request, response, url) {
  if (pathname === '/api/health') { sendJson(response, 200, {ok: true}); return; }
  // Public on purpose: see the note above handlePetition.
  if (pathname.startsWith('/api/petition/')) { await handlePetition(pathname, request, response, url); return; }
  // Public on purpose: see the note above handleGis.
  if (pathname === '/api/gis') { await handleGis(request, response, url); return; }
  if (!authConfig.audience) { sendJson(response, 501, {error: 'Set authConfig.audience (an Auth0 API identifier) to enable API routes.'}); return; }
  let claims;
  try { claims = await verifyToken(request); }
  catch (error) { sendJson(response, 401, {error: error.message}); return; }
  if (pathname === '/api/me') { sendJson(response, 200, {userId: claims.sub, claims}); return; }
  if (pathname === '/api/survey/stance') { await handleSurveyStance(request, response, claims); return; }
  if (pathname === '/api/board' || pathname.startsWith('/api/board/')) { await handleBoard(pathname, request, response, claims); return; }
  sendJson(response, 404, {error: 'Unknown API route'});
}

// Public document roots. Everything else under the project directory —
// server.env, deploy/, ignore/, .git — must stay unreachable.
const publicRoots = ['/website/', '/research/'];

// The built site puts website/ at the root: the browser asks for
// /client/app.js, not /website/client/app.js. In dev nothing is copied, so the
// same two directories are aliased into place — a prefix each rather than a
// file list, so adding a module does not mean remembering to come back here.
const aliasedDirs = ['/client/', '/assets/'];
// Two files the build also leaves at the root. index.html is the shell; sw.js
// has to be served from the root or the worker cannot claim scope '/'.
const aliasedFiles = ['/index.html', '/sw.js'];

// Client-side routes. In production the build writes a real HTML file at each
// of these paths; in dev the shell is served and the router resolves the path.
// Deliberately an explicit pattern rather than a catch-all, so an unknown path
// still 403s instead of leaking the shell for anything not on this list.
const spaRoute = /^\/(doc\/[a-z0-9-]+|community|map|petition|contact|meetings(\/[a-z0-9-]+)?|board(\/\d+)?)\/?$/;

// The one file whose "./" paths have to be rewritten before it is served.
const isShell = (file) => file.endsWith(join('website', 'index.html'));

// Resolves a request path to a file inside a public root, or null.
//
// Order matters: the path is decoded FIRST and normalized AFTER. Doing it the
// other way round lets "%2f" smuggle a "../" past the allowlist, because
// new URL() collapses real "../" segments but leaves the encoded form intact,
// and decoding afterwards recreates the traversal against an already-approved
// prefix.
function resolvePublicFile(rawPath) {
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return null; } // malformed %-escape
  if (decoded.includes('\0') || decoded.includes('\\')) return null;

  let requested = normalize(decoded === '/' || spaRoute.test(decoded) ? '/website/index.html' : decoded);
  if (aliasedFiles.includes(requested) || aliasedDirs.some((dir) => requested.startsWith(dir))) {
    requested = normalize(`/website${requested}`);
  }
  // Checked against the normalized path, so "/website/../ignore/x" has already
  // become "/ignore/x" and fails here.
  if (!publicRoots.some((root) => requested.startsWith(root))) return null;

  const file = normalize(join(projectDir, requested));
  if (file !== projectDir && !file.startsWith(projectDir + sep)) return null;
  return file;
}

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = url.pathname;
  const pathname = (() => { try { return decodeURIComponent(rawPath); } catch { return rawPath; } })();
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.origin;
    if (origin && (authConfig.corsOrigins || []).includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      // Without this the map, served from another origin, cannot read the age
      // of the copy it was handed and so cannot tell the reader.
      response.setHeader('Access-Control-Expose-Headers', 'X-Gis-Fetched-At, X-Gis-Age-Ms, X-Gis-State, X-Gis-Feature-Count');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    handleApi(pathname, request, response, url).catch((error) => sendJson(response, 500, {error: error.message}));
    return;
  }
  const file = resolvePublicFile(rawPath);
  if (!file) { response.writeHead(403); response.end('Forbidden'); return; }
  try {
    const resolved = statSync(file).isDirectory() ? join(file, 'index.html') : file;
    // The shell's "./client/…" paths are only correct at the site root, so a
    // route one or more directories deep — /petition/, /meetings/<id>/ —
    // resolved them against its own directory and 403'd on every module. The
    // build fixes this with the same substitution when it writes _site; doing
    // it here too is what makes the two environments serve identical URLs
    // rather than only claiming to.
    if (isShell(resolved)) {
      const html = readFileSync(resolved, 'utf8').replace(/(href|src)="\.\//g, '$1="/');
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(html);
      return;
    }
    response.writeHead(200, {'Content-Type': types[extname(resolved)] || 'application/octet-stream'});
    createReadStream(resolved).pipe(response);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, () => {
  console.log(`Sumter Field Desk: http://localhost:${port}/`);
});
