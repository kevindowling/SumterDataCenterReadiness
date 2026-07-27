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

// What the home page puts in front of a search engine. Distinct from
// SITE_DESCRIPTION, which is the app shell's generic fallback.
export const HOME_TITLE = 'Americus Data Center: Community Research Report';
export const HOME_DESCRIPTION = 'Independent, sourced research on the data center proposed in Americus, Sumter County, Georgia - water, noise, air, electricity, public cost, and how to get the records.';

// Each note carries two titles. `title` is editorial and appears on the cover
// and in the rail; `seoTitle` is what a search result shows, so it is written
// for the words people actually type. Same split for the description: the
// first paragraph of a note rarely stands alone in a result, and several open
// by answering a question the searcher cannot see.
export const seoTitle = (doc) => doc.seoTitle || doc.title;
export const seoDescription = (doc, raw) => doc.seoDescription || summarize(raw);

export const documents = [
  {id: 'start', file: 'README.md', number: '00', short: 'Orientation', title: 'Start with what is known', question: 'What do we actually know?', tone: 'verified', time: '3 min', seoTitle: 'Sumter County Data Center: What Is Known and What Isn\'t', seoDescription: 'A sourced community report on the data center proposed in Americus, Sumter County, Georgia - what the public record shows, and what it does not.'},
  {id: 'project', file: '01-project-and-unknowns.md', number: '01', short: 'Project', title: 'The missing application', question: 'What is actually proposed?', tone: 'unknown', time: '4 min', seoTitle: 'What Is Proposed for the Americus Data Center Site', seoDescription: 'No complete public application or engineering package has been located. What is on the record about the proposed site, and what is missing from it.'},
  {id: 'water', file: '02-water.md', number: '02', short: 'Water', title: 'Wells, limits & cooling', question: 'Could it strain the water system?', tone: 'water', time: '6 min', seoTitle: 'Data Center Water Use and the Americus Well Supply', seoDescription: 'Americus draws from groundwater wells under a 3.75 MGD permit. How cooling designs differ in water demand, and what the city has not yet certified.'},
  {id: 'sound', file: '03-sound.md', number: '03', short: 'Sound', title: 'Hum, tones & distance', question: 'Could residents hear it?', tone: 'sound', time: '5 min', seoTitle: 'Data Center Noise: How Far Does the Hum Carry?', seoDescription: 'What is documented about data center noise at nearby homes - measured complaint levels, low-frequency hum, and how distance and buffers actually perform.'},
  {id: 'air', file: '04-air-and-generators.md', number: '04', short: 'Air', title: 'Backup or power plant?', question: 'What if it generates power on site?', tone: 'air', time: '5 min', seoTitle: 'Data Center Generators: Backup Power or Power Plant?', seoDescription: 'Generators at data centers can run well beyond emergencies. Fuel use, emissions, and the permit terms that separate backup from routine generation.'},
  {id: 'grid', file: '05-electricity-and-resilience.md', number: '05', short: 'Grid', title: 'Load, reliability & cost', question: 'How large could the grid impact be?', tone: 'grid', time: '6 min', seoTitle: 'Data Center Electricity Demand and Who Pays for It', seoDescription: 'A large data center can rival a county\'s entire electricity use. Georgia\'s 9,985 MW of approved new generation, grid reliability, and ratepayer costs.'},
  {id: 'checklist', file: '06-decision-checklist.md', number: '06', short: 'Action', title: 'The pre-vote checklist', question: 'What should officials require?', tone: 'action', time: '4 min', seoTitle: 'Data Center Ordinance Checklist for Local Officials', seoDescription: 'Conditions officials can require before approving a data center - water, sound, air, grid, and lifecycle - plus the six parts an enforceable condition needs.'},
  {id: 'verify', file: '07-verification-notes.md', number: '07', short: 'Verify', title: 'What still needs verification', question: 'What do we still need to confirm?', tone: 'unknown', time: '4 min', seoTitle: 'What Is Still Unverified About the Americus Data Center', seoDescription: 'What the public record does not yet show about the proposed Sumter County data center, and which documents would settle each open question.'},
  {id: 'sources', file: '08-source-desk.md', number: '08', short: 'Sources', title: 'The evidence desk', question: 'Where do the numbers come from?', tone: 'source', time: '5 min', seoTitle: 'Sources Behind the Americus Data Center Report', seoDescription: 'Every figure traced to its source - EPD permits, USGS water data, the Georgia PSC, and federal technical references - with each source\'s limits noted.'},
  {id: 'records', file: '11-open-government.md', number: '11', short: 'Records', title: 'Records & officials', question: 'How do you obtain the records and reach the officials?', tone: 'action', time: '9 min', seoTitle: 'How to File a Georgia Open Records Request', seoDescription: 'Obtaining the Americus data center records under Georgia\'s Open Records Act - the three-day deadline, fees, exemptions, a request template, and who to contact.'},
];

// Notes that render at their own route but are deliberately kept off every
// discovery surface: no rail entry, no search result, no prev/next link,
// nothing on the home page, no sitemap entry, and a noindex tag on the
// prerendered page. Reachable only by someone who already has the URL.
// To publish one, move its entry into `documents` above.
export const unlistedDocuments = [
  {id: 'liberty', file: '10-liberty-data-centers.md', number: '10', short: 'Liberty', title: 'Liberty Data Centers', question: 'Who is the company behind the proposal?', tone: 'source', time: '8 min', seoTitle: 'Liberty Data Centers', seoDescription: 'What the public record shows about the company behind the proposal.'},
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
