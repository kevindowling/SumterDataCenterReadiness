import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = [
  'README.md', '01-project-and-unknowns.md', '02-water.md', '03-sound.md',
  '04-air-and-generators.md', '05-electricity-and-resilience.md',
  '06-decision-checklist.md', '07-verification-notes.md', '08-source-desk.md',
  '10-liberty-data-centers.md',
];
const required = [
  'website/index.html', 'website/app.js', 'website/styles.css', 'website/auth.js', 'website/auth-config.js',
  'website/map.js', 'website/vendor/leaflet/leaflet.js', 'website/vendor/leaflet/leaflet.css',
  'website/install.js', 'website/sw.js', 'website/manifest.webmanifest', 'website/favicon.svg',
  'website/icons/icon-192.png', 'website/icons/icon-512.png',
  'website/icons/icon-192-maskable.png', 'website/icons/icon-512-maskable.png', 'website/icons/icon-180.png',
  ...docs.map((name) => `research/${name}`),
];
const errors = [];
for (const path of required) {
  try {
    const contents = await readFile(`${root}/${path}`, 'utf8');
    if (!contents.trim()) errors.push(`${path} is empty`);
  } catch (error) { errors.push(`${path}: ${error.message}`); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${required.length} public-report files.`);
