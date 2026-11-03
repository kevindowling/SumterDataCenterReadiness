// Editorials: letters to the editor, op-eds and statements by the group's
// writers. The rules and the HTML are shared by the browser (app.js), the API
// (server.mjs) and the build (prerender.mjs), so like org.js it must stay free
// of DOM and Node globals.
//
// Writers publish straight from /editorials/ once signed in; there is no review
// step. Who counts as a writer is EDITORIAL_AUTHORS on the server (Auth0 subs,
// falling back to BOARD_ADMINS). Posts live in the database, and the Pages build
// snapshots the published ones into real HTML so a shared link previews.

import {escapeHtml} from './content.js';

// What a piece is. Keys are stored; labels can be reworded freely.
export const KINDS = {
  letter: 'Letter to the editor',
  oped: 'Op-ed',
  statement: 'Statement',
};

export const STATES = ['draft', 'published'];

export const LIMITS = {title: 160, byline: 160, summary: 300, body: 20000};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// One-line fields: control characters and runs of whitespace collapse.
const line = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);

// Today in Americus, as YYYY-MM-DD, so a piece published at 9 p.m. is not
// dated tomorrow.
export const todayInAmericus = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'}).format(now);

// Returns {value} or {error}. `today` is injectable for the tests.
export function validateEditorial(input, today = todayInAmericus()) {
  const value = {
    title: line(input.title, LIMITS.title),
    kind: String(input.kind ?? 'letter'),
    byline: line(input.byline, LIMITS.byline),
    summary: line(input.summary, LIMITS.summary) || null,
    // Paragraph breaks matter here, so newlines survive; Windows line endings
    // from a Word paste become plain ones.
    body: String(input.body ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, LIMITS.body + 1),
    status: String(input.status ?? 'draft'),
    publishedOn: String(input.publishedOn ?? '').trim() || null,
  };
  if (!value.title) return {error: 'Give the piece a headline.'};
  if (value.title.length > LIMITS.title) return {error: `Headline must be at most ${LIMITS.title} characters.`};
  if (!Object.hasOwn(KINDS, value.kind)) return {error: 'Unknown kind of piece.'};
  if (value.byline.length < 2) return {error: 'Add a byline: who wrote it.'};
  if (value.byline.length > LIMITS.byline) return {error: `Byline must be at most ${LIMITS.byline} characters.`};
  if (value.summary && value.summary.length > LIMITS.summary) return {error: `Summary must be at most ${LIMITS.summary} characters.`};
  if (!value.body) return {error: 'The piece has no text.'};
  if (value.body.length > LIMITS.body) return {error: `Text must be at most ${LIMITS.body.toLocaleString('en-US')} characters.`};
  if (!STATES.includes(value.status)) return {error: 'Status must be draft or published.'};
  if (value.publishedOn && (!ISO_DATE.test(value.publishedOn) || Number.isNaN(Date.parse(value.publishedOn)))) return {error: 'The date must be a date.'};
  if (value.publishedOn && value.publishedOn > today) return {error: 'The date cannot be in the future. Save it as a draft until then.'};
  // A piece goes up dated the day it is published unless the writer backdates
  // it, say to the day the paper ran it.
  if (value.status === 'published' && !value.publishedOn) value.publishedOn = today;
  return {value};
}

// "No Rezoning Without a Development Plan" -> "no-rezoning-without-a-development-plan".
// Always starts with a letter, so it can never be mistaken for a row id.
export function slugify(title) {
  const slug = String(title).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return /^[a-z]/.test(slug) ? slug : `editorial-${slug || 'untitled'}`.replace(/-+$/, '');
}

export const SLUG = /^[a-z][a-z0-9-]{0,99}$/;
export const editorialPath = (slug) => `/editorials/${slug}/`;

// Writers are trusted, but the text is still escaped first and only a small
// set of marks is put back, so a pasted <script> is shown, never run:
//   a blank or single line break    -> new paragraph (how Word pastes)
//   ## Heading                      -> subheading
//   > quoted line                   -> pull quote
//   **bold**, *italic*              -> emphasis
//   [label](https://...)            -> link; any other scheme stays plain text
const inlineMarks = (text) => escapeHtml(text)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, href) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

export function editorialBody(text) {
  return String(text || '').split('\n').map((row) => row.trim()).filter(Boolean).map((row) => {
    const heading = row.match(/^##\s+(.+)$/);
    if (heading) return `<h2>${inlineMarks(heading[1])}</h2>`;
    if (row.startsWith('> ')) return `<blockquote>${inlineMarks(row.slice(2))}</blockquote>`;
    return `<p>${inlineMarks(row)}</p>`;
  }).join('');
}

// The summary a list, a search result and a link preview show: the writer's
// own if given, otherwise the opening paragraph cut at a word.
export function editorialSummary(editorial, limit = 220) {
  if (editorial.summary) return editorial.summary;
  const first = String(editorial.body || '').split('\n').map((row) => row.trim())
    .find((row) => row && !row.startsWith('##')) || '';
  const text = first.replace(/^>\s*/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const editorialDate = (iso) => (iso && ISO_DATE.test(iso)
  ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
  : '');

// Newest first; drafts (no date yet) on top for the writers who can see them.
export const byDate = (a, b) => (b.publishedOn || '9999').localeCompare(a.publishedOn || '9999') || b.id - a.id;

const meta = (editorial) => [
  KINDS[editorial.kind] || '',
  editorial.status === 'draft' ? 'DRAFT, NOT PUBLIC' : editorialDate(editorial.publishedOn),
].filter(Boolean).map(escapeHtml).join(' · ');

// The list page. `actions` is the app's slot for the writer's controls; the
// build leaves it empty.
export function editorialListHtml(list, {actions = '', notice = ''} = {}) {
  const items = list.slice().sort(byDate);
  return `<header class="editorials-head">
      <p class="eyebrow"><span></span> EDITORIALS</p>
      <h1>In our <em>own words.</em></h1>
      <p class="lede">Letters, op-eds and statements by members of Sumter County Citizens for Transparency. The research notes report what the record shows; these pieces argue for what we think should happen next.</p>
    </header>
    ${notice}
    ${actions}
    ${items.length
      ? `<ol class="editorial-list">${items.map((editorial) => `<li class="editorial-item${editorial.status === 'draft' ? ' draft' : ''}">
          <p class="editorial-meta">${meta(editorial)}</p>
          <h2><a href="${editorialPath(editorial.slug)}">${escapeHtml(editorial.title)}</a></h2>
          <p class="editorial-byline">${escapeHtml(editorial.byline)}</p>
          <p class="editorial-summary">${escapeHtml(editorialSummary(editorial))}</p>
        </li>`).join('')}</ol>`
      : ''}`;
}

// One piece. `actions` again is the app's slot for the Edit button.
export function editorialArticleHtml(editorial, {actions = ''} = {}) {
  return `<article class="editorial">
      <p class="eyebrow"><span></span> <a class="strip-link" href="/editorials/">← ALL EDITORIALS</a></p>
      <p class="editorial-meta">${meta(editorial)}</p>
      <h1>${escapeHtml(editorial.title)}</h1>
      <p class="editorial-byline">By ${escapeHtml(editorial.byline)}</p>
      ${actions}
      <div class="editorial-body">${editorialBody(editorial.body)}</div>
      <p class="editorial-foot">The views in this piece are the writer's. Sources for the facts behind it are in the <a href="/doc/start/">research notes</a>.</p>
    </article>`;
}
