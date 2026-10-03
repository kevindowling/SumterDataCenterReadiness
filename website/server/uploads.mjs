// Receives one open-records upload onto local disk, checking it on the way in.
//
// Why disk first and Drive second: the macro check for a spreadsheet can only
// pass once the whole file has been seen, so streaming straight through to
// Drive would mean a refused file had already landed there. A temp file costs
// nothing at 50 MB, and the upload to Drive then reads it back from disk, so
// memory stays flat however large the file. Under systemd's PrivateTmp the
// temp directory is private to this service.
//
// A file that fails a check is still read to the end (up to the size limit)
// before the error goes back: a server that answers mid-upload and stops
// reading looks like a dropped connection to the browser, and the person sees
// "network error" instead of what was wrong with the file.

import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSniffer} from '../client/records.js';

export class UploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Resolves {path, size, sha256, cleanup}; rejects with an UploadError. The
// caller must call cleanup() once the file has gone to Drive (or failed to).
export async function receiveUpload(stream, {kind, declaredSize, maxBytes}) {
  const dir = await mkdtemp(join(tmpdir(), 'records-'));
  const cleanup = () => rm(dir, {recursive: true, force: true});
  const path = join(dir, 'upload');
  const out = createWriteStream(path);
  let writeError = null;
  out.on('error', (error) => { writeError = error; });

  const hash = createHash('sha256');
  const sniffer = createSniffer(kind);
  let size = 0;
  let failure = null;

  try {
    for await (const chunk of stream) {
      size += chunk.length;
      // More than was declared, or more than allowed: stop reading outright.
      // Content-Length was already checked, so only a lying client gets here.
      if (size > declaredSize || size > maxBytes) { failure = new UploadError(413, 'The file is larger than it said it was.'); break; }
      if (failure) continue; // already refused: drain, so the reply can be read
      const sniffError = sniffer.push(chunk);
      if (sniffError) { failure = new UploadError(415, sniffError); continue; }
      hash.update(chunk);
      if (writeError) throw writeError;
      if (!out.write(chunk)) await once(out, 'drain');
    }
    if (!failure && size !== declaredSize) failure = new UploadError(400, 'The upload did not complete. Try again.');
    if (!failure) {
      const sniffError = sniffer.finish();
      if (sniffError) failure = new UploadError(415, sniffError);
    }
    out.end();
    await once(out, 'close');
    if (writeError) throw writeError;
  } catch (error) {
    out.destroy();
    await cleanup();
    // A client that hangs up mid-upload surfaces here as an aborted stream.
    throw error instanceof UploadError ? error : new UploadError(400, 'The upload did not complete. Try again.');
  }

  if (failure) { await cleanup(); throw failure; }
  return {path, size, sha256: hash.digest('hex'), cleanup};
}
