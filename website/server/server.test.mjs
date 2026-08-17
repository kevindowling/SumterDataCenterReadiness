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
  for (const path of ['/client/app.js', '/client/auth.js', '/client/auth-config.js', '/client/content.js', '/assets/styles.css', '/research/02-water.md']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} should be served`);
  }
});

// Each note has a real URL now, so the dev server has to hand the shell to a
// deep link the same way the built site does. In production these are separate
// prerendered files; here one shell answers for all of them.
test('serves the shell at every client-side route', async () => {
  for (const path of ['/doc/records/', '/doc/records', '/doc/water/', '/community/', '/map/', '/board/', '/board/12']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} should serve the shell`);
    assert.match(await response.text(), /Sumter Field Desk/, `${path} should return the app shell`);
  }
});

// The route fallback must not become a way to read anything not on the
// allowlist: it matches an explicit pattern, so everything else still 403s.
test('the route fallback does not widen the allowlist', async () => {
  for (const path of ['/doc/', '/doc/records/extra', '/board/abc', '/server.mjs', '/doc/../server.mjs']) {
    const response = await fetch(`${base}${path}`);
    assert.notEqual(response.status, 200, `${path} must not be served`);
  }
});

test('refuses paths outside the public allowlist', async () => {
  for (const path of ['/server.mjs', '/package.json', '/../data-center-environmental-research-report.md']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, `${path} should be forbidden`);
  }
});

// Regression: percent-encoded separators must not smuggle a "../" past the
// public-root allowlist. new URL() collapses literal "../" but leaves "%2f"
// intact, so decoding before normalizing exposed every file under the project
// directory, including the deployed server.env.
test('refuses percent-encoded path traversal', async () => {
  const attacks = [
    '/website/..%2fserver.env',
    '/website/..%2fignore%2fSETUP.md',
    '/website/%2e%2e%2fignore%2fSETUP.md',
    '/website/..%2f.git%2fconfig',
    '/research/..%2fignore%2fSETUP.md',
    '/website/..%2f..%2f..%2fetc%2fpasswd',
    '/assets/..%2f..%2fserver.env',
    '/website/..%5cserver.env',
  ];
  for (const path of attacks) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, `${path} must be forbidden, got ${response.status}`);
  }
});

test('still serves legitimate assets after traversal hardening', async () => {
  for (const path of ['/', '/client/app.js', '/client/map.js', '/assets/vendor/leaflet/leaflet.js', '/research/README.md']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} should still be served`);
  }
});

test('serves the PWA assets with correct content types', async () => {
  const expected = {
    '/assets/manifest.webmanifest': /application\/manifest\+json/,
    '/sw.js': /text\/javascript/,
    '/client/install.js': /text\/javascript/,
    '/assets/favicon.svg': /image\/svg\+xml/,
    '/assets/icons/icon-192.png': /image\/png/,
    '/assets/icons/icon-512-maskable.png': /image\/png/,
    '/assets/icons/icon-180.png': /image\/png/,
  };
  for (const [path, type] of Object.entries(expected)) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} should be served`);
    assert.match(response.headers.get('content-type'), type, `${path} content type`);
  }
});

test('manifest declares installable icons', async () => {
  const manifest = await (await fetch(`${base}/assets/manifest.webmanifest`)).json();
  assert.ok(manifest.name && manifest.start_url && manifest.display === 'standalone');
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'needs 192 and 512 icons');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'needs a maskable icon');
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

// The petition is the one API surface that must answer a signed-out caller:
// requiring an account to sign would lose more real residents than it stops
// bots. These tests pin that door open, and pin shut the ones next to it.
test('petition read and sign routes are reachable without a token', async () => {
  const read = await fetch(`${base}/api/petition/moratorium`);
  // 501 without a database configured; 200 once there is one. Never 401.
  assert.ok([200, 501].includes(read.status), `unexpected status ${read.status}`);

  const sign = await fetch(`${base}/api/petition/moratorium/sign`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: 'Ann Lee', email: 'ann@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true}),
  });
  assert.ok([202, 501].includes(sign.status), `unexpected status ${sign.status}`);
});

// Shape is judged before anything else, so a malformed submission gets a usable
// message whether or not the database and mail are configured yet.
test('petition signing rejects malformed submissions', async () => {
  const cases = [
    [{name: 'A', email: 'ann@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true}, 'short name'],
    [{name: 'Ann Lee', email: 'not-an-email', city: 'Americus', state: 'GA', postalCode: '31709', consent: true}, 'bad email'],
    [{name: 'Ann Lee', email: 'ann@example.com', city: 'Americus', state: 'GA', postalCode: '317', consent: true}, 'short ZIP'],
    [{name: 'Ann Lee', email: 'ann@example.com', city: 'Americus', state: 'Georgia', postalCode: '31709', consent: true}, 'long state'],
    [{name: 'Ann Lee', email: 'ann@example.com', city: 'Americus', state: 'GA', postalCode: '31709'}, 'no consent'],
  ];
  for (const [body, label] of cases) {
    const response = await fetch(`${base}/api/petition/moratorium/sign`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400, `${label} should be rejected`);
  }
});

// The Turnstile gate, exercised against a server started with Cloudflare's
// published always-fail test secret. Robust offline too: if siteverify cannot
// be reached, verifyTurnstile fails closed and the answer is the same 403.
test('a failed Turnstile check refuses the signature', async () => {
  const gatePort = port + 1;
  const gate = spawn(process.execPath, [fileURLToPath(new URL('server.mjs', import.meta.url))], {
    // 2x...AA is Cloudflare's documented "always fails" test secret, not a real one.
    env: {...process.env, PORT: String(gatePort), TURNSTILE_SECRET: '2x0000000000000000000000000000000AA'},
  });
  try {
    await new Promise((resolve, reject) => {
      gate.stdout.on('data', resolve);
      gate.on('error', reject);
      setTimeout(() => reject(new Error('gate server did not start within 5s')), 5000).unref();
    });
    const response = await fetch(`http://localhost:${gatePort}/api/petition/moratorium/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: 'Gate Case', email: 'gate@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'}),
    });
    // 403 before the database is ever consulted, never 501 (no database) or 202.
    assert.equal(response.status, 403, 'a failed challenge must refuse the signature');
    assert.match((await response.json()).error, /anti-bot check/);
  } finally {
    gate.kill();
  }
});

// A token that sat too long on an open form, or that a double-click spent
// twice, is not a failed challenge, and telling a real signer they look like a
// bot is how the petition loses them. Refused either way, worded differently.
test('an expired Turnstile token is refused as expired, not as a failure', async () => {
  const gatePort = port + 2;
  const gate = spawn(process.execPath, [fileURLToPath(new URL('server.mjs', import.meta.url))], {
    // 3x...AA is Cloudflare's documented "token already spent" test secret.
    env: {...process.env, PORT: String(gatePort), TURNSTILE_SECRET: '3x0000000000000000000000000000000AA'},
  });
  try {
    await new Promise((resolve, reject) => {
      gate.stdout.on('data', resolve);
      gate.on('error', reject);
      setTimeout(() => reject(new Error('gate server did not start within 5s')), 5000).unref();
    });
    const response = await fetch(`http://localhost:${gatePort}/api/petition/moratorium/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: 'Spent Token', email: 'spent@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'}),
    });
    assert.equal(response.status, 403, 'a spent token must still refuse the signature');
    const {error} = await response.json();
    assert.match(error, /expired/, 'the signer should be told to try again, not that they failed');
    assert.doesNotMatch(error, /did not pass/);
  } finally {
    gate.kill();
  }
});

// A browser that blocks challenges.cloudflare.com sends no token at all. That
// is not a verdict on the signer, so it must not be refused the way a rejected
// token is. The row is flagged and an organizer confirms it instead.
test('a missing Turnstile token is accepted and flagged, not refused', async () => {
  const gatePort = port + 3;
  const gate = spawn(process.execPath, [fileURLToPath(new URL('server.mjs', import.meta.url))], {
    env: {...process.env, PORT: String(gatePort), TURNSTILE_SECRET: '2x0000000000000000000000000000000AA'},
  });
  try {
    await new Promise((resolve, reject) => {
      gate.stdout.on('data', resolve);
      gate.on('error', reject);
      setTimeout(() => reject(new Error('gate server did not start within 5s')), 5000).unref();
    });
    const response = await fetch(`http://localhost:${gatePort}/api/petition/moratorium/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // No turnstileToken at all, the same shape a blocked browser sends.
      body: JSON.stringify({name: 'No Token', email: 'notoken@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true}),
    });
    // Past the anti-bot gate: it gets as far as the database, which this test
    // server has none of. 403 would mean a blocked browser cannot sign.
    assert.notEqual(response.status, 403, 'a missing token must not be refused as a failed challenge');
    assert.equal(response.status, 501, 'it should reach the storage step and stop there');
  } finally {
    gate.kill();
  }
});

// The escape hatch: an organizer who sees this abused can put the hard gate
// back without a deploy.
test('TURNSTILE_REQUIRED=1 restores the hard refusal', async () => {
  const gatePort = port + 4;
  const gate = spawn(process.execPath, [fileURLToPath(new URL('server.mjs', import.meta.url))], {
    env: {...process.env, PORT: String(gatePort), TURNSTILE_SECRET: '2x0000000000000000000000000000000AA', TURNSTILE_REQUIRED: '1'},
  });
  try {
    await new Promise((resolve, reject) => {
      gate.stdout.on('data', resolve);
      gate.on('error', reject);
      setTimeout(() => reject(new Error('gate server did not start within 5s')), 5000).unref();
    });
    const response = await fetch(`http://localhost:${gatePort}/api/petition/moratorium/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: 'No Token', email: 'notoken@example.com', city: 'Americus', state: 'GA', postalCode: '31709', consent: true}),
    });
    assert.equal(response.status, 403, 'with the flag set, a missing token is refused again');
  } finally {
    gate.kill();
  }
});

test('organizer petition routes sit behind the auth gate', async () => {
  const calls = [['POST', '/api/petition/moratorium/paper'], ['POST', '/api/petition/moratorium/snapshot'],
    ['GET', '/api/petition/moratorium/export.csv']];
  for (const [method, path] of calls) {
    const response = await fetch(`${base}${path}`, {
      method, ...(method === 'POST' ? {headers: {'Content-Type': 'application/json'}, body: '{}'} : {}),
    });
    // 501 until an Auth0 audience is configured, 401 (missing token) once it is.
    assert.ok([401, 501].includes(response.status), `${method} ${path} unexpected status ${response.status}`);
  }
});

test('unknown petitions and petition routes 404 rather than leaking', async () => {
  for (const path of ['/api/petition/not-a-petition', '/api/petition/moratorium/nonsense', '/api/petition/moratorium/sign/extra']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, `${path} should 404`);
  }
});

// The confirmation link is the whole basis of the count, so a missing, junk or
// replayed token must never produce a counted signature.
test('petition confirmation refuses a junk token', async () => {
  const missing = await fetch(`${base}/api/petition/verify`);
  assert.ok([400, 501].includes(missing.status), `unexpected status ${missing.status}`);
  const junk = await fetch(`${base}/api/petition/verify?token=aaaaaaaaaaaa`);
  assert.ok([200, 501].includes(junk.status), `unexpected status ${junk.status}`);
  if (junk.status === 200) assert.match(await junk.text(), /Nothing to confirm/);
});

// Mail clients and security scanners follow links in email on their own, so
// withdrawal has to take a POST, a GET shows a confirmation button instead.
test('petition withdrawal does not act on a bare GET', async () => {
  const response = await fetch(`${base}/api/petition/withdraw?token=aaaaaaaaaaaa`);
  assert.ok([200, 501].includes(response.status), `unexpected status ${response.status}`);
  if (response.status === 200) assert.match(await response.text(), /Remove your signature\?/);
});

test('serves the petition route and the draft resolution', async () => {
  const page = await fetch(`${base}/petition/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sumter Field Desk/);
  const pdf = await fetch(`${base}/research/moratorium-resolution.pdf`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
});

test('protected API refuses a forged token', async () => {
  const response = await fetch(`${base}/api/me`, {headers: {Authorization: 'Bearer aaa.bbb.ccc'}});
  assert.ok([401, 501].includes(response.status), `unexpected status ${response.status}`);
});

// --- /api/gis --------------------------------------------------------------
// The route is public, so the allowlist is the whole security boundary: it
// takes a short id and builds the upstream URL itself. These tests exist to
// make sure no future edit lets a caller name their own destination.
test('the GIS cache only serves layers named in the catalogue', async () => {
  const {GIS_SOURCES} = await import('../client/gis-sources.js');
  for (const id of Object.keys(GIS_SOURCES)) {
    const response = await fetch(`${base}/api/gis?layer=${id}`);
    // 503 without a database configured, 200 with one. Never 404.
    assert.ok([200, 503].includes(response.status), `${id} returned ${response.status}`);
  }
});

test('the GIS cache refuses anything not in the catalogue', async () => {
  const attempts = [
    '', 'nope', 'flood2', 'FLOOD',
    // An id that is a URL is the open-proxy case this route must never allow.
    encodeURIComponent('https://169.254.169.254/latest/meta-data/'),
    encodeURIComponent('http://localhost:4173/api/health'),
    encodeURIComponent('file:///etc/passwd'),
    // Inherited object properties are not layers.
    'constructor', 'toString', '__proto__', 'hasOwnProperty',
  ];
  for (const layer of attempts) {
    const response = await fetch(`${base}/api/gis?layer=${layer}`);
    assert.equal(response.status, 404, `layer=${layer} should be rejected, got ${response.status}`);
    assert.match((await response.json()).error, /Unknown layer/);
  }
});

test('the GIS cache is read-only', async () => {
  for (const method of ['POST', 'DELETE', 'PUT']) {
    const response = await fetch(`${base}/api/gis?layer=flood`, {method});
    assert.equal(response.status, 405, `${method} should not be allowed`);
  }
});

// The map is served from a different origin than the API in production, so
// without this header it cannot read how old the copy it was handed is.
test('the GIS cache exposes its age headers cross-origin', async () => {
  const response = await fetch(`${base}/api/gis?layer=flood`, {headers: {Origin: 'http://localhost:4173'}});
  const exposed = response.headers.get('access-control-expose-headers') || '';
  assert.match(exposed, /X-Gis-Age-Ms/);
  assert.match(exposed, /X-Gis-Fetched-At/);
});
