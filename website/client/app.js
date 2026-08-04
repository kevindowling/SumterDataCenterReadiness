import {apiFetch, apiOrigin, initAuth, isConfigured, login, logout} from './auth.js';
import {initInstallPrompt} from './install.js';
import {
  HOME_TITLE, allDocuments, docPath, documents, escapeHtml, findDocument, inline, isUnlisted,
  markdown, seoTitle, unlistedDocuments,
} from './content.js';
import {LIMITS, livePetition} from './petition.js';
import {contactSections} from './contacts.js';
import {authConfig} from './auth-config.js';


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

async function loadDocument(doc) {
  if (!cache.has(doc.id)) {
    // Absolute: a note served from /doc/records/ must not resolve this
    // against its own directory.
    const response = await fetch(`/research/${doc.file}`);
    if (!response.ok) throw new Error(`Unable to load ${doc.file}`);
    cache.set(doc.id, await response.text());
  }
  return cache.get(doc.id);
}

// Every view has a real path, so each note is its own indexable URL with its
// own title, description, and link preview. The build prerenders one HTML file
// per path; this router takes over once the module loads.
function pathFor(next) {
  return next.view === 'doc' ? docPath(next.id)
    : next.view === 'community' ? '/community/'
    : next.view === 'map' ? '/map/'
    : next.view === 'petition' ? '/petition/'
    : next.view === 'contact' ? '/contact/'
    : next.view === 'board' ? (next.threadId ? `/board/${next.threadId}/` : '/board/')
    : '/';
}

function setRoute(next) {
  route = next;
  const path = pathFor(next);
  if (location.pathname !== path) history.pushState(null, '', path);
  render();
}

function routeFromPath(pathname) {
  const doc = pathname.match(/^\/doc\/([a-z0-9-]+)\/?$/);
  const thread = pathname.match(/^\/board\/(\d+)\/?$/);
  return /^\/community\/?$/.test(pathname) ? {view: 'community'}
    : /^\/map\/?$/.test(pathname) ? {view: 'map'}
    : /^\/petition\/?$/.test(pathname) ? {view: 'petition'}
    : /^\/contact\/?$/.test(pathname) ? {view: 'contact'}
    : thread ? {view: 'board', threadId: thread[1]}
    : /^\/board\/?$/.test(pathname) ? {view: 'board'}
    : doc ? {view: 'doc', id: doc[1]} : {view: 'home'};
}

// Links shared before the move to real paths still arrive as "#/doc/records".
// Rewrite them in place so an old Facebook post or text message keeps working
// and the reader never sees the legacy form in the address bar.
function migrateLegacyHash() {
  const hash = location.hash;
  if (!hash.startsWith('#/')) return false;
  const doc = hash.match(/^#\/doc\/([a-z0-9-]+)/);
  const thread = hash.match(/^#\/board\/(\d+)/);
  const path = doc ? docPath(doc[1])
    : hash.startsWith('#/community') ? '/community/'
    : hash.startsWith('#/map') ? '/map/'
    : hash.startsWith('#/petition') ? '/petition/'
    : hash.startsWith('#/contact') ? '/contact/'
    : thread ? `/board/${thread[1]}/`
    : hash.startsWith('#/board') ? '/board/'
    : '/';
  history.replaceState(null, '', path);
  return true;
}

function readRoute() {
  migrateLegacyHash();
  route = routeFromPath(location.pathname);
  render();
}

// In-app anchors (the ones markdown links produce) must route rather than
// reload. Everything else — external links, new-tab clicks, downloads — is
// left to the browser.
function interceptLinks() {
  addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    const next = routeFromPath(url.pathname);
    if (next.view === 'home' && url.pathname !== '/') return; // a real file, e.g. /research/*.md
    event.preventDefault();
    setRoute(next);
    if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
}

const topbar = () => `
  <header class="topbar">
    <button class="brand" data-home aria-label="Return to research desk">
      <img class="brand-seal" src="/assets/icons/seal.svg" width="38" height="38" alt="Sumter County Citizens for Transparency" /><span><b>SUMTER CITIZENS FOR TRANSPARENCY</b><small>COMMUNITY RESEARCH DESK</small></span>
    </button>
    <div class="top-actions">
      <span class="edition">COMMUNITY RESEARCH EDITION</span>
      <button class="search-button" data-search><kbd>/</kbd> Search the desk</button>
      <button class="source-link" data-doc="start">Research notes ↗</button>
      <button class="source-link" data-contact>Contact officials ↗</button>
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
        <div class="hero-actions"><button data-petition>Sign the moratorium petition <span>→</span></button><button class="quiet" data-doc="start">Start with what is known</button></div>
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

// A 401 has already survived apiFetch's forced token renewal by the time it
// gets here, so the session really is spent. "Server returned 401" tells a
// neighbour nothing they can act on; the sign-out is what actually fixes it.
const serverError = (status) => (status === 401
  ? 'your sign-in has expired — sign out and sign in again'
  : `Server returned ${status}`);

async function loadBoard(threadId) {
  // `loadedFor` marks what render() has already asked for, so re-rendering the
  // board does not kick off a fresh fetch every time.
  board = {...board, state: 'loading', error: '', loadedFor: threadId || ''};
  render();
  try {
    const response = await apiFetch(threadId ? `/api/board/${threadId}` : '/api/board');
    if (response.status === 501) { board = {...board, state: 'unavailable'}; render(); return; }
    if (!response.ok) throw new Error(serverError(response.status));
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
    if (response.status === 401) throw new Error(serverError(401));
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
    if (!response.ok) throw new Error(serverError(response.status));
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

// --- Petition ---------------------------------------------------------------
// The only community feature that works signed out: a petition is worth
// delivering only if the people it speaks for could actually sign it. Bot
// resistance comes from the email confirmation step on the server, not from a
// login wall here.

const PETITION = livePetition();
let petitionView = {
  state: 'idle',          // idle | loading | ready | unavailable | error
  counts: null, signatures: [], organizer: false, error: '',
  // render() rebuilds the form from the template, so what the signer typed only
  // survives an error if it is held here and written back in.
  submitting: false, done: '', formError: '', draft: {},
  unverified: false,      // signed without the anti-bot check, flagged for an organizer
  paperError: '', paperDone: '',
};
let turnstileToken = '';
let turnstileIssuedAt = 0;
let turnstileWidget = null;
// '' while the check is working. 'blocked': the script never loaded, which is
// what a blocker extension looks like. 'error': the widget loaded and then
// refused to run, which is a site key not matching this domain far more often
// than it is a real bot.
let turnstileFault = '';
let turnstileRetries = 0;   // one retry of a failed check before signing without it

// Cloudflare expires a token five minutes after it is issued and refuses it as
// 'timeout-or-duplicate'. Stop short of that: a token accepted here still has a
// form submission and a round trip ahead of it, and the refusal it would earn
// reads as an accusation.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;
const turnstilePassed = () => Boolean(turnstileToken) && Date.now() - turnstileIssuedAt < TOKEN_MAX_AGE_MS;

// Puts the widget back to an unsolved state and asks it for a fresh token.
function resetTurnstile() {
  turnstileToken = '';
  turnstileIssuedAt = 0;
  if (turnstileWidget === null || !window.turnstile) return;
  try { window.turnstile.reset(turnstileWidget); } catch { /* the widget went with the last render */ }
}

const siteKey = () => authConfig.turnstileSiteKey && !authConfig.turnstileSiteKey.startsWith('YOUR_')
  ? authConfig.turnstileSiteKey : '';

// Loaded only on this route, and only when a site key is configured — a reader
// who never opens the petition never touches Cloudflare.
//
// Readiness is the script's own onload callback, not the load event and not the
// presence of window.turnstile. Cloudflare publishes the global as soon as the
// script parses and attaches the explicit-render API afterwards, so both of the
// obvious signals can be true while turnstile.render is still undefined.
const TURNSTILE_READY_CALLBACK = '__turnstileReady';

function loadTurnstile() {
  if (!siteKey()) return Promise.resolve(false);
  if (typeof window.turnstile?.render === 'function') return Promise.resolve(true);
  if (!window.__turnstilePromise) {
    window.__turnstilePromise = new Promise((resolve) => {
      window[TURNSTILE_READY_CALLBACK] = () => resolve(true);
      const script = document.createElement('script');
      script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${TURNSTILE_READY_CALLBACK}`;
      script.async = true;
      script.onerror = () => {
        // An extension blocking the request and a connection dropping look
        // identical from here. Clear the cached failure so the next mount tries
        // again — pressing the button once more is a fair thing to ask, but
        // reloading the page to recover from a dead moment of wifi is not.
        window.__turnstilePromise = null;
        script.remove();
        resolve(false);
      };
      document.head.append(script);
    });
  }
  return window.__turnstilePromise;
}

// render() replaces the whole view, so the widget is rebuilt on every pass.
// Cloudflare keeps its own state per widget id, so the previous one has to be
// dropped or the ids accumulate against detached containers.
//
// A token already in hand deliberately survives the rebuild. It is a bare
// string the server checks against Cloudflare — it is not tied to the widget
// that issued it or to the DOM, and it stays valid for five minutes. Clearing
// it here used to throw away a solved challenge every time anything re-rendered
// the page (the petition load settling, Auth0 resolving, the survey panel
// opening), which left the form submittable with an empty token — a guaranteed
// server-side 'fail' that read as a failed anti-bot check.
async function mountTurnstile() {
  const holder = document.querySelector('#turnstile');
  if (!holder || !siteKey() || holder.childElementCount) return;
  if (!(await loadTurnstile()) || typeof window.turnstile?.render !== 'function') {
    turnstileFault = 'blocked';   // never throw out of here: an unhandled rejection would leave the form silently unguarded
    return;
  }
  if (!holder.isConnected) return;
  if (turnstileWidget !== null) { try { window.turnstile.remove(turnstileWidget); } catch { /* already gone */ } }
  try {
    turnstileWidget = window.turnstile.render(holder, {
      sitekey: siteKey(),
      // Mirrors data-action on the div. The widget is rendered explicitly (the
      // API script is loaded with render=explicit), so the attribute alone would
      // not reach Cloudflare — these render options are what the widget actually
      // uses, and the attribute is what a reader of the markup sees.
      action: 'turnstile-spin-v2',
      callback: (token) => { turnstileToken = token; turnstileIssuedAt = Date.now(); turnstileFault = ''; },
      'expired-callback': () => { turnstileToken = ''; turnstileIssuedAt = 0; },
      // The widget ran and refused. Worth distinguishing: the reader can do
      // something about a blocker extension and nothing at all about a site key
      // that does not match this domain, and the two need different advice.
      'error-callback': () => { turnstileToken = ''; turnstileIssuedAt = 0; turnstileFault = 'error'; },
    });
    turnstileFault = '';
  } catch {
    // A malformed site key throws from render(). Nothing here can recover it,
    // so the form tells the signer the check is unavailable instead of letting
    // them submit into a certain refusal.
    turnstileFault = 'error';
  }
}

async function loadPetition() {
  petitionView = {...petitionView, state: 'loading', error: ''};
  render();
  try {
    // Signed in, the same route also reports whether this account may key in
    // paper signatures, so organizers get their tools without a second call.
    // The petition is public, so a session Auth0 will not renew costs the
    // organizer tools, not the page: optionalAuth drops to the anonymous read.
    const response = user
      ? await apiFetch(`/api/petition/${PETITION.id}`, {optionalAuth: true})
      : await fetch(`${apiOrigin()}/api/petition/${PETITION.id}`);
    if (response.status === 501) { petitionView = {...petitionView, state: 'unavailable'}; render(); return; }
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    petitionView = {...petitionView, state: 'ready', counts: data.counts, signatures: data.signatures, organizer: Boolean(data.organizer)};
  } catch (error) {
    petitionView = {...petitionView, state: 'error', error: error.message};
  }
  render();
}

async function submitSignature(form) {
  const data = new FormData(form);
  const draft = {
    name: data.get('name'), email: data.get('email'), city: data.get('city'),
    state: data.get('state'), postalCode: data.get('postalCode'), comment: data.get('comment'),
    consent: data.get('consent') === 'on', publicDisplay: data.get('publicDisplay') === 'on',
  };
  // A token that is missing or stale would be refused by the server, and that
  // refusal reads as "you look like a bot" when the truth is that the challenge
  // never loaded, never finished, or sat too long on an open form. Each of
  // those is worth a retry, so say which and hold the draft.
  //
  // But a check that has already failed once will not start working because the
  // signer presses harder, and a browser strict enough to block Cloudflare is
  // not a reason to turn a resident away from a petition. After one retry the
  // signature goes through without a token; the server records that and an
  // organizer confirms it by hand.
  const unavailable = turnstileFault === 'blocked' || turnstileFault === 'error';
  if (siteKey() && !turnstilePassed() && !(unavailable && turnstileRetries >= 1)) {
    const expired = Boolean(turnstileToken);   // solved once, but too long ago to be accepted now
    resetTurnstile();                          // ask for a fresh one before the signer tries again
    if (unavailable) turnstileRetries += 1;
    petitionView = {...petitionView, draft, formError:
      turnstileFault === 'blocked' ? 'The anti-bot check could not load. Press the button once more — it will try again, and your signature will go through either way.'
      : turnstileFault === 'error' ? 'The anti-bot check would not run in this browser. Press the button once more — your signature will go through either way.'
      : expired ? 'The anti-bot check expired while the form was open. It is running again — press the button once more.'
      : 'The anti-bot check has not finished yet. Give it a moment and press the button again.'};
    render();
    return;
  }
  petitionView = {...petitionView, draft, submitting: true, formError: '', unverified: siteKey() && !turnstilePassed()};
  render();
  try {
    const response = await fetch(`${apiOrigin()}/api/petition/${PETITION.id}/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: data.get('name'), email: data.get('email'), city: data.get('city'),
        state: data.get('state'), postalCode: data.get('postalCode'), comment: data.get('comment'),
        consent: data.get('consent') === 'on',
        publicDisplay: data.get('publicDisplay') === 'on',
        website: data.get('website'),          // honeypot: a real signer leaves it empty
        turnstileToken,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Server returned ${response.status}`);
    petitionView = {...petitionView, submitting: false, draft: {}, done: body.message || 'Check your email to confirm.'};
    render();
  } catch (error) {
    petitionView = {...petitionView, submitting: false, formError: error.message};
    // The token was spent on the attempt that just failed — Cloudflare refuses
    // a second use of it — so the retry needs a new one.
    resetTurnstile();
    render();
  }
}

async function submitPaperSignature(form) {
  const data = new FormData(form);
  petitionView = {...petitionView, paperError: '', paperDone: ''};
  try {
    const response = await apiFetch(`/api/petition/${PETITION.id}/paper`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: data.get('name'), email: data.get('email'), city: data.get('city'),
        state: data.get('state'), postalCode: data.get('postalCode'),
        publicDisplay: data.get('publicDisplay') === 'on',
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Server returned ${response.status}`);
    form.reset();
    petitionView = {...petitionView, paperDone: 'Paper signature recorded.', counts: body.counts};
    render();
  } catch (error) {
    petitionView = {...petitionView, paperError: error.message};
    render();
  }
}

async function recordSnapshot() {
  petitionView = {...petitionView, paperError: '', paperDone: ''};
  try {
    const response = await apiFetch(`/api/petition/${PETITION.id}/snapshot`, {method: 'POST'});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Server returned ${response.status}`);
    petitionView = {...petitionView, paperDone: `Snapshot recorded — SHA-256 ${body.snapshot.sha256.slice(0, 16)}…`};
  } catch (error) {
    petitionView = {...petitionView, paperError: error.message};
  }
  render();
}

// Fetched with the auth header and handed to the browser as a download rather
// than linked: the export is organizer-only, so it cannot be a plain <a href>.
async function downloadSignatures() {
  try {
    const response = await apiFetch(`/api/petition/${PETITION.id}/export.csv`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = Object.assign(document.createElement('a'), {href: url, download: `${PETITION.id}-signatures.csv`});
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    petitionView = {...petitionView, paperError: error.message};
    render();
  }
}

// Separate lines, never one headline number. A council member's first question
// about any petition is "how many of these are from here?", and a total that
// cannot answer it gets discounted whole.
function petitionTally() {
  const counts = petitionView.counts;
  if (!counts) return '<p class="petition-tally-loading">LOADING THE COUNT…</p>';
  const line = (value, label, accent = false) =>
    `<div class="${accent ? 'tally-lead' : ''}"><b>${value.toLocaleString()}</b><span>${escapeHtml(label)}</span></div>`;
  return `<div class="petition-tally">
    ${line(counts.sumter, 'Verified Sumter County residents', true)}
    ${line(counts.georgia, 'Elsewhere in Georgia')}
    ${line(counts.elsewhere, 'Outside Georgia')}
    ${line(counts.paper, 'Signed on paper, in person')}
  </div>
  <p class="petition-tally-note">${counts.verified.toLocaleString()} confirmed signature${counts.verified === 1 ? '' : 's'} in total${counts.pending ? `, plus ${counts.pending.toLocaleString()} waiting on an email confirmation that has not been opened yet` : ''}. Only confirmed signatures are counted. <a href="/doc/petition/">How this is verified →</a></p>`;
}

// Two governments, one signature. Named before the form rather than after it,
// because "do I have to sign the county one too?" is the question that stops a
// reader mid-page, and the paper copy answers it the same way.
function addressedBlock() {
  const {addressedTo = [], signingNote} = PETITION;
  if (!addressedTo.length) return '';
  return `<aside class="petition-addressed">
    <p class="eyebrow"><span></span> DELIVERED TO</p>
    <ul>${addressedTo.map((recipient) => `<li>${escapeHtml(recipient)}</li>`).join('')}</ul>
    ${signingNote ? `<span class="addressed-note">${escapeHtml(signingNote)}</span>` : ''}
  </aside>`;
}

// Above the form, because the residents closest to the site are the ones least
// likely to sign anything online.
function inPersonBlock() {
  const {place, address, hours, note, contact} = PETITION.inPerson;
  if (!address) {
    return `<aside class="petition-inperson pending">
      <p class="eyebrow"><span></span> SIGN ON PAPER</p>
      <b>An in-person signing location is being arranged.</b>
      <span>A paper copy will be available to sign at a published address and set hours, and paper signatures are counted exactly the same as online ones. Check back, or ask at the next public meeting.</span>
    </aside>`;
  }
  return `<aside class="petition-inperson">
    <p class="eyebrow"><span></span> SIGN ON PAPER, IN PERSON</p>
    <div class="inperson-grid">
      <div><small>WHERE</small><b>${escapeHtml(place)}</b><span>${escapeHtml(address)}</span></div>
      <div><small>WHEN</small>${hours.map((line) => `<b>${escapeHtml(line)}</b>`).join('')}</div>
      ${contact ? `<div><small>QUESTIONS</small><b>${escapeHtml(contact)}</b></div>` : ''}
    </div>
    ${note ? `<span class="inperson-note">${escapeHtml(note)}</span>` : ''}
  </aside>`;
}

function petitionForm() {
  if (petitionView.done) {
    return `<section class="petition-form done">
      <p class="eyebrow"><span></span> ONE MORE STEP</p>
      <h2>Check your email.</h2>
      <p>${escapeHtml(petitionView.done)}</p>
      ${petitionView.unverified ? '<p class="form-fineprint">The anti-bot check could not run in this browser, so this signature is marked for an organizer to confirm by hand. It still counts once you open the emailed link.</p>' : ''}
      <p class="form-fineprint">The link expires in 24 hours. If it does not arrive within a few minutes, check the spam folder before signing again.</p>
    </section>`;
  }
  const disabled = petitionView.submitting ? 'disabled' : '';
  const d = petitionView.draft;
  const value = (field, fallback = '') => ` value="${escapeHtml(d[field] ?? fallback)}"`;
  const ticked = (field) => (d[field] ? ' checked' : '');
  return `<form class="petition-form" data-sign>
    <p class="eyebrow"><span></span> ADD YOUR NAME</p>
    <div class="form-row">
      <label>FULL NAME<input name="name" maxlength="${LIMITS.name}" autocomplete="name" required${value('name')} /></label>
      <label>EMAIL<input name="email" type="email" maxlength="${LIMITS.email}" autocomplete="email" required${value('email')} /></label>
    </div>
    <div class="form-row three">
      <label>CITY OR TOWN<input name="city" maxlength="${LIMITS.city}" autocomplete="address-level2" required${value('city')} /></label>
      <label>STATE<input name="state" maxlength="2" autocomplete="address-level1" required${value('state', 'GA')} /></label>
      <label>ZIP<input name="postalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" autocomplete="postal-code" required${value('postalCode')} /></label>
    </div>
    <label class="form-comment">COMMENT (OPTIONAL) — WHY THIS MATTERS TO YOU
      <textarea name="comment" rows="3" maxlength="${LIMITS.comment}" placeholder="One or two sentences the council will read.">${escapeHtml(d.comment || '')}</textarea>
    </label>
    <label class="form-check"><input type="checkbox" name="consent" required${ticked('consent')} /> <span>I am a real person, I live at the address I gave, and I am signing this petition only once.</span></label>
    <label class="form-check"><input type="checkbox" name="publicDisplay"${ticked('publicDisplay')} /> <span>Show my name, town and comment on this page. Leave unticked to be counted without being listed — your signature counts either way.</span></label>
    <div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
    ${siteKey() ? `<div id="turnstile" class="cf-turnstile turnstile" data-sitekey="${escapeHtml(siteKey())}" data-action="turnstile-spin-v2"></div>` : ''}
    ${siteKey() && turnstileFault ? '<p class="form-fineprint">The anti-bot check will not run in this browser. You can still sign — an organizer will confirm this one by hand.</p>' : ''}
    ${petitionView.formError ? `<p class="board-notice error">${escapeHtml(petitionView.formError)}</p>` : ''}
    <button type="submit" ${disabled}>${petitionView.submitting ? 'Sending the confirmation…' : 'Sign the petition'}</button>
    <p class="form-fineprint">Your signature is not counted until you open the confirmation link we email you. Your email address and ZIP are never published, and every signature can be withdrawn from a link in that same email. <a href="/doc/petition/">How signatures are verified and counted →</a></p>
  </form>`;
}

function petitionSignatures() {
  const list = petitionView.signatures;
  if (!list.length) return '';
  return `<section class="petition-signers">
    <p class="eyebrow"><span></span> SIGNERS WHO ASKED TO BE LISTED</p>
    <div class="signer-list">${list.map((signer) => `
      <article class="signer">
        <b>${escapeHtml(signer.name)}</b>
        <span>${escapeHtml(signer.city)}, ${escapeHtml(signer.state)}${signer.source === 'paper' ? ' · signed on paper' : ''}</span>
        ${signer.comment ? `<p>${escapeHtml(signer.comment)}</p>` : ''}
      </article>`).join('')}</div>
    <p class="form-fineprint">Signers who did not ask to be listed are counted but not shown.</p>
  </section>`;
}

// Organizers only: keying in the paper sheets from the in-person table, and the
// audit tools that make the totals checkable later.
function organizerTools() {
  if (!petitionView.organizer) return '';
  return `<section class="petition-organizer">
    <p class="eyebrow"><span></span> ORGANIZER · PAPER SHEET ENTRY</p>
    <form class="petition-form compact" data-paper>
      <div class="form-row three">
        <label>FULL NAME<input name="name" maxlength="${LIMITS.name}" required /></label>
        <label>CITY<input name="city" maxlength="${LIMITS.city}" required /></label>
        <label>ZIP<input name="postalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required /></label>
      </div>
      <div class="form-row three">
        <label>STATE<input name="state" maxlength="2" value="GA" required /></label>
        <label>EMAIL (IF GIVEN)<input name="email" type="email" maxlength="${LIMITS.email}" /></label>
        <label class="form-check"><input type="checkbox" name="publicDisplay" /> <span>Ticked "list my name" on the sheet</span></label>
      </div>
      ${petitionView.paperError ? `<p class="board-notice error">${escapeHtml(petitionView.paperError)}</p>` : ''}
      ${petitionView.paperDone ? `<p class="board-notice">${escapeHtml(petitionView.paperDone)}</p>` : ''}
      <button type="submit">Record paper signature</button>
    </form>
    <div class="organizer-actions">
      <button class="quiet" data-snapshot>Record an audit snapshot</button>
      <button class="quiet" data-export>Download the full CSV</button>
    </div>
    <p class="form-fineprint">A snapshot writes the current totals and the SHA-256 of the canonical export into the append-only audit log, so a later change to the signature table is detectable. The CSV contains email addresses — it is the copy that must never be posted anywhere public.</p>
  </section>`;
}

let shareMenuOpen = false;

function petitionShareMenu() {
  if (!shareMenuOpen) return '';
  const url = location.origin + '/petition/';
  const text = encodeURIComponent(PETITION.title);
  const encodedUrl = encodeURIComponent(url);
  return `<div class="share-menu" role="menu">
    <a class="share-option" href="mailto:?subject=${text}&body=${encodeURIComponent(PETITION.title + '\n' + url)}" target="_blank" rel="noreferrer" role="menuitem">Email</a>
    <a class="share-option" href="sms:?&body=${text}%20${encodedUrl}" target="_blank" rel="noreferrer" role="menuitem">Text message</a>
    <a class="share-option" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noreferrer" role="menuitem">Facebook</a>
    <a class="share-option" href="https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}" target="_blank" rel="noreferrer" role="menuitem">X / Twitter</a>
    <button class="share-option" data-copy-link role="menuitem">Copy link</button>
  </div>`;
}

async function sharePetition(button) {
  const url = location.origin + '/petition/';
  if (navigator.share) {
    try {
      await navigator.share({title: PETITION.title, text: PETITION.ask, url});
      return;
    } catch { /* user cancelled or share failed — fall through to menu */ }
  }
  shareMenuOpen = !shareMenuOpen;
  render();
  if (shareMenuOpen) {
    const close = (event) => {
      if (!button.closest('.petition-share')?.contains(event.target)) {
        shareMenuOpen = false; render(); document.removeEventListener('click', close, true);
      }
    };
    document.addEventListener('click', close, true);
  }
}

function petitionPage() {
  const notice = petitionView.state === 'unavailable'
    ? '<p class="board-notice">The community server is online but its petition database is not configured yet, so signatures cannot be recorded.</p>'
    : petitionView.state === 'error' ? `<p class="board-notice error">Could not reach the petition server: ${escapeHtml(petitionView.error)}. The petition is still open — try again in a moment.</p>` : '';

  return `${topbar()}<main class="petition">
    <header class="petition-head">
      <p class="eyebrow"><span></span> ${escapeHtml(PETITION.eyebrow)}</p>
      <h1>${escapeHtml(PETITION.title)}</h1>
      <p class="lede">${escapeHtml(PETITION.ask)}</p>
      <div class="petition-share">
        <button class="petition-share-btn" data-share aria-haspopup="true" aria-expanded="${shareMenuOpen}">Share this petition ↗</button>
        ${petitionShareMenu()}
      </div>
    </header>
    ${notice}
    ${addressedBlock()}
    ${inPersonBlock()}
    ${petitionTally()}
    <section class="petition-text">
      ${PETITION.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      <p><a href="${PETITION.document.href}" target="_blank" rel="noreferrer">${escapeHtml(PETITION.document.label)} ↗</a></p>
    </section>
    ${petitionForm()}
    ${organizerTools()}
    ${petitionSignatures()}
  </main>${searchPanel()}`;
}

// Open to everyone, like the petition and unlike the community desk: the point
// of the page is to put a resident in front of an official, and an account
// requirement in the middle of that is a reason to give up.
function contactPage() {
  return `${topbar()}<main class="contact">${contactSections()}</main>${searchPanel()}`;
}

const communityFeatures = [
  {number: 'C2', title: 'Surveys', text: 'Structured community input on the draft ordinance and its conditions.'},
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
      <button class="community-card live" data-petition><i>C3</i><b>Petition</b><span>Ask the county commissioners and the Americus city council to adopt the 18-month data center moratorium. One signature to both. Open to everyone, signed in or not.</span><em>SIGN THE PETITION →</em></button>
      <button class="community-card live" data-contact><i>C4</i><b>Contact</b><span>Your commissioner and council member by name, with e-mail addresses — plus how to write, how to speak at a meeting, and what records you can demand.</span><em>OPEN THE CONTACT DESK →</em></button>
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
  const doc = findDocument(id);
  const raw = await loadDocument(doc);
  document.title = `${doc.title} - Sumter Field Desk`;
  const toc = tocFrom(raw);
  return `${topbar()}<main class="reader">
    <aside class="rail"><p>FIELD NOTES</p>${documents.map((item) => `<button data-doc="${item.id}" class="${item.id === doc.id ? 'active' : ''}"><span>${item.number}</span><b>${item.short}</b><i></i></button>`).join('')}<button data-doc="sources" class="rail-source">Evidence desk ↗</button></aside>
    <article class="paper tone-page-${doc.tone}">
      <header class="paper-cover"><div class="folio"><span>FIELD NOTE / ${doc.number}</span><span>${doc.time.toUpperCase()} READ</span></div><p>${doc.short.toUpperCase()} DESK</p><h1>${doc.title}</h1><div class="cover-question">${doc.question}</div>${doc.author ? `<p class="cover-byline">BY ${escapeHtml(doc.author.toUpperCase())}</p>` : ''}<div class="cover-rule"></div></header>
      <div class="paper-grid"><div class="markdown">${markdown(raw)}</div><aside class="page-toc"><p>ON THIS PAGE</p>${toc.map((item) => `<button class="level-${item.level}" data-anchor="${item.id}">${item.label}</button>`).join('')}<div class="toc-note"><b>READING RULE</b><span>Scenarios show scale. They do not predict this project.</span></div></aside></div>
      ${isUnlisted(doc) ? '' : `<nav class="next-note">${nextDocument(doc, -1)}${nextDocument(doc, 1)}</nav>`}
    </article>
  </main>${searchPanel()}`;
}

function nextDocument(doc, offset) {
  const index = documents.indexOf(doc); const next = documents[(index + offset + documents.length) % documents.length];
  return `<button data-doc="${next.id}"><small>${offset < 0 ? '← PREVIOUS NOTE' : 'NEXT NOTE →'}</small><b>${next.title}</b></button>`;
}

function searchPanel() {
  return `<div class="search-overlay ${searchOpen ? 'open' : ''}" data-overlay><section role="dialog" aria-modal="true" aria-label="Search research"><header><span>SEARCH THE FIELD DESK</span><button data-close aria-label="Close search">×</button></header><label><i>⌕</i><input id="search-input" placeholder="Try water, generators, meeting, or 100 MW…" autocomplete="off" /><kbd>ESC</kbd></label><p class="search-hint">Ten notes · exact phrase search</p><div id="search-results">${searchResults('')}</div></section></div>`;
}

function searchResults(query) {
  const q = query.toLowerCase().trim();
  const results = documents.filter((doc) => !q || `${doc.title} ${doc.question} ${doc.short} ${cache.get(doc.id) || ''}`.toLowerCase().includes(q));
  if (!results.length) return '<p class="empty-result">No field note contains that phrase.</p>';
  return results.map((doc) => `<button data-doc="${doc.id}"><span>${doc.number}</span><p><small>${doc.short} · ${doc.time}</small><b>${doc.title}</b></p><em>↗</em></button>`).join('');
}

// Keeps the tab title and canonical link in step with client-side navigation.
// The prerendered page ships the correct values; this maintains them after the
// router takes over.
function updateHead() {
  const doc = route.view === 'doc' ? findDocument(route.id) : null;
  // Matches the prerendered <title> exactly, so a note reads the same in the
  // tab whether it was landed on directly or navigated to in-app.
  document.title = doc ? seoTitle(doc)
    : route.view === 'community' ? 'Community desk — Sumter Field Desk'
    : route.view === 'petition' ? `${PETITION.title} — Sumter Field Desk`
    : route.view === 'map' ? 'Site map — Sumter Field Desk'
    : route.view === 'board' ? 'Message board — Sumter Field Desk'
    : route.view === 'contact' ? 'Contact your officials — Sumter Field Desk'
    : HOME_TITLE;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(pathFor(route), location.origin).href;
}

// A prerendered note is already legible on screen, so the first render paints
// over it rather than replacing it with a loading message.
let showLoading = app.dataset.prerendered === undefined;

async function render() {
  unmountSiteMap();
  updateHead();
  if (route.view !== 'petition') shareMenuOpen = false;
  if (showLoading) app.innerHTML = '<div class="loading">Opening the field desk…</div>';
  showLoading = true;
  try {
    app.innerHTML = (route.view === 'doc' ? await article(route.id)
      : route.view === 'community' ? community()
      : route.view === 'map' ? siteMap()
      : route.view === 'petition' ? petitionPage()
      : route.view === 'contact' ? contactPage()
      : route.view === 'board' ? boardView()
      : home()) + surveyPanel();
  }
  catch (error) { app.innerHTML = `<div class="fatal"><b>The research desk could not open.</b><p>${escapeHtml(error.message)}</p><p>Run the included local server instead of opening index.html directly.</p></div>`; }
  bind();
  if (route.view === 'community') probeServer();
  if (route.view === 'map' || route.view === 'home') mountSiteMap();
  if (route.view === 'board' && user && board.loadedFor !== (route.threadId || '')) loadBoard(route.threadId);
  if (route.view === 'petition') {
    if (petitionView.state === 'idle') loadPetition();
    mountTurnstile();
  }
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
  document.querySelectorAll('[data-petition]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'petition'}); }));
  document.querySelectorAll('[data-contact]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'contact'}); }));
  document.querySelectorAll('[data-thread]').forEach((button) => button.addEventListener('click', () => setRoute({view: 'board', threadId: button.dataset.thread})));
  document.querySelector('[data-sign]')?.addEventListener('submit', (event) => { event.preventDefault(); submitSignature(event.currentTarget); });
  document.querySelector('[data-paper]')?.addEventListener('submit', (event) => { event.preventDefault(); submitPaperSignature(event.currentTarget); });
  document.querySelector('[data-share]')?.addEventListener('click', (event) => sharePetition(event.currentTarget));
  document.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    const url = location.origin + '/petition/';
    try { await navigator.clipboard.writeText(url); } catch { /* clipboard unavailable */ }
    shareMenuOpen = false; render();
  });
  document.querySelector('[data-snapshot]')?.addEventListener('click', () => recordSnapshot());
  document.querySelector('[data-export]')?.addEventListener('click', () => downloadSignatures());
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

addEventListener('popstate', () => { route = routeFromPath(location.pathname); render(); });
interceptLinks();
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
