import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const websiteDir = fileURLToPath(new URL('.', import.meta.url));
const projectDir = normalize(join(websiteDir, '..'));
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let requested = pathname === '/' ? '/website/index.html' : pathname;
  if (['/app.js', '/styles.css'].includes(requested)) requested = `/website${requested}`;
  const file = normalize(join(projectDir, requested));
  if (!file.startsWith(projectDir) || !['/website/', '/research/', '/data-center-environmental-research-report.md'].some((allowed) => requested.startsWith(allowed))) {
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
