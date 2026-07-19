import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = [
  'README.md', '01-project-and-unknowns.md', '02-water.md', '03-sound.md',
  '04-air-and-generators.md', '05-electricity-and-resilience.md',
  '06-decision-checklist.md', '07-claim-audit.md', '08-source-desk.md',
];
const required = ['website/index.html', 'website/app.js', 'website/styles.css', ...docs.map((name) => `research/${name}`)];
const errors = [];
for (const path of required) {
  try {
    const contents = await readFile(`${root}/${path}`, 'utf8');
    if (!contents.trim()) errors.push(`${path} is empty`);
  } catch (error) { errors.push(`${path}: ${error.message}`); }
}
let originalStatus = 'Source report is absent from this checkout, as expected for the public repository.';
try {
  const original = await readFile(`${root}/data-center-environmental-research-report.md`, 'utf8');
  if (!original.includes('# Data Center Environmental Research Report') || original.split('\n').length < 900) errors.push('Original report appears truncated');
  originalStatus = `Local source report remains present (${original.split('\n').length} lines) and will not be published.`;
} catch (error) {
  if (error.code !== 'ENOENT') errors.push(`Unable to inspect local source report: ${error.message}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${required.length} site and research files. ${originalStatus}`);
