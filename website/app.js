import {apiFetch, apiOrigin, initAuth, isConfigured, login, logout} from './auth.js';
import {initInstallPrompt} from './install.js';

const documents = [
  {id: 'start', file: 'README.md', number: '00', short: 'Orientation', title: 'Start with what is known', question: 'What do we actually know?', tone: 'verified', time: '3 min'},
  {id: 'project', file: '01-project-and-unknowns.md', number: '01', short: 'Project', title: 'The missing application', question: 'What is actually proposed?', tone: 'unknown', time: '4 min'},
  {id: 'water', file: '02-water.md', number: '02', short: 'Water', title: 'Wells, limits & cooling', question: 'Could it strain the water system?', tone: 'water', time: '6 min'},
  {id: 'sound', file: '03-sound.md', number: '03', short: 'Sound', title: 'Hum, tones & distance', question: 'Could residents hear it?', tone: 'sound', time: '5 min'},
  {id: 'air', file: '04-air-and-generators.md', number: '04', short: 'Air', title: 'Backup or power plant?', question: 'What if it generates power on site?', tone: 'air', time: '5 min'},
  {id: 'grid', file: '05-electricity-and-resilience.md', number: '05', short: 'Grid', title: 'Load, reliability & cost', question: 'How large could the grid impact be?', tone: 'grid', time: '6 min'},
  {id: 'checklist', file: '06-decision-checklist.md', number: '06', short: 'Action', title: 'The pre-vote checklist', question: 'What should officials require?', tone: 'action', time: '4 min'},
  {id: 'verify', file: '07-verification-notes.md', number: '07', short: 'Verify', title: 'What still needs verification', question: 'What do we still need to confirm?', tone: 'unknown', time: '4 min'},
  {id: 'sources', file: '08-source-desk.md', number: '08', short: 'Sources', title: 'The evidence desk', question: 'Where do the numbers come from?', tone: 'source', time: '5 min'},
];

// Upcoming public meetings. `startUtc`/`endUtc` are explicit so the calendar
// file never depends on the reader's timezone; `date` drives the "is it still
// upcoming?" test, so a past event drops off the site on its own.
const events = [
  {
    id: 'data-centers-are-coming-2026-08-04',
    date: '2026-08-04',
    startUtc: '20260804T220000Z', // 6:00 p.m. EDT
    endUtc: '20260805T000000Z',
    when: 'Tuesday, August 4 · 6:00 p.m.',
    kind: 'PUBLIC COMMUNITY MEETING',
    title: 'Data centers are coming.',
    venue: 'Lake Blackshear Regional Library',
    address: '307 East Lamar St., Americus, GA 31709',
    host: 'Sumter County Citizens for Transparency',
    summary: 'A company is proposing to build a large-scale data center in Americus. Before decisions get made, our community deserves to understand what that means for us — our water, our power bills, our land, and our future.',
    topics: [
      'Water usage & local supply impacts',
      'Electricity demand & utility rates',
      'Noise, land use & property values',
      'What residents can do next',
    ],
  },
];

const upcomingEvents = () => {
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
};

const app = document.querySelector('#app');
const cache = new Map();
let route = {view: 'home'};
let searchOpen = false;
let user = null;
let stance;              // undefined = not yet fetched, null = unanswered, string = answered
let surveyOpen = false;
let surveyState = 'ask'; // ask | saving | thanks | error

// Login survey: which group the resident falls into. Keys match the server
// and the stance_responses check constraint.
const stanceOptions = [
  {key: 'learning', title: 'Still learning', text: "I don't know much about data centers yet."},
  {key: 'opposed', title: 'Opposed', text: "I'm against building data centers in our community."},
  {key: 'cautious', title: 'Open, with guardrails', text: 'Not against a data center, but the process needs to be careful and transparent.'},
  {key: 'expedite', title: 'Frustrated by delays', text: 'Approvals like this take far too long today.'},
];

const escapeHtml = (value = '') => value.replace(/[&<>"]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));
const localDocumentRoute = (href) => {
  const file = href.split('#')[0].replace(/^\.\//, '');
  const target = documents.find((doc) => doc.file === file);
  return target ? `#/doc/${target.id}` : href;
};
const inline = (text) => {
  let result = escapeHtml(text);
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${escapeHtml(localDocumentRoute(href))}" ${/^https?:/.test(href) ? 'target="_blank" rel="noreferrer"' : ''}>${label}</a>`);
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return result;
};

// Research notes are repo-authored files served from /research/, so they carry
// the same trust as app.js itself and may pass raw HTML through a ```html fence
// (used for the inline SVG charts). Nothing reader-supplied reaches this
// function - message-board posts go through postBody(), which never unescapes.
function markdown(raw) {
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

async function loadDocument(doc) {
  if (!cache.has(doc.id)) {
    const response = await fetch(`./research/${doc.file}`);
    if (!response.ok) throw new Error(`Unable to load ${doc.file}`);
    cache.set(doc.id, await response.text());
  }
  return cache.get(doc.id);
}

function setRoute(next) {
  route = next;
  const hash = next.view === 'doc' ? `#/doc/${next.id}`
    : next.view === 'community' ? '#/community'
    : next.view === 'map' ? '#/map'
    : next.view === 'board' ? (next.threadId ? `#/board/${next.threadId}` : '#/board')
    : '#/';
  if (location.hash !== hash) history.pushState(null, '', hash);
  render();
}

function readRoute() {
  const doc = location.hash.match(/^#\/doc\/([a-z-]+)/);
  const thread = location.hash.match(/^#\/board\/(\d+)/);
  route = location.hash.startsWith('#/community') ? {view: 'community'}
    : location.hash.startsWith('#/map') ? {view: 'map'}
    : location.hash.startsWith('#/board') ? {view: 'board', threadId: thread?.[1]}
    : doc ? {view: 'doc', id: doc[1]} : {view: 'home'};
  render();
}

const topbar = () => `
  <header class="topbar">
    <button class="brand" data-home aria-label="Return to research desk">
      <span class="brand-seal">SC</span><span><b>SUMTER FIELD DESK</b><small>COMMUNITY RESEARCH DESK</small></span>
    </button>
    <div class="top-actions">
      <span class="edition">COMMUNITY RESEARCH EDITION</span>
      <button class="search-button" data-search><kbd>/</kbd> Search the desk</button>
      <button class="source-link" data-doc="start">Research notes ↗</button>
      ${accountControls()}
    </div>
  </header>`;

const accountControls = () => {
  if (!isConfigured()) return '';
  return user
    ? `<button class="source-link" data-board>Message board ↗</button><button class="source-link" data-community>Community desk ↗</button><span class="account-name" title="${escapeHtml(user.email || '')}">${escapeHtml(user.name || user.email || 'Account')}</span><button class="source-link" data-logout>Sign out</button>`
    : `<button class="source-link" data-login>Sign in</button>`;
};

function fieldMap() {
  return `<div class="field-map" aria-label="Map of knowns, unknowns, and scenarios">
    <div class="map-grid"></div><div class="map-road road-one"></div><div class="map-road road-two"></div>
    <div class="tract"><span>PROPOSED TRACT</span><b>*PUBLIC APPLICATION NOT LOCATED</b></div>
    <div class="map-pin pin-water"><i>W</i><span>GROUNDWATER</span></div>
    <div class="map-pin pin-grid"><i>G</i><span>GRID LOAD</span></div>
    <div class="map-pin pin-homes"><i>H</i><span>RECEIVERS</span></div>
    <div class="contours">${[1,2,3,4].map((n) => `<i class="c${n}"></i>`).join('')}</div>
    <div class="map-key"><b>FIELD MAP / NOT TO SCALE</b><span>Unknown equipment determines the impact.</span></div>
  </div>`;
}

// A minimal RFC 5545 file, built in the browser so the meeting can be saved to
// a phone calendar without any server round-trip.
function calendarFile(event) {
  const fold = (line) => line.replace(/\r?\n/g, '\\n');
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sumter Field Desk//EN', 'BEGIN:VEVENT',
    `UID:${event.id}@sumter-field-desk`,
    `DTSTART:${event.startUtc}`, `DTEND:${event.endUtc}`,
    `SUMMARY:${fold(`${event.title} — ${event.kind.toLowerCase()}`)}`,
    `LOCATION:${fold(`${event.venue}, ${event.address}`)}`,
    `DESCRIPTION:${fold(`${event.summary}\n\nHosted by ${event.host}.`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

function eventBanner() {
  const [event] = upcomingEvents();
  if (!event) return '';
  return `<section class="event-banner" aria-label="Upcoming public meeting">
    <div class="event-copy">
      <p class="eyebrow"><span></span> ${event.kind}</p>
      <h2>${escapeHtml(event.title)}</h2>
      <p class="event-summary">${escapeHtml(event.summary)}</p>
      <p class="event-topics-label">WHAT THEY'LL TALK ABOUT</p>
      <ul class="event-topics">${event.topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join('')}</ul>
    </div>
    <div class="event-card">
      <div class="event-field"><small>DATE &amp; TIME</small><b>${escapeHtml(event.when)}</b></div>
      <div class="event-field"><small>LOCATION</small><b>${escapeHtml(event.venue)}</b><span>${escapeHtml(event.address)}</span></div>
      <div class="event-field"><small>HOSTED BY</small><b>${escapeHtml(event.host)}</b></div>
      <a class="event-calendar" href="${calendarFile(event)}" download="${event.id}.ics">Add to calendar ↓</a>
    </div>
  </section>`;
}

function home() {
  document.title = 'Sumter Field Desk - Data Center Research';
  // The map leads: it is the one thing that answers "where is this and does it
  // reach me?" before a visitor has read a word.
  return `${topbar()}<main class="home">
    <section class="map-page landing-map">${mapSection()}</section>
    <section class="hero hero-wide">
      <div class="hero-copy">
        <p class="eyebrow"><span></span> CITIZEN RESEARCH FOR SUMTER COUNTY</p>
        <h1>Bring facts.<br />Ask for <em>answers.</em></h1>
        <p class="lede">This is the community's research report on the proposed Sumter County data center. It separates verified local facts from planning scenarios and unresolved project details, so residents can press commissioners for precise answers, in public, before decisions are made.</p>
        <div class="hero-actions"><button data-doc="start">Start with what is known <span>→</span></button><button class="quiet" data-doc="verify">See what still needs verification</button></div>
        <div class="evidence-legend"><span class="verified">Verified fact</span><span class="scenario">Scale scenario</span><span class="unknown">Project unknown</span><span class="recommendation">Recommendation</span></div>
      </div>
    </section>
    ${eventBanner()}
    <section class="status-strip meeting-strip">
      <div><small>COMMUNITY PURPOSE</small><b class="meeting-address">ASK BEFORE APPROVAL</b><span>facts, conditions, and accountability</span></div>
      ${communityCell()}
    </section>
  </main>${searchPanel()}`;
}

function communityCell() {
  if (!isConfigured()) return `<div><small>COMMUNITY DESK</small><b class="meeting-address">COMING SOON</b><span>message board, surveys &amp; petitions</span></div>`;
  return user
    ? `<div><small>COMMUNITY DESK</small><b class="meeting-address"><button class="strip-link" data-community>OPEN THE DESK →</button></b><span>message board, surveys &amp; petitions</span></div>`
    : `<div><small>COMMUNITY DESK</small><b class="meeting-address"><button class="strip-link" data-login>SIGN IN TO JOIN →</button></b><span>message board, surveys &amp; petitions</span></div>`;
}

// Public: the map is the front door. Both the landing page and the dedicated
// #/map view render the same section, so there is one map implementation.
function mapSection() {
  return `<header class="map-head">
      <div>
        <p class="eyebrow"><span></span> SITE MAP · PARCEL 64-17</p>
        <h1>What is <em>around</em> it.</h1>
        <p class="lede">301 Brady Road — 125.1 acres, zoned Industrial. Every layer is queried live from the City of Americus &amp; Sumter County public GIS service, so it shows the county's current record. Toggle layers at the top right; click anything for details.</p>
      </div>
      <form class="map-locate" data-locate>
        <label for="map-address">FIND YOUR ADDRESS</label>
        <div><input id="map-address" name="address" placeholder="e.g. 307 E Lamar St" autocomplete="street-address" /><button type="submit">Locate</button></div>
        <p class="map-locate-result" id="map-locate-result">See how far your home is from the parcel, and which ring it falls in.</p>
      </form>
    </header>
    <div class="map-frame"><div id="site-map"></div></div>
    <p class="map-status" id="map-status">LOADING COUNTY GIS LAYERS…</p>
    <p class="map-note"><b>Arrows point downstream.</b> Flow direction comes from USGS NHDPlus High Resolution, whose flowlines are digitized in the direction of flow; the county's own creek layer records no direction at all. Line thickness follows stream order, and arrows are drawn on order-2 and larger streams only. Other sources: Sumter County / City of Americus public ArcGIS services (parcels, districts, flood zones, hydrology, schools, points of interest); Esri World Imagery; OpenStreetMap. Ring population counts are from the May 2025 county GIS residential analysis. This map is for public information and is not a legal survey.</p>`;
}

function siteMap() {
  document.title = 'Site map - Sumter Field Desk';
  return `${topbar()}<main class="map-page">${mapSection()}</main>${searchPanel()}`;
}

// render() replaces the whole app, so the previous Leaflet instance has to be
// torn down or it keeps its listeners alive against a detached container.
let mapView = null;
function unmountSiteMap() {
  try { mapView?.destroy(); } catch { /* already gone */ }
  mapView = null;
}

async function mountSiteMap() {
  const container = document.querySelector('#site-map');
  const status = document.querySelector('#map-status');
  if (!container) return;
  try {
    const {renderSiteMap} = await import('./map.js');
    const view = await renderSiteMap(container, (message) => { if (status) status.textContent = message.toUpperCase(); });
    // A fast click away can land here after the container is already detached.
    if (!container.isConnected) { view.destroy(); return; }
    mapView = view;
    const form = document.querySelector('[data-locate]');
    const result = document.querySelector('#map-locate-result');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = new FormData(form).get('address')?.toString().trim();
      if (!query) return;
      result.textContent = 'Looking up that address…';
      try {
        const {miles, label} = await view.locateAddress(query);
        result.textContent = `${miles.toFixed(2)} miles from the parcel — ${label}.`;
      } catch (error) { result.textContent = error.message; }
    });
  } catch (error) {
    if (status) status.textContent = `THE MAP COULD NOT OPEN: ${error.message.toUpperCase()}`;
  }
}

// --- Message board ---------------------------------------------------------
let board = {state: 'idle', threads: [], thread: null, replies: [], error: '', admin: false, posting: false, loadedFor: null};

const relativeTime = (value) => {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 90) return 'just now';
  const units = [[60, 'minute'], [60, 'hour'], [24, 'day'], [7, 'week']];
  let amount = seconds / 60;
  let unit = 'minute';
  for (const [size, next] of units.slice(1)) {
    if (amount < size) break;
    amount /= size; unit = next;
  }
  const rounded = Math.round(amount);
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
};

// Board bodies are plain text: escaped, then newlines preserved. No markdown,
// so a neighbour cannot inject links or markup into a public thread.
const postBody = (text) => escapeHtml(text || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br />');

async function loadBoard(threadId) {
  // `loadedFor` marks what render() has already asked for, so re-rendering the
  // board does not kick off a fresh fetch every time.
  board = {...board, state: 'loading', error: '', loadedFor: threadId || ''};
  render();
  try {
    const response = await apiFetch(threadId ? `/api/board/${threadId}` : '/api/board');
    if (response.status === 501) { board = {...board, state: 'unavailable'}; render(); return; }
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    board = threadId
      ? {...board, state: 'ready', thread: data.thread, replies: data.replies, admin: data.admin}
      : {...board, state: 'ready', threads: data.threads, thread: null, replies: [], admin: data.admin};
  } catch (error) {
    board = {...board, state: 'error', error: error.message};
  }
  render();
}

async function submitPost(path, payload, onDone) {
  board = {...board, posting: true, error: ''};
  render();
  try {
    const response = await apiFetch(path, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Server returned ${response.status}`);
    board = {...board, posting: false};
    await onDone(await response.json());
  } catch (error) {
    board = {...board, posting: false, error: error.message};
    render();
  }
}

async function deletePost(id) {
  if (!confirm('Remove this post? Replies to it stay in the thread.')) return;
  try {
    const response = await apiFetch(`/api/board/${id}`, {method: 'DELETE'});
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
  } catch (error) {
    board = {...board, error: error.message};
  }
  loadBoard(route.threadId);
}

const postCard = (post, {heading = false} = {}) => `
  <article class="post${post.deleted ? ' removed' : ''}">
    <header>
      <b>${post.deleted ? 'Removed' : escapeHtml(post.author || 'Neighbor')}</b>
      <time datetime="${escapeHtml(post.createdAt)}">${relativeTime(post.createdAt)}</time>
      ${post.canDelete ? `<button class="post-delete" data-delete="${post.id}">${post.mine ? 'Delete' : 'Remove'}</button>` : ''}
    </header>
    ${heading && post.title ? `<h2>${escapeHtml(post.title)}</h2>` : ''}
    <div class="post-body">${post.deleted ? '<p><em>This post was removed.</em></p>' : `<p>${postBody(post.body)}</p>`}</div>
  </article>`;

function boardView() {
  document.title = 'Message board - Sumter Field Desk';
  if (!user) {
    return `${topbar()}<main class="community"><section class="community-gate">
      <p class="eyebrow"><span></span> MESSAGE BOARD</p>
      <h1>Sign in to <em>post.</em></h1>
      <p class="lede">The message board is for neighbour-to-neighbour threads on the proposal, the meetings, and what people are hearing. Reading and posting both need an account.</p>
      <div class="hero-actions">${isConfigured() ? '<button data-login>Sign in or create an account <span>→</span></button>' : '<button disabled>Sign-in not configured yet</button>'}<button class="quiet" data-home>Back to the research desk</button></div>
    </section></main>${searchPanel()}`;
  }

  const notice = board.state === 'unavailable'
    ? '<p class="board-notice">The community server is online but its database is not configured yet, so the board cannot store posts.</p>'
    : board.state === 'error' ? `<p class="board-notice error">Could not reach the board: ${escapeHtml(board.error)}</p>`
    : board.error ? `<p class="board-notice error">${escapeHtml(board.error)}</p>` : '';

  if (board.thread) {
    return `${topbar()}<main class="board">
      <p class="eyebrow"><span></span> <button class="strip-link board-back" data-board>← ALL THREADS</button></p>
      ${notice}
      ${postCard(board.thread, {heading: true})}
      <p class="board-count">${board.replies.length} ${board.replies.length === 1 ? 'reply' : 'replies'}</p>
      <div class="post-list">${board.replies.map((reply) => postCard(reply)).join('')}</div>
      <form class="board-form" data-reply="${board.thread.id}">
        <label for="reply-body">ADD A REPLY</label>
        <textarea id="reply-body" name="body" rows="4" maxlength="4000" placeholder="Keep it civil and on the facts."></textarea>
        <button type="submit" ${board.posting ? 'disabled' : ''}>${board.posting ? 'Posting…' : 'Post reply'}</button>
      </form>
    </main>${searchPanel()}`;
  }

  const list = board.state === 'loading' ? '<p class="board-count">Loading threads…</p>'
    : !board.threads.length ? '<p class="board-count">No threads yet. Start the first one.</p>'
    : `<div class="thread-list">${board.threads.map((thread) => `
        <button class="thread-row" data-thread="${thread.id}">
          <b>${thread.deleted ? 'Removed thread' : escapeHtml(thread.title || 'Untitled')}</b>
          <span>${thread.deleted ? '—' : escapeHtml(thread.author || 'Neighbor')} · ${relativeTime(thread.createdAt)}</span>
          <em>${thread.replies} ${thread.replies === 1 ? 'reply' : 'replies'}</em>
        </button>`).join('')}</div>`;

  return `${topbar()}<main class="board">
    <p class="eyebrow"><span></span> MESSAGE BOARD${board.admin ? ' · MODERATOR' : ''}</p>
    <h1>What neighbors are <em>saying.</em></h1>
    <p class="lede">Threads on the proposal, the meetings, and what people are hearing. Posts show your account name. Be accurate — the research desk is only useful if what gets repeated from it is true.</p>
    ${notice}
    <form class="board-form new-thread" data-new-thread>
      <label for="thread-title">START A THREAD</label>
      <input id="thread-title" name="title" maxlength="140" placeholder="Subject" />
      <textarea id="thread-body" name="body" rows="4" maxlength="4000" placeholder="What do you want to raise?"></textarea>
      <button type="submit" ${board.posting ? 'disabled' : ''}>${board.posting ? 'Posting…' : 'Post thread'}</button>
    </form>
    ${list}
  </main>${searchPanel()}`;
}

const communityFeatures = [
  {number: 'C2', title: 'Surveys', text: 'Structured community input on the draft ordinance and its conditions.'},
  {number: 'C3', title: 'Petition', text: 'Sign and share petitions asking for answers before approval.'},
  {number: 'C4', title: 'Contact', text: 'Reach the organizers behind the field desk.'},
];

function community() {
  document.title = 'Community Desk - Sumter Field Desk';
  if (!user) {
    return `${topbar()}<main class="community"><section class="community-gate">
      <p class="eyebrow"><span></span> COMMUNITY DESK</p>
      <h1>Sign in to <em>join.</em></h1>
      <p class="lede">The community desk is where the message board, surveys, and petitions will live. The research notes stay open to everyone; an account connects you to the community side.</p>
      <div class="hero-actions">${isConfigured() ? '<button data-login>Sign in or create an account <span>→</span></button>' : '<button disabled>Sign-in not configured yet</button>'}<button class="quiet" data-home>Back to the research desk</button></div>
    </section></main>${searchPanel()}`;
  }
  return `${topbar()}<main class="community"><section class="community-home">
    <p class="eyebrow"><span></span> COMMUNITY DESK</p>
    <h1>Welcome, <em>${escapeHtml((user.given_name || user.name || 'neighbor').split(' ')[0])}.</em></h1>
    <p class="lede">This is the community side of the field desk. The features below are being built; the research notes remain open to everyone whether or not the community server is up.</p>
    <p class="server-status" id="server-status">CHECKING THE COMMUNITY SERVER…</p>
    <p class="stance-line">${stance
      ? `YOUR STANCE: ${stanceOptions.find((option) => option.key === stance)?.title.toUpperCase() || stance} · <button class="strip-link" data-survey-open>CHANGE</button>`
      : `<button class="strip-link" data-survey-open>TAKE THE ONE-TAP SURVEY →</button>`}</p>
    <div class="community-grid">
      <button class="community-card live" data-map><i>C0</i><b>Site map</b><span>The proposed parcel, the ½ / 1 / 3 mile rings, and the homes, schools, churches, waterways and flood zones around it.</span><em>OPEN THE MAP →</em></button>
      <button class="community-card live" data-board><i>C1</i><b>Message board</b><span>Neighbor-to-neighbor threads on the proposal, meetings, and what people are hearing.</span><em>OPEN THE BOARD →</em></button>
      ${communityFeatures.map((feature) => `<div class="community-card"><i>${feature.number}</i><b>${feature.title}</b><span>${feature.text}</span><em>COMING SOON</em></div>`).join('')}
    </div>
  </section></main>${searchPanel()}`;
}

// The survey is mandatory until first answered: no close affordances while
// `stance` is empty; reopening later via “Change” stays dismissible.
const surveyMandatory = () => !stance;

function surveyPanel() {
  if (!surveyOpen) return '';
  const body = surveyState === 'thanks'
    ? '<p class="survey-thanks">Thank you. Your answer helps the desk report where the community actually stands.</p>'
    : `<div class="survey-options">${stanceOptions.map((option) => `<button data-stance="${option.key}" ${surveyState === 'saving' ? 'disabled' : ''} class="${option.key === stance ? 'current' : ''}"><b>${option.title}</b><span>${option.text}</span></button>`).join('')}</div>
       ${surveyState === 'error' ? '<p class="survey-error">Could not save your answer. Please try again.</p>' : ''}
       ${surveyState === 'saving' ? '<p class="survey-hint">SAVING…</p>' : surveyMandatory() ? '<p class="survey-hint">One tap, one time · required to use the desk while signed in · you can change your answer later</p>' : '<p class="survey-hint">One tap · you can change your answer any time from the community desk</p>'}`;
  return `<div class="search-overlay survey-overlay open" data-survey-overlay><section role="dialog" aria-modal="true" aria-label="Community survey">
    <header><span>COMMUNITY SURVEY${surveyMandatory() ? ' · REQUIRED' : ''}</span>${surveyMandatory() ? '' : '<button data-survey-close aria-label="Close survey">×</button>'}</header>
    <h2>Where do you stand on data centers here?</h2>
    ${body}
  </section></div>`;
}

async function loadStance() {
  if (!user || stance !== undefined) return;
  try {
    const response = await apiFetch('/api/survey/stance');
    if (!response.ok) return; // server offline or features not enabled: never block login
    stance = (await response.json()).stance;
    if (stance === null) { surveyOpen = true; surveyState = 'ask'; render(); }
  } catch { /* research desk works without the community server */ }
}

async function submitStance(key) {
  surveyState = 'saving'; render();
  try {
    const response = await apiFetch('/api/survey/stance', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({stance: key})});
    if (!response.ok) throw new Error(String(response.status));
    stance = key; surveyState = 'thanks'; render();
    setTimeout(() => { if (surveyState === 'thanks') { surveyOpen = false; render(); } }, 2200);
  } catch { surveyState = 'error'; render(); }
}

async function probeServer() {
  const status = document.querySelector('#server-status');
  if (!status) return;
  try {
    const health = await fetch(`${apiOrigin()}/api/health`);
    if (!health.ok) throw new Error(String(health.status));
    const me = await apiFetch('/api/me');
    if (me.ok) status.textContent = 'COMMUNITY SERVER: CONNECTED';
    else if (me.status === 501) status.textContent = 'COMMUNITY SERVER: ONLINE — ACCOUNT FEATURES NOT YET ENABLED';
    else status.textContent = `COMMUNITY SERVER: ONLINE — SIGN-IN NOT ACCEPTED (${me.status})`;
  } catch {
    status.textContent = 'COMMUNITY SERVER: OFFLINE — THE RESEARCH DESK STAYS AVAILABLE';
  }
}

function tocFrom(raw) {
  return raw.split('\n').flatMap((line) => { const match = line.match(/^(##|###)\s+(.+)/); return match ? [{level: match[1].length, label: match[2], id: match[2].toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-')}] : []; });
}

async function article(id) {
  const doc = documents.find((item) => item.id === id) || documents[0];
  const raw = await loadDocument(doc);
  document.title = `${doc.title} - Sumter Field Desk`;
  const toc = tocFrom(raw);
  return `${topbar()}<main class="reader">
    <aside class="rail"><p>FIELD NOTES</p>${documents.map((item) => `<button data-doc="${item.id}" class="${item.id === doc.id ? 'active' : ''}"><span>${item.number}</span><b>${item.short}</b><i></i></button>`).join('')}<button data-doc="sources" class="rail-source">Evidence desk ↗</button></aside>
    <article class="paper tone-page-${doc.tone}">
      <header class="paper-cover"><div class="folio"><span>FIELD NOTE / ${doc.number}</span><span>${doc.time.toUpperCase()} READ</span></div><p>${doc.short.toUpperCase()} DESK</p><h1>${doc.title}</h1><div class="cover-question">${doc.question}</div><div class="cover-rule"></div></header>
      <div class="paper-grid"><div class="markdown">${markdown(raw)}</div><aside class="page-toc"><p>ON THIS PAGE</p>${toc.map((item) => `<button class="level-${item.level}" data-anchor="${item.id}">${item.label}</button>`).join('')}<div class="toc-note"><b>READING RULE</b><span>Scenarios show scale. They do not predict this project.</span></div></aside></div>
      <nav class="next-note">${nextDocument(doc, -1)}${nextDocument(doc, 1)}</nav>
    </article>
  </main>${searchPanel()}`;
}

function nextDocument(doc, offset) {
  const index = documents.indexOf(doc); const next = documents[(index + offset + documents.length) % documents.length];
  return `<button data-doc="${next.id}"><small>${offset < 0 ? '← PREVIOUS NOTE' : 'NEXT NOTE →'}</small><b>${next.title}</b></button>`;
}

function searchPanel() {
  return `<div class="search-overlay ${searchOpen ? 'open' : ''}" data-overlay><section role="dialog" aria-modal="true" aria-label="Search research"><header><span>SEARCH THE FIELD DESK</span><button data-close aria-label="Close search">×</button></header><label><i>⌕</i><input id="search-input" placeholder="Try water, generators, meeting, or 100 MW…" autocomplete="off" /><kbd>ESC</kbd></label><p class="search-hint">Nine notes · exact phrase search</p><div id="search-results">${searchResults('')}</div></section></div>`;
}

function searchResults(query) {
  const q = query.toLowerCase().trim();
  const results = documents.filter((doc) => !q || `${doc.title} ${doc.question} ${doc.short} ${cache.get(doc.id) || ''}`.toLowerCase().includes(q));
  if (!results.length) return '<p class="empty-result">No field note contains that phrase.</p>';
  return results.map((doc) => `<button data-doc="${doc.id}"><span>${doc.number}</span><p><small>${doc.short} · ${doc.time}</small><b>${doc.title}</b></p><em>↗</em></button>`).join('');
}

async function render() {
  unmountSiteMap();
  app.innerHTML = '<div class="loading">Opening the field desk…</div>';
  try {
    app.innerHTML = (route.view === 'doc' ? await article(route.id)
      : route.view === 'community' ? community()
      : route.view === 'map' ? siteMap()
      : route.view === 'board' ? boardView()
      : home()) + surveyPanel();
  }
  catch (error) { app.innerHTML = `<div class="fatal"><b>The research desk could not open.</b><p>${escapeHtml(error.message)}</p><p>Run the included local server instead of opening index.html directly.</p></div>`; }
  bind();
  if (route.view === 'community') probeServer();
  if (route.view === 'map' || route.view === 'home') mountSiteMap();
  if (route.view === 'board' && user && board.loadedFor !== (route.threadId || '')) loadBoard(route.threadId);
  if (route.view !== 'home') scrollTo({top: 0, behavior: 'auto'});
  if (searchOpen) requestAnimationFrame(() => document.querySelector('#search-input')?.focus());
}

function bind() {
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc}); }));
  document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => setRoute({view: 'home'})));
  document.querySelectorAll('[data-login]').forEach((button) => button.addEventListener('click', () => login()));
  document.querySelector('[data-logout]')?.addEventListener('click', () => logout());
  document.querySelectorAll('[data-community]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'community'}); }));
  document.querySelectorAll('[data-map]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'map'}); }));
  document.querySelectorAll('[data-board]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'board'}); }));
  document.querySelectorAll('[data-thread]').forEach((button) => button.addEventListener('click', () => setRoute({view: 'board', threadId: button.dataset.thread})));
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deletePost(button.dataset.delete)));
  document.querySelector('[data-new-thread]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitPost('/api/board', {title: form.get('title'), body: form.get('body')},
      ({post}) => setRoute({view: 'board', threadId: post.id}));
  });
  document.querySelector('[data-reply]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const threadId = event.currentTarget.dataset.reply;
    submitPost(`/api/board/${threadId}/reply`, {body: new FormData(event.currentTarget).get('body')},
      () => loadBoard(threadId));
  });
  document.querySelectorAll('[data-search]').forEach((button) => button.addEventListener('click', async () => {
    await Promise.all(documents.map((doc) => loadDocument(doc).catch(() => ''))); searchOpen = true; render();
  }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {searchOpen = false; render();}));
  document.querySelector('[data-overlay]')?.addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) {searchOpen = false; render();} });
  document.querySelector('#search-input')?.addEventListener('input', (event) => { document.querySelector('#search-results').innerHTML = searchResults(event.target.value); bindSearchResults(); });
  bindSearchResults();
  document.querySelectorAll('[data-anchor]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.anchor)?.scrollIntoView({behavior: 'smooth', block: 'start'})));
  document.querySelectorAll('[data-stance]').forEach((button) => button.addEventListener('click', () => submitStance(button.dataset.stance)));
  document.querySelector('[data-survey-close]')?.addEventListener('click', () => { surveyOpen = false; render(); });
  document.querySelector('[data-survey-open]')?.addEventListener('click', () => { surveyOpen = true; surveyState = 'ask'; render(); });
  document.querySelector('[data-survey-overlay]')?.addEventListener('mousedown', (event) => { if (event.target === event.currentTarget && !surveyMandatory()) { surveyOpen = false; render(); } });
}

function bindSearchResults() { document.querySelectorAll('#search-results [data-doc]').forEach((button) => button.addEventListener('click', () => {searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc});})); }

addEventListener('hashchange', readRoute);
addEventListener('keydown', async (event) => {
  if (event.key === 'Escape' && searchOpen) { searchOpen = false; render(); }
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); await Promise.all(documents.map((doc) => loadDocument(doc).catch(() => ''))); searchOpen = true; render(); }
});
readRoute();
initInstallPrompt();
initAuth().then(({user: signedIn, freshLogin}) => {
  if (!signedIn) { if (route.view === 'community') render(); return; }
  user = signedIn;
  if (freshLogin) setRoute({view: 'community'}); else render();
  loadStance();
}).catch((error) => console.warn('Auth0 unavailable:', error));
