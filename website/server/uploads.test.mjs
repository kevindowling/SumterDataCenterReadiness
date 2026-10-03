// The upload receiver (server/uploads.mjs) and the Drive client
// (server/drive.mjs), against a fake Google. No network, no database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {after, before, test} from 'node:test';
import {Readable} from 'node:stream';
import {receiveUpload} from './uploads.mjs';
import {deleteFile, requestFolder, resetDriveCache, uploadFile} from './drive.mjs';

const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(100_000, 0x41), Buffer.from('%%EOF')]);
const chunks = (data, size = 4096) => Readable.from(Array.from({length: Math.ceil(data.length / size)}, (_, index) => data.subarray(index * size, (index + 1) * size)));

test('a real file lands on disk whole, with its hash', async () => {
  const received = await receiveUpload(chunks(pdf), {kind: 'pdf', declaredSize: pdf.length, maxBytes: 1e6});
  try {
    assert.equal(received.size, pdf.length);
    assert.deepEqual(readFileSync(received.path), pdf);
    assert.equal(received.sha256, createHash('sha256').update(pdf).digest('hex'));
  } finally {
    await received.cleanup();
  }
  assert.ok(!existsSync(received.path), 'cleanup removes the temp file');
});

test('a disguised file is refused and leaves nothing on disk', async () => {
  const program = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(50_000)]);
  await assert.rejects(
    receiveUpload(chunks(program), {kind: 'pdf', declaredSize: program.length, maxBytes: 1e6}),
    (error) => error.status === 415 && /not one/.test(error.message));
});

test('a body longer than declared is cut off', async () => {
  await assert.rejects(
    receiveUpload(chunks(pdf), {kind: 'pdf', declaredSize: 1000, maxBytes: 1e6}),
    (error) => error.status === 413);
});

test('a body shorter than declared is an incomplete upload', async () => {
  await assert.rejects(
    receiveUpload(chunks(pdf), {kind: 'pdf', declaredSize: pdf.length + 10, maxBytes: 1e6}),
    (error) => error.status === 400 && /did not complete/.test(error.message));
});

// --- Drive, against a fake Google ---------------------------------------------
let google;
const calls = [];
const stored = new Map();
let nextId = 1;

before(async () => {
  google = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fake');
    const body = Buffer.concat(await Array.fromAsync(request));
    calls.push({method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: request.headers.authorization});
    const json = (status, value, headers = {}) => { response.writeHead(status, {'Content-Type': 'application/json', ...headers}); response.end(JSON.stringify(value)); };

    if (url.pathname === '/token') {
      const form = new URLSearchParams(body.toString());
      if (form.get('refresh_token') !== 'refresh-ok') return json(400, {error: 'invalid_grant'});
      return json(200, {access_token: 'access-1', expires_in: 3600});
    }
    if (request.headers.authorization !== 'Bearer access-1') return json(401, {error: 'unauthorized'});
    if (url.pathname === '/drive/files' && request.method === 'GET') {
      const folders = [...stored.entries()].filter(([, file]) => file.mimeType === 'application/vnd.google-apps.folder' && !file.parents);
      return json(200, {files: folders.map(([id]) => ({id}))});
    }
    if (url.pathname === '/drive/files' && request.method === 'POST') {
      const id = `id${nextId++}`;
      stored.set(id, JSON.parse(body));
      return json(200, {id});
    }
    if (url.pathname === '/upload/files' && request.method === 'POST') {
      return json(200, {}, {Location: `http://127.0.0.1:${google.address().port}/session/${encodeURIComponent(body.toString())}`});
    }
    if (url.pathname.startsWith('/session/') && request.method === 'PUT') {
      const id = `id${nextId++}`;
      stored.set(id, {...JSON.parse(decodeURIComponent(url.pathname.slice('/session/'.length))), bytes: body});
      return json(200, {id});
    }
    if (url.pathname.startsWith('/drive/files/') && request.method === 'DELETE') {
      const id = url.pathname.slice('/drive/files/'.length);
      if (!stored.delete(id)) return json(404, {error: 'notFound'});
      response.writeHead(204); response.end(); return;
    }
    json(404, {error: 'unexpected call'});
  });
  await new Promise((resolve) => google.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${google.address().port}`;
  Object.assign(process.env, {
    GOOGLE_TOKEN_URL: `${origin}/token`, GOOGLE_DRIVE_API: `${origin}/drive`, GOOGLE_DRIVE_UPLOAD: `${origin}/upload`,
    GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh-ok',
  });
});

after(() => google?.close());

test('uploads go into a per-request folder under one root, byte for byte', async () => {
  resetDriveCache();
  const received = await receiveUpload(chunks(pdf), {kind: 'pdf', declaredSize: pdf.length, maxBytes: 1e6});
  try {
    const folderId = await requestFolder({id: '12', sentOn: '2026-09-01', agency: 'City of Americus'});
    const fileId = await uploadFile({path: received.path, size: received.size, name: 'minutes.pdf', mime: 'application/pdf', folderId});
    const file = stored.get(fileId);
    assert.deepEqual(file.bytes, pdf);
    assert.deepEqual(file.parents, [folderId]);
    assert.equal(stored.get(folderId).name, '#12 · 2026-09-01 · City of Americus');
    const root = stored.get(folderId).parents[0];
    assert.equal(stored.get(root).name, 'Field Desk Records');

    // A second request reuses the root rather than making another.
    const second = await requestFolder({id: '13', sentOn: '2026-09-02', agency: 'Sumter County'});
    assert.equal(stored.get(second).parents[0], root);
    assert.equal(calls.filter((call) => call.path === '/token').length, 1, 'one token refresh serves every call');
  } finally {
    await received.cleanup();
  }
});

test('the root folder is found again after a restart', async () => {
  const before = [...stored.values()].filter((file) => file.name === 'Field Desk Records').length;
  resetDriveCache();
  await requestFolder({id: '14', sentOn: '2026-09-03', agency: 'Sumter County'});
  assert.equal([...stored.values()].filter((file) => file.name === 'Field Desk Records').length, before);
});

test('deleting an original that is already gone is not an error', async () => {
  const id = await requestFolder({id: '15', sentOn: '2026-09-04', agency: 'Sumter County'});
  await deleteFile(id);
  assert.ok(!stored.has(id));
  await deleteFile(id);
});

test('a revoked refresh token says how to fix it', async () => {
  resetDriveCache();
  process.env.GOOGLE_REFRESH_TOKEN = 'revoked';
  try {
    await assert.rejects(requestFolder({id: '16', sentOn: '2026-09-05', agency: 'x'}), /invalid_grant.*google-refresh-token/);
  } finally {
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh-ok';
    resetDriveCache();
  }
});
