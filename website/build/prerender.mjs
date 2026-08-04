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

import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  HOME_DESCRIPTION, HOME_TITLE, SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, docPath, docUrl,
  documents, escapeHtml, isUnlisted, markdown, seoDescription, seoTitle, unlistedDocuments,
} from '../client/content.js';
import {livePetition} from '../client/petition.js';
import {contactSections} from '../client/contacts.js';

const here = dirname(fileURLToPath(import.meta.url));   // website/build
const website = join(here, '..');
const repo = join(website, '..');
const out = process.argv[2] || join(repo, '_site');

// A 1200x630 card, not the square site icon: scrapers crop link previews to a
// wide box, which letterboxes or slices a square logo. Built by
// tools/build-preview-image.py.
const PREVIEW_IMAGE = `${SITE_ORIGIN}/assets/icons/preview.png`;
const PREVIEW_ALT = 'Sumter Field Desk - data center research for Americus, Georgia';

// Last commit date for a file, for an honest sitemap <lastmod>. Stamping every
// URL with the build date tells a crawler the whole site changed on every
// deploy, which is exactly how the signal gets ignored.
function lastModified(path) {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', path], {cwd: repo, encoding: 'utf8'}).trim();
    if (date) return date;
  } catch { /* not a git checkout, or no history for this file */ }
  return new Date().toISOString().slice(0, 10);
}

// The shell uses "./client/…" and "./assets/…" paths, which are correct only at
// the site root. A page at /doc/records/ would resolve them against its own
// directory, so the generated copies get absolute paths instead.
const absolutize = (html) => html.replace(/(href|src)="\.\//g, '$1="/');

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
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapeHtml(PREVIEW_ALT)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${safe.title}" />`,
    `<meta name="twitter:description" content="${safe.description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');
}

// Structured data. Tells a crawler what kind of thing the page is and how the
// notes relate, rather than leaving it to infer both from markup.
function jsonLd(objects) {
  // Escaped so a "</script>" inside any string cannot close the tag early.
  const payload = JSON.stringify(objects.length === 1 ? objects[0] : objects).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${payload}</script>`;
}

const publisher = {'@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/`};

function articleLd(doc, {title, description, modified}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: docUrl(doc.id),
    mainEntityOfPage: docUrl(doc.id),
    dateModified: modified,
    image: PREVIEW_IMAGE,
    isPartOf: {'@type': 'Report', name: 'Sumter County Data Center Community Research Report', url: `${SITE_ORIGIN}/`},
    publisher,
    // A guest note is credited to its writer; the desk remains the publisher.
    author: doc.author ? {'@type': 'Person', name: doc.author} : publisher,
  };
}

function breadcrumbLd(doc) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/`},
      {'@type': 'ListItem', position: 2, name: doc.title, item: docUrl(doc.id)},
    ],
  };
}

const homeLd = () => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'Sumter County Data Center Research',
    url: `${SITE_ORIGIN}/`,
    description: HOME_DESCRIPTION,
    publisher,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sumter County Data Center Community Research Report',
    itemListElement: documents.map((doc, index) => ({
      '@type': 'ListItem', position: index + 1, name: doc.title, url: docUrl(doc.id),
    })),
  },
];

// Replaces the shell's own title/description/canonical block with this page's.
function withHead(shell, meta, structuredData = []) {
  const extra = structuredData.length ? `\n    ${jsonLd(structuredData)}` : '';
  return shell
    .replace(/<title>[^<]*<\/title>/, '@@HEAD@@')
    .replace(/\n\s*<meta name="description"[^>]*>/, '')
    .replace(/\n\s*<link rel="canonical"[^>]*>/, '')
    .replace('@@HEAD@@', head(meta) + extra);
}

// What a crawler or a reader without JavaScript is served. Mirrors the
// structure app.js renders so the page reads correctly on its own, and links
// out to the other notes so the crawler can walk the whole report.
// The cover already carries the note's title as the page H1, and the app hides
// the note's own leading "# ..." with CSS. Left in the prerendered markup it is
// a second, visually hidden H1 competing with the first, so drop it here.
const withoutLeadingHeading = (html) => html.replace(/^<h1[^>]*>.*?<\/h1>/, '');

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
        ${doc.author ? `<p class="cover-byline">BY ${escapeHtml(doc.author.toUpperCase())}</p>` : ''}
      </header>
      <div class="paper-grid"><div class="markdown">${withoutLeadingHeading(body)}</div></div>
    </article>
    <nav class="prerender-nav"><h2>The rest of the report</h2><ul>${others}</ul></nav>`;
}

async function emit(path, contents) {
  const file = join(out, path);
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, contents);
  return path;
}

const shell = absolutize(await readFile(join(website, 'index.html'), 'utf8'));
const written = [];

for (const doc of [...documents, ...unlistedDocuments]) {
  const raw = await readFile(join(repo, 'research', doc.file), 'utf8');
  // No brand suffix: a result shows roughly sixty characters, and the site name
  // already travels in og:site_name.
  const title = seoTitle(doc);
  const description = seoDescription(doc, raw);
  const modified = lastModified(`research/${doc.file}`);
  const page = withHead(shell, {
    title,
    description,
    url: docUrl(doc.id),
    noindex: isUnlisted(doc),
  }, isUnlisted(doc) ? [] : [articleLd(doc, {title, description, modified}), breadcrumbLd(doc)]).replace(
    '<div id="app"><noscript>This research desk requires JavaScript.</noscript></div>',
    // The marker tells app.js this route is already on screen, so it renders
    // over the prerendered note instead of blanking it to a loading message.
    `<div id="app" data-prerendered="${doc.id}">${staticBody(doc, markdown(raw))}</div>`,
  );
  written.push(await emit(join('doc', doc.id, 'index.html'), page));
}

// The petition is the one interactive surface built to be found and shared, so
// unlike the signed-in views it is indexable and ships its text in the HTML —
// the scrapers behind Facebook and iMessage never run the app, and a link with
// no visible ask is a link nobody clicks.
const petition = livePetition();
written.push(await emit(join('petition', 'index.html'), withHead(shell, {
  title: `${petition.title} — Americus, Georgia`,
  description: petition.summary,
  url: `${SITE_ORIGIN}/petition/`,
}, [{
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: petition.title,
  description: petition.summary,
  url: `${SITE_ORIGIN}/petition/`,
  isPartOf: {'@type': 'WebSite', name: SITE_NAME, url: `${SITE_ORIGIN}/`},
  publisher,
}]).replace(
  '<div id="app"><noscript>This research desk requires JavaScript.</noscript></div>',
  `<div id="app" data-prerendered="petition"><main class="petition">
      <header class="petition-head">
        <p class="eyebrow"><span></span> ${escapeHtml(petition.eyebrow)}</p>
        <h1>${escapeHtml(petition.title)}</h1>
        <p class="lede">${escapeHtml(petition.ask)}</p>
      </header>
      <aside class="petition-addressed">
        <p class="eyebrow"><span></span> DELIVERED TO</p>
        <ul>${petition.addressedTo.map((recipient) => `<li>${escapeHtml(recipient)}</li>`).join('')}</ul>
        <span class="addressed-note">${escapeHtml(petition.signingNote)}</span>
      </aside>
      <section class="petition-text">
        ${petition.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        <p><a href="${petition.document.href}">${escapeHtml(petition.document.label)}</a></p>
        <p><a href="${docPath('petition')}">How signatures are verified and counted</a></p>
      </section>
    </main></div>`,
)));

// The contact page ships its text in the HTML for the same reason the petition
// does, and for one more: a resident searching for "americus city council
// email" should land on a page that answers it without waiting for a script.
written.push(await emit(join('contact', 'index.html'), withHead(shell, {
  title: `Contact your officials — ${SITE_NAME}`,
  description: 'Sumter County commissioners and Americus mayor and council by name, district and e-mail — plus how to write to them, how to speak at a meeting, and what records Georgia law entitles you to.',
  url: `${SITE_ORIGIN}/contact/`,
}).replace(
  '<div id="app"><noscript>This research desk requires JavaScript.</noscript></div>',
  `<div id="app" data-prerendered="contact"><main class="contact">${contactSections()}</main></div>`,
)));

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
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  url: `${SITE_ORIGIN}/`,
}, homeLd())));

// GitHub Pages has no rewrite rules, so an unknown path — including a board
// thread, which is generated per post and cannot be prerendered — is served
// 404.html. Handing it the shell lets the router resolve the path client-side.
written.push(await emit('404.html', withHead(shell, {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: `${SITE_ORIGIN}/`,
  noindex: true,
})));

const newest = (dates) => dates.slice().sort().pop();
const noteDates = documents.map((doc) => lastModified(`research/${doc.file}`));
const urls = [
  {loc: `${SITE_ORIGIN}/`, lastmod: newest(noteDates)},
  {loc: `${SITE_ORIGIN}/petition/`, lastmod: lastModified('website/client/petition.js')},
  {loc: `${SITE_ORIGIN}/contact/`, lastmod: lastModified('website/client/contacts.js')},
  ...documents.map((doc, index) => ({loc: docUrl(doc.id), lastmod: noteDates[index]})),
];
written.push(await emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({loc, lastmod}) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`));

// /research/ holds the markdown each note is rendered from. Those files are
// served, so without this every note has a second crawlable copy competing
// with the page built from it. Blocking them here does not affect the app,
// which fetches them at runtime — robots.txt governs crawlers, not fetch.
//
// Unlisted notes are kept out of this file on purpose. robots.txt is public, so
// a Disallow line would publish the very URL it is meant to keep quiet — and it
// would stop crawlers from fetching the page and reading its noindex tag, which
// is what actually keeps it out of the index.
written.push(await emit('robots.txt', `User-agent: *
Allow: /
Disallow: /community/
Disallow: /board/
Disallow: /research/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`));

console.log(`Prerendered ${written.length} files into ${out}`);
for (const path of written) console.log(`  ${path}`);
