const documents = [
  {id: 'start', file: 'README.md', number: '00', short: 'Orientation', title: 'Start with what is known', question: 'What do we actually know?', tone: 'verified', time: '3 min'},
  {id: 'project', file: '01-project-and-unknowns.md', number: '01', short: 'Project', title: 'The missing application', question: 'What is actually proposed?', tone: 'unknown', time: '4 min'},
  {id: 'water', file: '02-water.md', number: '02', short: 'Water', title: 'Wells, limits & cooling', question: 'Could it strain the water system?', tone: 'water', time: '6 min'},
  {id: 'sound', file: '03-sound.md', number: '03', short: 'Sound', title: 'Hum, tones & distance', question: 'Could residents hear it?', tone: 'sound', time: '5 min'},
  {id: 'air', file: '04-air-and-generators.md', number: '04', short: 'Air', title: 'Backup or power plant?', question: 'What if it generates power on site?', tone: 'air', time: '5 min'},
  {id: 'grid', file: '05-electricity-and-resilience.md', number: '05', short: 'Grid', title: 'Load, reliability & cost', question: 'How large could the grid impact be?', tone: 'grid', time: '6 min'},
  {id: 'checklist', file: '06-decision-checklist.md', number: '06', short: 'Action', title: 'The pre-vote checklist', question: 'What should officials require?', tone: 'action', time: '4 min'},
  {id: 'audit', file: '07-claim-audit.md', number: '07', short: 'Audit', title: 'Corrections & cautions', question: 'Which claims need correction?', tone: 'caution', time: '5 min'},
  {id: 'sources', file: '08-source-desk.md', number: '08', short: 'Sources', title: 'The evidence desk', question: 'Where do the numbers come from?', tone: 'source', time: '5 min'},
];

const entryQuestions = [
  {id: 'project', mark: 'A', label: 'What is actually proposed?', note: 'Begin with the missing facts'},
  {id: 'water', mark: 'W', label: 'Could it strain city water?', note: 'Compare cooling designs'},
  {id: 'sound', mark: 'S', label: 'What might neighbors hear?', note: 'Separate evidence from alarm'},
  {id: 'air', mark: 'P', label: 'Backup—or a power plant?', note: 'Follow the fuel and hours'},
  {id: 'grid', mark: 'G', label: 'Could it affect the grid?', note: 'See scale without guessing'},
  {id: 'checklist', mark: '✓', label: 'What should happen before a vote?', note: 'Take the meeting checklist'},
];

const app = document.querySelector('#app');
const cache = new Map();
let route = {view: 'home'};
let searchOpen = false;

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
  const hash = next.view === 'doc' ? `#/doc/${next.id}` : '#/';
  if (location.hash !== hash) history.pushState(null, '', hash);
  render();
}

function readRoute() {
  const match = location.hash.match(/^#\/doc\/([a-z-]+)/);
  route = match ? {view: 'doc', id: match[1]} : {view: 'home'};
  render();
}

const topbar = () => `
  <header class="topbar">
    <button class="brand" data-home aria-label="Return to research desk">
      <span class="brand-seal">SC</span><span><b>SUMTER FIELD DESK</b><small>DATA CENTER RESEARCH / JULY 2026</small></span>
    </button>
    <div class="top-actions">
      <span class="edition">PUBLIC WORKING EDITION</span>
      <button class="search-button" data-search><kbd>/</kbd> Search the desk</button>
      <button class="source-link" data-doc="sources">Evidence desk ↗</button>
    </div>
  </header>`;

function fieldMap() {
  return `<div class="field-map" aria-label="Map of knowns, unknowns, and scenarios">
    <div class="map-grid"></div><div class="map-road road-one"></div><div class="map-road road-two"></div>
    <div class="tract"><span>125± ACRES</span><b>PROPOSED TRACT*</b><small>*public application not located</small></div>
    <div class="map-pin pin-water"><i>W</i><span>GROUNDWATER</span></div>
    <div class="map-pin pin-grid"><i>G</i><span>GRID LOAD</span></div>
    <div class="map-pin pin-homes"><i>H</i><span>RECEIVERS</span></div>
    <div class="contours">${[1,2,3,4].map((n) => `<i class="c${n}"></i>`).join('')}</div>
    <div class="map-key"><b>FIELD MAP / NOT TO SCALE</b><span>Unknown equipment determines the impact.</span></div>
  </div>`;
}

function home() {
  document.title = 'Sumter Field Desk — Data Center Research';
  return `${topbar()}<main class="home">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span></span> A PLAIN-LANGUAGE PUBLIC RESEARCH DESK</p>
        <h1>Start with<br />what we <em>know.</em></h1>
        <p class="lede">The proposed data center is still mostly an outline. This desk separates local facts from scale scenarios, unknown project details, and policy recommendations—so a public meeting does not become a contest between marketing and fear.</p>
        <div class="hero-actions"><button data-doc="start">Read the 3-minute briefing <span>→</span></button><button class="quiet" data-doc="audit">See the claim audit</button></div>
        <div class="evidence-legend"><span class="verified">Verified fact</span><span class="scenario">Scale scenario</span><span class="unknown">Project unknown</span><span class="recommendation">Recommendation</span></div>
      </div>
      ${fieldMap()}
    </section>
    <section class="status-strip">
      <div><small>LOCAL WATER PERMIT</small><b>3.75 <i>MGD</i></b><span>annual-average limit</span></div>
      <div><small>PROJECT WATER USE</small><b class="redacted">NOT DISCLOSED</b><span>cooling design unknown</span></div>
      <div><small>PROJECT ELECTRIC LOAD</small><b class="redacted">NOT DISCLOSED</b><span>full buildout unknown</span></div>
      <div><small>PUBLIC APPLICATION</small><b class="redacted">NOT LOCATED</b><span>verify before approval</span></div>
    </section>
    <section class="question-deck">
      <header><p class="eyebrow"><span></span> CHOOSE THE QUESTION IN FRONT OF YOU</p><h2>Six ways into the research.</h2><p>You do not need to read a 942-line report to ask a precise question.</p></header>
      <div class="question-grid">${entryQuestions.map((item, index) => `<button data-doc="${item.id}" class="question q${index + 1}"><i>${item.mark}</i><span><small>FIELD QUESTION / 0${index + 1}</small><b>${item.label}</b><em>${item.note}</em></span><strong>↗</strong></button>`).join('')}</div>
    </section>
    <section class="logic-section">
      <div class="logic-copy"><p class="eyebrow"><span></span> THE CENTRAL LOGIC</p><h2>Acreage does not equal impact.</h2><p>The tract size tells us where the project may sit. Four missing design decisions tell us what it may do.</p><button data-doc="project">Open the missing-facts guide →</button></div>
      <div class="logic-flow"><div><small>01</small><b>IT load</b><span>creates heat</span></div><i>→</i><div><small>02</small><b>Cooling</b><span>drives water + sound</span></div><i>→</i><div><small>03</small><b>Grid service</b><span>sets generation need</span></div><i>→</i><div><small>04</small><b>Operating limits</b><span>make promises real</span></div></div>
    </section>
    <section class="desk-index"><header><p class="eyebrow"><span></span> THE COMPLETE DESK</p><h2>Nine short field notes.</h2></header><div>${documents.map((doc) => `<button data-doc="${doc.id}"><span>${doc.number}</span><i class="tone-${doc.tone}"></i><p><small>${doc.short} · ${doc.time}</small><b>${doc.title}</b></p><em>Open ↗</em></button>`).join('')}</div></section>
    <footer><div class="brand-seal">SC</div><p><b>Facts before forecasts.</b><br />Conditions before promises.</p><span>Research edition · July 19, 2026<br />Source report retained outside the public site.</span></footer>
  </main>${searchPanel()}`;
}

function tocFrom(raw) {
  return raw.split('\n').flatMap((line) => { const match = line.match(/^(##|###)\s+(.+)/); return match ? [{level: match[1].length, label: match[2], id: match[2].toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-')}] : []; });
}

async function article(id) {
  const doc = documents.find((item) => item.id === id) || documents[0];
  const raw = await loadDocument(doc);
  document.title = `${doc.title} — Sumter Field Desk`;
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
  try { app.innerHTML = route.view === 'doc' ? await article(route.id) : home(); }
  catch (error) { app.innerHTML = `<div class="fatal"><b>The research desk could not open.</b><p>${escapeHtml(error.message)}</p><p>Run the included local server instead of opening index.html directly.</p></div>`; }
  bind();
  if (route.view === 'doc') scrollTo({top: 0, behavior: 'auto'});
  if (searchOpen) requestAnimationFrame(() => document.querySelector('#search-input')?.focus());
}

function bind() {
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', () => { searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc}); }));
  document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => setRoute({view: 'home'})));
  document.querySelectorAll('[data-search]').forEach((button) => button.addEventListener('click', async () => {
    await Promise.all(documents.map((doc) => loadDocument(doc).catch(() => ''))); searchOpen = true; render();
  }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {searchOpen = false; render();}));
  document.querySelector('[data-overlay]')?.addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) {searchOpen = false; render();} });
  document.querySelector('#search-input')?.addEventListener('input', (event) => { document.querySelector('#search-results').innerHTML = searchResults(event.target.value); bindSearchResults(); });
  bindSearchResults();
  document.querySelectorAll('[data-anchor]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.anchor)?.scrollIntoView({behavior: 'smooth', block: 'start'})));
}

function bindSearchResults() { document.querySelectorAll('#search-results [data-doc]').forEach((button) => button.addEventListener('click', () => {searchOpen = false; setRoute({view: 'doc', id: button.dataset.doc});})); }

addEventListener('hashchange', readRoute);
addEventListener('keydown', async (event) => {
  if (event.key === 'Escape' && searchOpen) { searchOpen = false; render(); }
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); await Promise.all(documents.map((doc) => loadDocument(doc).catch(() => ''))); searchOpen = true; render(); }
});
readRoute();
