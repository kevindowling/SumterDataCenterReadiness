// The document catalogue and the markdown renderer.
//
// Deliberately free of DOM and browser globals: app.js imports it in the
// browser and prerender.mjs imports it in Node at build time, so the HTML a
// crawler is served and the HTML a reader is served come from one renderer.
// Anything added here must stay runnable in both.

// Canonical origin. Used for absolute URLs in link previews and the sitemap,
// which must be absolute — a relative og:image is dropped by every scraper.
export const SITE_ORIGIN = 'https://scc4t.com';
export const SITE_NAME = 'Sumter Field Desk';
export const SITE_DESCRIPTION = 'A community research report on the proposed Sumter County data center.';

export const documents = [
  {id: 'start', file: 'README.md', number: '00', short: 'Orientation', title: 'Start with what is known', question: 'What do we actually know?', tone: 'verified', time: '3 min'},
  {id: 'project', file: '01-project-and-unknowns.md', number: '01', short: 'Project', title: 'The missing application', question: 'What is actually proposed?', tone: 'unknown', time: '4 min'},
  {id: 'water', file: '02-water.md', number: '02', short: 'Water', title: 'Wells, limits & cooling', question: 'Could it strain the water system?', tone: 'water', time: '6 min'},
  {id: 'sound', file: '03-sound.md', number: '03', short: 'Sound', title: 'Hum, tones & distance', question: 'Could residents hear it?', tone: 'sound', time: '5 min'},
  {id: 'air', file: '04-air-and-generators.md', number: '04', short: 'Air', title: 'Backup or power plant?', question: 'What if it generates power on site?', tone: 'air', time: '5 min'},
  {id: 'grid', file: '05-electricity-and-resilience.md', number: '05', short: 'Grid', title: 'Load, reliability & cost', question: 'How large could the grid impact be?', tone: 'grid', time: '6 min'},
  {id: 'checklist', file: '06-decision-checklist.md', number: '06', short: 'Action', title: 'The pre-vote checklist', question: 'What should officials require?', tone: 'action', time: '4 min'},
  {id: 'verify', file: '07-verification-notes.md', number: '07', short: 'Verify', title: 'What still needs verification', question: 'What do we still need to confirm?', tone: 'unknown', time: '4 min'},
  {id: 'sources', file: '08-source-desk.md', number: '08', short: 'Sources', title: 'The evidence desk', question: 'Where do the numbers come from?', tone: 'source', time: '5 min'},
  {id: 'records', file: '11-open-government.md', number: '11', short: 'Records', title: 'Records & officials', question: 'How do you obtain the records and reach the officials?', tone: 'action', time: '9 min'},
];

// Notes that render at their own route but are deliberately kept off every
// discovery surface: no rail entry, no search result, no prev/next link,
// nothing on the home page, no sitemap entry, and a noindex tag on the
// prerendered page. Reachable only by someone who already has the URL.
// To publish one, move its entry into `documents` above.
export const unlistedDocuments = [
  {id: 'liberty', file: '10-liberty-data-centers.md', number: '10', short: 'Liberty', title: 'Liberty Data Centers', question: 'Who is the company behind the proposal?', tone: 'source', time: '8 min'},
];

export const allDocuments = [...documents, ...unlistedDocuments];
export const findDocument = (id) => allDocuments.find((item) => item.id === id) || documents[0];
export const isUnlisted = (doc) => unlistedDocuments.includes(doc);

// One place that knows what a note's URL looks like. The trailing slash keeps
// GitHub Pages from redirecting /doc/records to /doc/records/ on every hit.
export const docPath = (id) => `/doc/${id}/`;
export const docUrl = (id) => `${SITE_ORIGIN}${docPath(id)}`;

export const escapeHtml = (value = '') => value.replace(/[&<>"]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));

// Markdown links between research files become in-app routes, so
// `[text](07-verification-notes.md)` lands on /doc/verify/ rather than
// downloading the raw file.
const localDocumentRoute = (href) => {
  const file = href.split('#')[0].replace(/^\.\//, '');
  const target = allDocuments.find((doc) => doc.file === file);
  return target ? docPath(target.id) : href;
};

export const inline = (text) => {
  let result = escapeHtml(text);
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${escapeHtml(localDocumentRoute(href))}" ${/^https?:/.test(href) ? 'target="_blank" rel="noreferrer"' : ''}>${label}</a>`);
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return result;
};

// Research notes are repo-authored files served from /research/, so they carry
// the same trust as app.js itself and may pass raw HTML through a ```html fence
// (used for the inline SVG charts). Nothing reader-supplied reaches this
// function - message-board posts go through postBody(), which never unescapes.
export function markdown(raw) {
  const lines = raw.split('\n');
  const output = [];
  let paragraph = [];
  let list = null;
  let table = null;
  let quote = [];
  let html = null;
  const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; };
  const flushList = () => { if (list) output.push(`<${list.type}>${list.items.join('')}</${list.type}>`); list = null; };
  const flushQuote = () => { if (quote.length) output.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; };
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    output.push(`<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    table = null;
  };
  const flush = () => { flushParagraph(); flushList(); flushQuote(); flushTable(); };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (html) {
      if (line.trim() === '```') { output.push(html.join('\n')); html = null; continue; }
      html.push(lines[index]); continue;
    }
    if (line.trim() === '```html') { flush(); html = []; continue; }
    if (/^\|.+\|$/.test(line)) {
      flushParagraph(); flushList(); flushQuote();
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      const next = lines[index + 1] || '';
      if (/^\|?[\s:|-]+\|?$/.test(next) && next.includes('---')) { table = [cells]; index += 1; continue; }
      if (table) { table.push(cells); continue; }
    } else flushTable();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { flush(); const level = heading[1].length; const label = heading[2]; const id = label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-'); output.push(`<h${level} id="${id}">${inline(label)}</h${level}>`); continue; }
    const bullet = line.match(/^[-*]\s+(?:\[([ xX])\]\s+)?(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph(); flushQuote();
      const type = numbered ? 'ol' : 'ul';
      if (list && list.type !== type) flushList();
      if (!list) list = {type, items: []};
      const checked = bullet?.[1]; const text = numbered ? numbered[1] : bullet[2];
      list.items.push(`<li${checked ? ' class="task"' : ''}>${checked ? `<span class="box">${checked.trim() ? '✓' : ''}</span>` : ''}${inline(text)}</li>`); continue;
    } else flushList();
    if (line.startsWith('> ')) { flushParagraph(); quote.push(line.slice(2)); continue; } else flushQuote();
    if (!line.trim()) { flushParagraph(); continue; }
    paragraph.push(line.trim());
  }
  if (html) output.push(html.join('\n')); // unterminated fence: emit rather than swallow the block
  flush();
  return output.join('');
}

// First real paragraph of a note, flattened to plain text. Used as the meta
// description and link-preview summary, so a shared note describes itself
// rather than repeating the site-wide blurb.
export function summarize(raw, limit = 200) {
  const body = raw.replace(/^#\s+.+$/m, '');
  const paragraph = body.split('\n\n')
    .map((block) => block.trim())
    .find((block) => block && !/^[#|>\-*\d]/.test(block) && !block.startsWith('```'));
  if (!paragraph) return SITE_DESCRIPTION;
  const text = paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
