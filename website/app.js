import {apiFetch, initAuth, isConfigured, login, logout} from './auth.js';
import {authConfig} from './auth-config.js';

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

function markdown(raw) {
  const lines = raw.split('\n');
  const output = [];
  let paragraph = [];
  let list = null;
  let table = null;
  let quote = [];
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
  const hash = next.view === 'doc' ? `#/doc/${next.id}` : next.view === 'community' ? '#/community' : '#/';
  if (location.hash !== hash) history.pushState(null, '', hash);
  render();
}

function readRoute() {
  const match = location.hash.match(/^#\/doc\/([a-z-]+)/);
  route = location.hash.startsWith('#/community') ? {view: 'community'} : match ? {view: 'doc', id: match[1]} : {view: 'home'};
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
      <button class="source-link" data-doc="sources">Evidence desk ↗</button>
      ${accountControls()}
    </div>
  </header>`;

const accountControls = () => {
  if (!isConfigured()) return '';
  return user
    ? `<button class="source-link" data-community>Community desk ↗</button><span class="account-name" title="${escapeHtml(user.email || '')}">${escapeHtml(user.name || user.email || 'Account')}</span><button class="source-link" data-logout>Sign out</button>`
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

function home() {
  document.title = 'Sumter Field Desk - Data Center Research';
  return `${topbar()}<main class="home">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span></span> CITIZEN RESEARCH FOR SUMTER COUNTY</p>
        <h1>Bring facts.<br />Ask for <em>answers.</em></h1>
        <p class="lede">This is the community's research report on the proposed Sumter County data center. It separates verified local facts from planning scenarios and unresolved project details, so residents can press commissioners for precise answers, in public, before decisions are made.</p>
        <div class="hero-actions"><button data-doc="start">Start with what is known <span>→</span></button><button class="quiet" data-doc="verify">See what still needs verification</button></div>
        <div class="evidence-legend"><span class="verified">Verified fact</span><span class="scenario">Scale scenario</span><span class="unknown">Project unknown</span><span class="recommendation">Recommendation</span></div>
      </div>
      ${fieldMap()}
    </section>
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

const communityFeatures = [
  {number: 'C1', title: 'Message board', text: 'Neighbor-to-neighbor threads on the proposal, meetings, and what people are hearing.'},
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
    <div class="community-grid">${communityFeatures.map((feature) => `<div class="community-card"><i>${feature.number}</i><b>${feature.title}</b><span>${feature.text}</span><em>COMING SOON</em></div>`).join('')}</div>
  </section></main>${searchPanel()}`;
}

function surveyPanel() {
  if (!surveyOpen) return '';
  const body = surveyState === 'thanks'
    ? '<p class="survey-thanks">Thank you. Your answer helps the desk report where the community actually stands.</p>'
    : `<div class="survey-options">${stanceOptions.map((option) => `<button data-stance="${option.key}" ${surveyState === 'saving' ? 'disabled' : ''} class="${option.key === stance ? 'current' : ''}"><b>${option.title}</b><span>${option.text}</span></button>`).join('')}</div>
       ${surveyState === 'error' ? '<p class="survey-error">Could not save your answer. Please try again.</p>' : ''}
       ${surveyState === 'saving' ? '<p class="survey-hint">SAVING…</p>' : '<p class="survey-hint">One tap · you can change your answer any time from the community desk</p>'}`;
  return `<div class="search-overlay survey-overlay open" data-survey-overlay><section role="dialog" aria-modal="true" aria-label="Community survey">
    <header><span>COMMUNITY SURVEY</span><button data-survey-close aria-label="Close survey">×</button></header>
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
    const health = await fetch(`${authConfig.apiBase || ''}/api/health`);
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
  app.innerHTML = '<div class="loading">Opening the field desk…</div>';
  try { app.innerHTML = (route.view === 'doc' ? await article(route.id) : route.view === 'community' ? community() : home()) + surveyPanel(); }
  catch (error) { app.innerHTML = `<div class="fatal"><b>The research desk could not open.</b><p>${escapeHtml(error.message)}</p><p>Run the included local server instead of opening index.html directly.</p></div>`; }
  bind();
  if (route.view === 'community') probeServer();
  if (route.view !== 'home') scrollTo({top: 0, behavior: 'auto'});
  if (searchOpen) requestAnimationFrame(() => document.querySelector('#search-input')?.focus());
}

function bind() {
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc}); }));
  document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => setRoute({view: 'home'})));
  document.querySelectorAll('[data-login]').forEach((button) => button.addEventListener('click', () => login()));
  document.querySelector('[data-logout]')?.addEventListener('click', () => logout());
  document.querySelectorAll('[data-community]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'community'}); }));
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
  document.querySelector('[data-survey-overlay]')?.addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) { surveyOpen = false; render(); } });
}

function bindSearchResults() { document.querySelectorAll('#search-results [data-doc]').forEach((button) => button.addEventListener('click', () => {searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc});})); }

addEventListener('hashchange', readRoute);
addEventListener('keydown', async (event) => {
  if (event.key === 'Escape' && searchOpen) { searchOpen = false; render(); }
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); await Promise.all(documents.map((doc) => loadDocument(doc).catch(() => ''))); searchOpen = true; render(); }
});
readRoute();
initAuth().then(({user: signedIn, freshLogin}) => {
  if (!signedIn) { if (route.view === 'community') render(); return; }
  user = signedIn;
  if (freshLogin) setRoute({view: 'community'}); else render();
  loadStance();
}).catch((error) => console.warn('Auth0 unavailable:', error));
