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
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const {default: pg} = await import('pg');
    // Managed instances require TLS but present provider CAs; verify-full
    // needs the CA bundled, so require-mode connections skip chain checks.
    const tls = /sslmode=(require|no-verify|verify-)/.test(process.env.DATABASE_URL);
    pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 5, ...(tls ? {ssl: {rejectUnauthorized: false}} : {})});
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

async function handleApi(pathname, request, response) {
  if (pathname === '/api/health') { sendJson(response, 200, {ok: true}); return; }
  if (!authConfig.audience) { sendJson(response, 501, {error: 'Set authConfig.audience (an Auth0 API identifier) to enable API routes.'}); return; }
  let claims;
  try { claims = await verifyToken(request); }
  catch (error) { sendJson(response, 401, {error: error.message}); return; }
  if (pathname === '/api/me') { sendJson(response, 200, {userId: claims.sub, claims}); return; }
  if (pathname === '/api/survey/stance') { await handleSurveyStance(request, response, claims); return; }
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
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    handleApi(pathname, request, response).catch((error) => sendJson(response, 500, {error: error.message}));
    return;
  }
  let requested = pathname === '/' ? '/website/index.html' : pathname;
  if (['/app.js', '/styles.css', '/auth.js', '/auth-config.js'].includes(requested)) requested = `/website${requested}`;
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
