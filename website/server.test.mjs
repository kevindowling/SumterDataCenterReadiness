import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';

const port = 4590 + (process.pid % 200);
const base = `http://localhost:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new URL('server.mjs', import.meta.url))], {env: {...process.env, PORT: String(port)}});
  await new Promise((resolve, reject) => {
    server.stdout.on('data', resolve);
    server.on('error', reject);
    server.on('exit', (code) => reject(new Error(`Server exited early (${code})`)));
    setTimeout(() => reject(new Error('Server did not start within 5s')), 5000).unref();
  });
});

after(() => server?.kill());

test('serves the home page', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /Sumter Field Desk/);
});

test('serves site assets and research notes', async () => {
  for (const path of ['/app.js', '/auth.js', '/auth-config.js', '/styles.css', '/research/02-water.md']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} should be served`);
  }
});

test('refuses paths outside the public allowlist', async () => {
  for (const path of ['/server.mjs', '/package.json', '/../data-center-environmental-research-report.md']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, `${path} should be forbidden`);
  }
});

test('health endpoint responds without authentication', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true});
});

test('protected API refuses unauthenticated requests', async () => {
  const response = await fetch(`${base}/api/me`);
  // 501 until an Auth0 audience is configured, 401 (missing token) once it is.
  assert.ok([401, 501].includes(response.status), `unexpected status ${response.status}`);
});

test('allows CORS from allowlisted origins only', async () => {
  const allowed = await fetch(`${base}/api/health`, {headers: {Origin: 'http://localhost:4173'}});
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:4173');
  const denied = await fetch(`${base}/api/health`, {headers: {Origin: 'https://evil.example'}});
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const preflight = await fetch(`${base}/api/me`, {method: 'OPTIONS', headers: {Origin: 'http://localhost:4173'}});
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
});

test('survey route sits behind the auth gate', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${base}/api/survey/stance`, {method, ...(method === 'POST' ? {headers: {'Content-Type': 'application/json'}, body: '{"stance":"cautious"}'} : {})});
    // 501 until an Auth0 audience is configured, 401 (missing token) once it is.
    assert.ok([401, 501].includes(response.status), `${method} unexpected status ${response.status}`);
  }
});

test('message board sits behind the auth gate', async () => {
  const calls = [
    ['GET', '/api/board'],
    ['POST', '/api/board'],
    ['GET', '/api/board/1'],
    ['POST', '/api/board/1/reply'],
    ['DELETE', '/api/board/1'],
  ];
  for (const [method, path] of calls) {
    const response = await fetch(`${base}${path}`, {
      method,
      ...(method === 'POST' ? {headers: {'Content-Type': 'application/json'}, body: '{"title":"x","body":"y"}'} : {}),
    });
    // 501 until an Auth0 audience is configured, 401 (missing token) once it is.
    assert.ok([401, 501].includes(response.status), `${method} ${path} unexpected status ${response.status}`);
  }
});

test('board preflight advertises DELETE for moderation', async () => {
  const preflight = await fetch(`${base}/api/board/1`, {method: 'OPTIONS', headers: {Origin: 'http://localhost:4173'}});
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /DELETE/);
});

test('protected API refuses a forged token', async () => {
  const response = await fetch(`${base}/api/me`, {headers: {Authorization: 'Bearer aaa.bbb.ccc'}});
  assert.ok([401, 501].includes(response.status), `unexpected status ${response.status}`);
});
