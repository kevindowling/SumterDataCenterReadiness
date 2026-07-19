import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = [
  'README.md', '01-project-and-unknowns.md', '02-water.md', '03-sound.md',
  '04-air-and-generators.md', '05-electricity-and-resilience.md',
  '06-decision-checklist.md', '07-verification-notes.md', '08-source-desk.md',
];
const required = ['website/index.html', 'website/app.js', 'website/styles.css', ...docs.map((name) => `research/${name}`)];
const errors = [];
for (const path of required) {
  try {
    const contents = await readFile(`${root}/${path}`, 'utf8');
    if (!contents.trim()) errors.push(`${path} is empty`);
  } catch (error) { errors.push(`${path}: ${error.message}`); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${required.length} public-report files.`);
