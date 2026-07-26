import {createPublicKey, verify as verifySignature} from 'node:crypto';
import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {authConfig} from './auth-config.js';

const websiteDir = fileURLToPath(new URL('.', import.meta.url));
const projectDir = normalize(join(websiteDir, '..'));
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.geojson': 'application/geo+json; charset=utf-8',
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

// Small in-memory throttle. Not a substitute for real moderation, but it stops
// one signed-in account from flooding the board faster than anyone can respond.
const postTimes = new Map();
function throttled(userId, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const recent = (postTimes.get(userId) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) { postTimes.set(userId, recent); return true; }
  recent.push(now);
  postTimes.set(userId, recent);
  return false;
}

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

async function handleApi(pathname, request, response) {
  if (pathname === '/api/health') { sendJson(response, 200, {ok: true}); return; }
  if (!authConfig.audience) { sendJson(response, 501, {error: 'Set authConfig.audience (an Auth0 API identifier) to enable API routes.'}); return; }
  let claims;
  try { claims = await verifyToken(request); }
  catch (error) { sendJson(response, 401, {error: error.message}); return; }
  if (pathname === '/api/me') { sendJson(response, 200, {userId: claims.sub, claims}); return; }
  if (pathname === '/api/survey/stance') { await handleSurveyStance(request, response, claims); return; }
  if (pathname === '/api/board' || pathname.startsWith('/api/board/')) { await handleBoard(pathname, request, response, claims); return; }
  sendJson(response, 404, {error: 'Unknown API route'});
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.origin;
    if (origin && (authConfig.corsOrigins || []).includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    handleApi(pathname, request, response).catch((error) => sendJson(response, 500, {error: error.message}));
    return;
  }
  let requested = pathname === '/' ? '/website/index.html' : pathname;
  // The Pages artifact is flat, so the site asks for these at the root; locally
  // they live under website/.
  if (['/app.js', '/styles.css', '/auth.js', '/auth-config.js', '/map.js'].includes(requested)
    || requested.startsWith('/vendor/')) requested = `/website${requested}`;
  const file = normalize(join(projectDir, requested));
  if (!file.startsWith(projectDir) || !['/website/', '/research/'].some((allowed) => requested.startsWith(allowed))) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  try {
    const resolved = statSync(file).isDirectory() ? join(file, 'index.html') : file;
    response.writeHead(200, {'Content-Type': types[extname(resolved)] || 'application/octet-stream'});
    createReadStream(resolved).pipe(response);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, () => {
  console.log(`Sumter Field Desk: http://localhost:${port}/`);
});
