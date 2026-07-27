// Build step: turn the single-page app into one real HTML file per route.
//
// Two problems this solves. Search engines only index URLs, and a fragment
// (#/doc/records) is not a URL — without this every note shared one entry in
// the index. And the scrapers behind Facebook, iMessage, Slack, and the rest
// do not run JavaScript at all, so a shared link had no title, summary, or
// image to show.
//
// Each generated page carries its own <title>, description, canonical link,
// and Open Graph tags, plus the note's fully rendered HTML in the body. The app
// module still boots and takes over navigation; the prerendered markup is what
// a crawler, a scraper, or a reader with JavaScript disabled sees.
//
// Usage: node prerender.mjs <output-dir>

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, docPath, docUrl, documents, escapeHtml,
  isUnlisted, markdown, summarize, unlistedDocuments,
} from './content.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const out = process.argv[2] || join(repo, '_site');

const PREVIEW_IMAGE = `${SITE_ORIGIN}/icons/icon-512.png`;

// The shell uses "./asset" paths, which are correct only at the site root. A
// page at /doc/records/ would resolve them against its own directory, so the
// generated copies get absolute paths instead.
const absolutize = (html) => html
  .replace(/(href|src)="\.\//g, '$1="/')
  .replace(/href="\.\/(favicon\.svg|icons\/)/g, 'href="/$1');

function head({title, description, url, image = PREVIEW_IMAGE, noindex = false}) {
  const safe = {title: escapeHtml(title), description: escapeHtml(description)};
  return [
    `<title>${safe.title}</title>`,
    `<meta name="description" content="${safe.description}" />`,
    `<link rel="canonical" href="${url}" />`,
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow" />',
    '<meta property="og:type" content="article" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${safe.title}" />`,
    `<meta property="og:description" content="${safe.description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${safe.title}" />`,
    `<meta name="twitter:description" content="${safe.description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');
}

// Replaces the shell's own title/description/canonical block with this page's.
function withHead(shell, meta) {
  return shell
    .replace(/<title>[^<]*<\/title>/, '@@HEAD@@')
    .replace(/\n\s*<meta name="description"[^>]*>/, '')
    .replace(/\n\s*<link rel="canonical"[^>]*>/, '')
    .replace('@@HEAD@@', head(meta));
}

// What a crawler or a reader without JavaScript is served. Mirrors the
// structure app.js renders so the page reads correctly on its own, and links
// out to the other notes so the crawler can walk the whole report.
function staticBody(doc, body) {
  const others = documents
    .filter((item) => item.id !== doc.id)
    .map((item) => `<li><a href="${docPath(item.id)}">${escapeHtml(item.title)}</a></li>`)
    .join('');
  return `<article class="paper tone-page-${doc.tone}">
      <header class="paper-cover">
        <div class="folio"><span>${escapeHtml(doc.number)} · ${escapeHtml(doc.short.toUpperCase())}</span><span>${escapeHtml(doc.time)}</span></div>
        <p>SUMTER FIELD DESK</p>
        <h1>${escapeHtml(doc.title)}</h1>
        <p class="cover-question">${escapeHtml(doc.question)}</p>
      </header>
      <div class="paper-grid"><div class="markdown">${body}</div></div>
    </article>
    <nav class="prerender-nav"><h2>The rest of the report</h2><ul>${others}</ul></nav>`;
}

async function emit(path, contents) {
  const file = join(out, path);
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, contents);
  return path;
}

const shell = absolutize(await readFile(join(here, 'index.html'), 'utf8'));
const written = [];

for (const doc of [...documents, ...unlistedDocuments]) {
  const raw = await readFile(join(repo, 'research', doc.file), 'utf8');
  const description = summarize(raw);
  const page = withHead(shell, {
    title: `${doc.title} — ${SITE_NAME}`,
    description,
    url: docUrl(doc.id),
    noindex: isUnlisted(doc),
  }).replace(
    '<div id="app"><noscript>This research desk requires JavaScript.</noscript></div>',
    // The marker tells app.js this route is already on screen, so it renders
    // over the prerendered note instead of blanking it to a loading message.
    `<div id="app" data-prerendered="${doc.id}">${staticBody(doc, markdown(raw))}</div>`,
  );
  written.push(await emit(join('doc', doc.id, 'index.html'), page));
}

// Views with no note behind them still need a real URL and a sane title.
for (const [path, title, description] of [
  ['community', 'Community desk', 'Sign in to the Sumter Field Desk community area.'],
  ['map', 'Site map', 'Map of the proposed Sumter County data center site and its surroundings.'],
  ['board', 'Message board', 'Neighbors comparing notes on the proposed Sumter County data center.'],
]) {
  written.push(await emit(join(path, 'index.html'), withHead(shell, {
    title: `${title} — ${SITE_NAME}`,
    description,
    url: `${SITE_ORIGIN}/${path}/`,
    noindex: true, // signed-in and interactive surfaces; nothing to index
  })));
}

// Home page: the shell itself, with the canonical tag the others carry.
written.push(await emit('index.html', withHead(shell, {
  title: 'Sumter Field Desk - Data Center Research',
  description: SITE_DESCRIPTION,
  url: `${SITE_ORIGIN}/`,
})));

// GitHub Pages has no rewrite rules, so an unknown path — including a board
// thread, which is generated per post and cannot be prerendered — is served
// 404.html. Handing it the shell lets the router resolve the path client-side.
written.push(await emit('404.html', withHead(shell, {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: `${SITE_ORIGIN}/`,
  noindex: true,
})));

const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE_ORIGIN}/`, ...documents.map((doc) => docUrl(doc.id))];
written.push(await emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`));

// Unlisted notes are kept out of this file on purpose. robots.txt is public, so
// a Disallow line would publish the very URL it is meant to keep quiet — and it
// would stop crawlers from fetching the page and reading its noindex tag, which
// is what actually keeps it out of the index.
written.push(await emit('robots.txt', `User-agent: *
Allow: /
Disallow: /community/
Disallow: /board/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`));

console.log(`Prerendered ${written.length} files into ${out}`);
for (const path of written) console.log(`  ${path}`);
