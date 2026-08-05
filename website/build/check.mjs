import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)); // repo root, from website/build
const docs = [
  'README.md', '01-project-and-unknowns.md', '02-water.md', '03-sound.md',
  '04-air-and-generators.md', '05-electricity-and-resilience.md',
  '06-decision-checklist.md', '07-verification-notes.md', '08-source-desk.md',
  '10-liberty-data-centers.md', '11-open-government.md', '12-velocity-trap.md',
  '13-petition-integrity.md',
];
const required = [
  'website/index.html', 'website/sw.js', 'website/package.json',
  'website/client/app.js', 'website/client/auth.js', 'website/client/auth-config.js',
  'website/client/content.js', 'website/client/petition.js', 'website/client/contacts.js',
  'website/client/map.js', 'website/client/gis-sources.js', 'website/client/install.js',
  'website/client/meetings.js',
  'website/assets/styles.css', 'website/assets/manifest.webmanifest', 'website/assets/favicon.svg',
  'website/assets/vendor/leaflet/leaflet.js', 'website/assets/vendor/leaflet/leaflet.css',
  'website/assets/icons/icon-192.png', 'website/assets/icons/icon-512.png',
  'website/assets/icons/preview.png', 'website/assets/icons/seal.svg',
  'website/assets/icons/icon-192-maskable.png', 'website/assets/icons/icon-512-maskable.png',
  'website/assets/icons/icon-180.png',
  'website/server/server.mjs', 'website/build/prerender.mjs',
  'research/moratorium-resolution.pdf', 'research/georgia-sunshine-laws-6th-edition.pdf',
  'research/better-government-2026-08-04.pdf',
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
