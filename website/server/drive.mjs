// The desk's Google Drive, where open-records uploads wait for redaction.
//
// No dependencies, like the rest of the server: three REST calls and a token
// refresh. The server acts as the desk's Google account through a refresh
// token minted once on a desktop (tools/google-refresh-token.mjs), scoped to
// drive.file, so it can see the files it created and nothing else in that
// Drive.
//
// Layout: one root folder, "Field Desk Records", with a subfolder per request.
// Originals are deleted from Drive once their redacted copy is published or the
// upload is rejected; Drive holds only what is still waiting for review.

import {createReadStream} from 'node:fs';

const ROOT_NAME = 'Field Desk Records';
const FOLDER = 'application/vnd.google-apps.folder';

// Overridable so the tests can stand up a fake Google; never set in production.
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const apiBase = () => process.env.GOOGLE_DRIVE_API || 'https://www.googleapis.com/drive/v3';
const uploadBase = () => process.env.GOOGLE_DRIVE_UPLOAD || 'https://www.googleapis.com/upload/drive/v3';

export const driveConfigured = () => Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

export const driveLink = (fileId) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

// Access tokens last an hour. Refresh a minute early so a long upload does not
// start on a token about to lapse.
let cached = {token: '', expiresAt: 0};
let refreshing = null;

async function accessToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  // One refresh in flight at a time; concurrent uploads share it.
  refreshing ||= (async () => {
    try {
      const response = await fetch(tokenUrl(), {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      const body = await response.json().catch(() => ({}));
      // invalid_grant is the one that needs a person: the token was revoked,
      // or the OAuth app went back to Testing and Google expired it.
      if (!response.ok) throw new Error(`Google token refresh failed (${response.status}): ${body.error || 'unknown error'}${body.error === 'invalid_grant' ? '. Re-run tools/google-refresh-token.mjs and update GOOGLE_REFRESH_TOKEN.' : ''}`);
      cached = {token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000};
      return cached.token;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function drive(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {...(init.headers || {}), Authorization: `Bearer ${await accessToken()}`},
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Drive ${init.method || 'GET'} failed (${response.status}): ${detail.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

// Drive's query language quotes with single quotes and escapes with backslash.
const quoted = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function createFolder(name, parentId) {
  const response = await drive(`${apiBase()}/files?fields=id`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, mimeType: FOLDER, ...(parentId ? {parents: [parentId]} : {})}),
  });
  return (await response.json()).id;
}

// Found again by name after a restart. drive.file only ever lists files this
// app created, so a folder of the same name made by hand is invisible here and
// cannot be picked up by mistake.
let rootId = '';
async function rootFolder() {
  if (rootId) return rootId;
  const query = `name = ${quoted(ROOT_NAME)} and mimeType = ${quoted(FOLDER)} and 'root' in parents and trashed = false`;
  const response = await drive(`${apiBase()}/files?${new URLSearchParams({q: query, fields: 'files(id)', pageSize: '1'})}`);
  const [existing] = (await response.json()).files || [];
  rootId = existing?.id || await createFolder(ROOT_NAME);
  return rootId;
}

// One folder per request, named so the Drive reads sensibly on its own:
// "#12 · 2026-09-01 · City of Americus".
export async function requestFolder({id, sentOn, agency}) {
  const name = `#${id} · ${sentOn} · ${agency}`.slice(0, 200);
  return createFolder(name, await rootFolder());
}

// Streams a file already on local disk into Drive with a resumable upload: the
// session is opened with the metadata, then the bytes go up in one PUT read
// straight from disk, so a 50 MB file never sits in this process's memory.
export async function uploadFile({path, size, name, mime, folderId}) {
  const session = await drive(`${uploadBase()}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({name, mimeType: mime, parents: [folderId]}),
  });
  const location = session.headers.get('location');
  if (!location) throw new Error('Drive opened no upload session');
  const response = await drive(location, {
    method: 'PUT',
    headers: {'Content-Type': mime, 'Content-Length': String(size)},
    body: createReadStream(path),
    duplex: 'half',
  });
  return (await response.json()).id;
}

// Permanent, not trash: an unredacted original is exactly what should not
// linger for thirty days. Already gone counts as done.
export async function deleteFile(fileId) {
  try {
    await drive(`${apiBase()}/files/${encodeURIComponent(fileId)}`, {method: 'DELETE'});
  } catch (error) {
    if (error.status !== 404) throw error;
  }
}

// For the tests, which swap fake Googles between cases.
export function resetDriveCache() {
  cached = {token: '', expiresAt: 0};
  rootId = '';
}
