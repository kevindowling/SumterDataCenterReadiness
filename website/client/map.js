// Interactive site map for the proposed data center at 301 Brady Road.
//
// Every layer below comes from the City of Americus & Sumter County public
// ArcGIS service, the same service behind the county's own public viewer, so
// the map shows the county's current record rather than a snapshot traced from
// a PDF exhibit. Nothing here is hand-drawn.
//
// The requests themselves live in gis-sources.js, shared with the API server so
// both ask the county the same questions.
import {apiOrigin} from './auth.js';
import {GIS_SOURCES, OVERPASS, SITE, arcgisUrl, gisPayloadError, overpassQuery} from './gis-sources.js';

const RINGS = [
  {meters: 804.672, label: '½ mile', color: '#f2c018', homes: 420, people: 1008},
  {meters: 1609.344, label: '1 mile', color: '#e55726', homes: 1265, people: 3036},
  {meters: 4828.032, label: '3 miles', color: '#8a4fd3', homes: 4820, people: 11568},
];

// The GIS service carries each representative's name, but not their email.
// Emails are keyed by district number from the city's and county's own
// published contact sheets (current as of May 2025).
const COUNCIL = {
  title: 'Americus City Council',
  colors: ['#f2c018', '#1a6fd4', '#2f9e41', '#8a4fd3', '#f2701a', '#2fbfc4'],
  emails: ['tclemons@americusga.gov', 'nbrown@americusga.gov', 'kbowden@americusga.gov',
    'FCeresoli@americusga.gov', 'kpless@americusga.gov', 'ddowdell@americusga.gov'],
};
const COMMISSION = {
  title: 'Sumter County Commission',
  colors: ['#f2c018', '#1a6fd4', '#2f9e41', '#8a4fd3', '#f2701a'],
  emails: ['cjones@sumtercountyga.us', 'mwaddell@sumtercountyga.us', 'jreid@sumtercountyga.us',
    'dbaldwin@sumtercountyga.us', 'jsmith@sumtercountyga.us'],
};

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const clean = (value) => String(value ?? '').trim();

// Loads Leaflet from the vendored copy on first use, so the research desk never
// pays for a map the reader has not opened.
let leafletReady;
function loadLeaflet() {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    if (globalThis.L) { resolve(globalThis.L); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/assets/vendor/leaflet/leaflet.css';
    document.head.append(css);
    const script = document.createElement('script');
    script.src = '/assets/vendor/leaflet/leaflet.js';
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => reject(new Error('Could not load the map library.'));
    document.head.append(script);
  });
  return leafletReady;
}

// --- Where a layer comes from ----------------------------------------------
// Four places are tried in order, and the first that answers wins:
//
//   1. this browser's own copy, if less than a day old
//   2. /api/gis on the field desk server, which holds one copy for everyone
//   3. the county's ArcGIS service (or Overpass) directly
//   4. this browser's expired copy, however old, rather than an empty map
//
// Step 2 is what stops the county's server paying for a fresh set of queries
// per visitor, and it is the only step that can help a reader who has never
// opened the map before, steps 1 and 4 need a copy this device already has.
// Step 3 stays because the research desk is on GitHub Pages and must not go
// down with the API server.
//
// Kept in Cache Storage rather than localStorage: these payloads run to
// hundreds of kilobytes, past what localStorage will hold.
//
// v2: v1 could hold a poisoned entry. ArcGIS answers a failed query with HTTP
// 200 and an error in the body, and the old code cached anything with an ok
// status, so a bad moment upstream could be stored and then served for as long
// as the entry was kept. The name change evicts those without the reader
// needing to clear anything by hand.
const GIS_CACHE = 'field-desk-gis-v2';
const GIS_TTL = 24 * 60 * 60 * 1000;
// How long an expired copy is still worth keeping. The county has taken its
// whole ArcGIS service offline before, for longer than a day, and a boundary
// drawn three months ago is far better than a blank map. Only the age shown to
// the reader changes.
const GIS_KEEP = 90 * 24 * 60 * 60 * 1000;
const CACHED_AT = 'x-field-desk-cached-at';

const cacheStore = async () => {
  try { return 'caches' in globalThis ? await caches.open(GIS_CACHE) : null; }
  catch { return null; } // unavailable outside a secure context
};

const freshness = (response) => Date.now() - Number(response?.headers.get(CACHED_AT) || 0);

// Both upstreams fail transiently: Overpass returns a 504 under load often
// enough to lose a layer on any given page load, and the county's ArcGIS box
// drops connections. One stumble should not cost the reader a layer, so try a
// few times with a widening pause. A 404 or a bad query will not fix itself on
// a retry, so only server-side and rate-limit failures are worth repeating.
async function fetchWithRetry(url, init, attempts = 3) {
  let failure;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      failure = new Error(`HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      failure = error;
    }
    if (attempt < attempts - 1) await new Promise((resume) => setTimeout(resume, 400 * 2 ** attempt));
  }
  throw failure;
}

// Keyed on the layer id, not the upstream URL, so a copy fetched through the
// field desk server and one fetched straight from the county occupy the same
// slot, and an Overpass POST, which Cache Storage will not key on at all, gets
// a slot like everything else.
const cacheKey = (id) => `https://field-desk.invalid/gis/${id}`;

async function readCache(id) {
  const store = await cacheStore();
  if (!store) return null;
  return (await store.match(new Request(cacheKey(id)))) || null;
}

async function writeCache(id, text) {
  const store = await cacheStore();
  if (!store) return;
  await store.put(new Request(cacheKey(id)), new Response(text, {
    status: 200,
    headers: {'Content-Type': 'application/json; charset=utf-8', [CACHED_AT]: String(Date.now())},
  }));
}

// Nothing is stored until it has parsed and passed gisPayloadError, so an
// error body can never take the place of a layer. This is the check v1 lacked.
function parsePayload(source, text) {
  let body;
  try { body = JSON.parse(text); } catch { throw new Error('response was not JSON'); }
  const problem = gisPayloadError(source, body);
  if (problem) throw new Error(problem);
  if (!source.overpass) return body;
  // Overpass speaks its own JSON; everything downstream expects GeoJSON.
  return {
    type: 'FeatureCollection',
    features: (body.elements || []).map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      return lat == null ? null : {
        type: 'Feature',
        geometry: {type: 'Point', coordinates: [lon, lat]},
        properties: element.tags || {},
      };
    }).filter(Boolean),
  };
}

// One layer, from the best source that answers. See the note above GIS_CACHE
// for the order and why each step is there.
async function loadSource(id) {
  const source = GIS_SOURCES[id];
  const hit = await readCache(id);
  if (hit && freshness(hit) < GIS_TTL) {
    return {data: parsePayload(source, await hit.text()), source: {from: 'cache', age: freshness(hit)}};
  }

  const routes = [
    // One attempt only: a field desk server that is down or has no database
    // should cost a moment, not three rounds of backoff, because the county's
    // own service is right behind it.
    {from: 'proxy', attempts: 1, run: () => fetchWithRetry(`${apiOrigin()}/api/gis?layer=${encodeURIComponent(id)}`, {}, 1)},
    {from: 'network', run: () => (source.overpass
      ? fetchWithRetry(OVERPASS, {method: 'POST', body: new URLSearchParams({data: overpassQuery(source.overpass)})})
      : fetchWithRetry(arcgisUrl(source)))},
  ];

  let failure;
  for (const route of routes) {
    try {
      const response = await route.run();
      const text = await response.text();
      const data = parsePayload(source, text); // throws before anything is stored
      await writeCache(id, text);
      // The server reports how old its own copy is; a direct fetch is new.
      const age = route.from === 'proxy' ? Number(response.headers.get('x-gis-age-ms') || 0) : 0;
      return {data, source: {from: route.from, age}};
    } catch (error) {
      failure = error;
    }
  }

  // Every route failed. An expired copy beats an empty map.
  if (hit) {
    try {
      return {data: parsePayload(source, await hit.text()), source: {from: 'stale', age: freshness(hit)}};
    } catch { /* the stored copy is unusable too; report the network failure */ }
  }
  throw failure || new Error(`${id} could not be loaded`);
}

// Drops entries well past their keep window so the cache cannot grow without
// bound. Runs only once the upstream has actually answered something this
// load: during an outage the expired copy is the only copy there is, and
// deleting it would empty the map for as long as the county stays down.
async function pruneCache(upstreamAnswered) {
  const store = await cacheStore();
  if (!store || !upstreamAnswered) return;
  for (const request of await store.keys()) {
    const entry = await store.match(request);
    if (entry && freshness(entry) > GIS_KEEP) await store.delete(request);
  }
}

// Layer 27 has DISTRICTID ("1"); layer 28 only has NAME ("District 3").
const districtNumber = (p) => {
  const raw = clean(p.DISTRICTID) || clean(p.NAME);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
};

function popupTable(rows) {
  const cells = rows.filter(([, value]) => clean(value)).map(([label, value]) =>
    `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join('');
  return cells ? `<table class="map-popup">${cells}</table>` : '';
}

const districtPopup = (config) => (p) => {
  const number = districtNumber(p);
  const email = number ? config.emails[number - 1] : '';
  return `<b>${esc(config.title)}</b>${popupTable([
    ['District', clean(p.NAME) || number],
    ['Representative', clean(p.REPNAME)],
    ['Population', p.POPULATION?.toLocaleString?.()],
    ['Residential addresses', p.RESADDRESSES?.toLocaleString?.()],
  ])}${email ? `<a class="map-mail" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}`;
};

// Points of interest arrive as one layer; these are the categories worth
// separating on a map about neighbourhood impact.
const RECREATION = ['Park', 'Community / Recreation Center', 'Sports Complex', 'Sports Arena / Stadium', 'Public Pool', 'Golf Course'];

// The county POI layer carries exactly one "House of Worship" countywide and
// almost no care homes, so those two categories come from OpenStreetMap, the
// same source the county's own May 2025 exhibit credits for them. Both are
// listed in gis-sources.js like everything else.

// Layers load in parallel, so without explicit panes a big filled polygon can
// land on top of the pins and swallow their clicks. Panes fix the stacking
// order regardless of which request finishes first: broad areas at the bottom,
// pins always on top.
const PANES = {
  districts: 405, flood: 410, industrial: 412, water: 415,
  lines: 425, flow: 427, parcel: 430, rings: 440, flowArrows: 445, points: 450,
};

// --- Which way the water runs ---------------------------------------------
// The county creek layer has FLOWDIR null on all 1,883 records, so direction
// comes from the USGS NHDPlus High Resolution flowlines instead. Every feature
// there reports flowdir = 1, "with digitized direction", which means the
// geometry's vertex order *is* downstream, so the arrows below follow the
// vertices rather than guessing from terrain.

// Web Mercator is conformal, so a bearing measured in projected space holds at
// every zoom. The arrows can be rotated once and never recomputed.
const MERCATOR_STRETCH = 1 / Math.cos((SITE[0] * Math.PI) / 180);
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function bearingLabel(L, from, to) {
  const a = L.CRS.EPSG3857.project(from);
  const b = L.CRS.EPSG3857.project(to);
  const degrees = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return COMPASS[Math.round(((degrees + 360) % 360) / 45) % 8];
}

// Walks a line's vertices and drops an arrow roughly every `spacing` ground
// metres, each rotated to that segment's on-screen heading.
function arrowsAlong(L, coords, spacing = 520) {
  const points = coords.map(([lon, lat]) => L.latLng(lat, lon));
  const projected = points.map((p) => L.CRS.EPSG3857.project(p));
  const threshold = spacing * MERCATOR_STRETCH;
  const out = [];
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = projected[i].x - projected[i - 1].x;
    const dy = projected[i].y - projected[i - 1].y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    travelled += length;
    if (travelled < threshold) continue;
    travelled = 0;
    out.push({
      latlng: L.latLng((points[i - 1].lat + points[i].lat) / 2, (points[i - 1].lng + points[i].lng) / 2),
      angle: (Math.atan2(-dy, dx) * 180) / Math.PI, // screen degrees, 0 = pointing east
    });
  }
  return out;
}

async function buildFlowLayer(L) {
  const {data, source} = await loadSource('flow');
  const group = L.layerGroup();
  let arrows = 0;

  for (const feature of data.features || []) {
    const p = feature.properties || {};
    if (p.flowdir !== 1) continue; // only draw lines whose vertex order is downstream
    const order = p.streamorde || 1;
    const geometry = feature.geometry || {};
    const parts = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates || []];

    for (const line of parts) {
      if (line.length < 2) continue;
      const latlngs = line.map(([lon, lat]) => [lat, lon]);
      const heading = bearingLabel(L, L.latLng(latlngs[0]), L.latLng(latlngs[latlngs.length - 1]));

      L.polyline(latlngs, {pane: 'flow', color: '#1f6feb', weight: Math.min(1 + order, 5), opacity: 0.9})
        .bindPopup(`<b>${esc(clean(p.gnis_name) || 'Unnamed stream')}</b>${popupTable([
          ['Flows', `${heading} (downstream)`],
          ['Stream order', order],
          ['Segment length', p.lengthkm ? `${p.lengthkm.toFixed(2)} km` : ''],
        ])}<small>USGS NHDPlus High Resolution. Arrows point downstream.</small>`)
        .addTo(group);

      // Arrows only on order-2 and larger, or the small headwater tributaries
      // bury the map in glyphs.
      if (order < 2 || arrows > 700) continue;
      for (const arrow of arrowsAlong(L, line)) {
        arrows += 1;
        L.marker(arrow.latlng, {
          pane: 'flowArrows', interactive: false, keyboard: false,
          icon: L.divIcon({
            className: 'flow-arrow-icon', iconSize: [16, 16], iconAnchor: [8, 8],
            html: `<i class="flow-arrow" style="transform:rotate(${arrow.angle.toFixed(1)}deg)"></i>`,
          }),
        }).addTo(group);
      }
    }
  }
  return {group, lines: (data.features || []).length, arrows, source};
}

// Only the rings and the parcel are on at first load. Everything else is a
// deliberate choice by the reader: switching on all fourteen at once buries
// the parcel the map exists to show.
const LAYERS = [
  {
    name: 'FEMA flood zones', source: 'flood', pane: 'flood',
    style: {color: '#1f6feb', weight: 1, fillColor: '#1f6feb', fillOpacity: 0.25},
    popup: (p) => `<b>Flood zone ${esc(clean(p.FLOODZONE))}</b>${popupTable([
      ['Special flood hazard area', p.SFHA === 'T' ? 'Yes' : 'No'],
      ['FIRM panel', p.FIRMPANEL],
    ])}<small>${esc(clean(p.LEGEND))}</small>`,
  },
  {
    name: 'Lakes, ponds & wetlands', source: 'water', pane: 'water',
    style: {color: '#0e7490', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.45},
    popup: (p) => `<b>${esc(clean(p.NAME) || clean(p.FEATURE) || 'Water body')}</b>${popupTable([
      ['Type', p.TYPE], ['Area (acres)', p.WATERAREA?.toFixed?.(1)],
    ])}`,
  },
  {
    // Off by default: 1,883 mostly unnamed lines that duplicate the NHD layer
    // above without carrying flow direction. Kept because it is the county's
    // own mapping.
    name: 'Creeks & streams (county)', source: 'creeks', pane: 'lines',
    style: {color: '#7aa7d9', weight: 2},
    popup: (p) => `<b>${esc(clean(p.NAME) || 'Stream or creek')}</b><small>County hydrology layer; no flow direction recorded.</small>`,
  },
  {
    name: 'Industrial areas', source: 'industrial', pane: 'industrial',
    style: {color: '#b45309', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.2},
    popup: (p) => `<b>${esc(clean(p.NAME) || 'Industrial area')}</b>${popupTable([
      ['Land use', p.LANDUSECODE], ['Square miles', p.SQUAREMILES?.toFixed?.(2)],
    ])}`,
  },
  {
    name: 'Schools', source: 'schools', pane: 'points', marker: '#b9362c',
    popup: (p) => `<b>${esc(clean(p.Name) || clean(p.Schools) || 'School')}</b>${popupTable([
      ['Grades', p.Grades], ['Type', p.Education], ['Address', p.Address], ['Phone', p.Phone],
    ])}`,
  },
  {
    name: 'Hospitals & medical', source: 'medical', pane: 'points', marker: '#0e7490',
    popup: (p) => `<b>${esc(clean(p.Name) || 'Medical facility')}</b>${popupTable([
      ['Address', p.Address], ['Community', p.Community], ['Open', p.OPERDAYS], ['Hours', p.OPERHOURS],
    ])}`,
  },
  {
    name: 'Churches (OSM)', source: 'churches', pane: 'points', marker: '#8d6824',
    popup: (p) => `<b>${esc(clean(p.name) || 'Place of worship')}</b>${popupTable([
      ['Denomination', p.denomination], ['Address', [clean(p['addr:housenumber']), clean(p['addr:street'])].filter(Boolean).join(' ')],
    ])}<small>OpenStreetMap. The county POI layer does not map churches.</small>`,
  },
  {
    name: 'Care homes (OSM)', source: 'careHomes', pane: 'points', marker: '#b45309',
    popup: (p) => `<b>${esc(clean(p.name) || 'Care facility')}</b>${popupTable([
      ['Type', p.social_facility || p.amenity || p.healthcare],
      ['Address', [clean(p['addr:housenumber']), clean(p['addr:street'])].filter(Boolean).join(' ')],
    ])}<small>OpenStreetMap coverage of care homes here is incomplete.</small>`,
  },
  {
    name: 'Parks & recreation', source: 'poi', pane: 'points', marker: '#527553',
    filter: (p) => RECREATION.includes(clean(p.TYPE)),
    popup: (p) => `<b>${esc(clean(p.DESCRIP) || 'Park or recreation')}</b>${popupTable([
      ['Type', p.TYPE], ['Address', [clean(p.NUMBER_), clean(p.ADDRESS)].filter(Boolean).join(' ')],
    ])}`,
  },
  {
    name: 'Other landmarks', source: 'poi', pane: 'points', marker: '#67695f',
    filter: (p) => !RECREATION.includes(clean(p.TYPE)),
    popup: (p) => `<b>${esc(clean(p.DESCRIP) || 'Point of interest')}</b>${popupTable([
      ['Type', p.TYPE], ['Address', [clean(p.NUMBER_), clean(p.ADDRESS)].filter(Boolean).join(' ')],
    ])}`,
  },
  // Districts are county-wide and few, so they are never clipped to the ring
  // area, a resident may live outside it and still need to find theirs.
  {name: 'Americus council districts', source: 'councilDistricts', pane: 'districts', district: COUNCIL, popup: districtPopup(COUNCIL)},
  {name: 'County commission districts', source: 'commissionDistricts', pane: 'districts', district: COMMISSION, popup: districtPopup(COMMISSION)},
];

export async function renderSiteMap(container, onStatus) {
  const L = await loadLeaflet();
  const say = (message) => onStatus?.(message);

  const map = L.map(container, {center: SITE, zoom: 13, scrollWheelZoom: true});
  for (const [name, zIndex] of Object.entries(PANES)) map.createPane(name).style.zIndex = String(zIndex);

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
  const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
  satellite.addTo(map);

  // Fourteen overlays make an always-open panel taller than a phone screen.
  // Leaflet's own `collapsed` mode expands on hover, which never reads as a
  // real toggle and cannot be closed again on a wide screen, so the list is
  // always built open and driven by an explicit button instead. It starts
  // closed on narrow screens and open where there is room, and after that it
  // does what the reader last told it to.
  const control = L.control.layers({Satellite: satellite, Streets: streets}, {}, {collapsed: false}).addTo(map);
  const panel = control.getContainer();
  const list = panel.querySelector('.leaflet-control-layers-list');

  const toggle = L.DomUtil.create('button', 'layer-toggle');
  toggle.type = 'button';
  panel.prepend(toggle);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  let activeCount = 0;
  let open = matchMedia('(min-width: 900px)').matches;

  const paint = () => {
    panel.classList.toggle('is-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-controls', 'map-layer-list');
    toggle.innerHTML = `<span>LAYERS${activeCount ? ` · ${activeCount}` : ''}</span><i aria-hidden="true">${open ? '×' : '+'}</i>`;
  };
  if (list) list.id = 'map-layer-list';
  L.DomEvent.on(toggle, 'click', (event) => { L.DomEvent.stop(event); open = !open; paint(); });
  paint();

  // Register with the control first, so adding the layer to the map raises
  // `overlayadd` and the counter stays in one place.
  const addOverlay = (name, layer, on) => {
    control.addOverlay(layer, name);
    if (on) layer.addTo(map);
  };
  map.on('overlayadd', () => { activeCount += 1; paint(); });
  map.on('overlayremove', () => { activeCount -= 1; paint(); });

  // Counted per layer, not per request, so the note under the map can say
  // exactly how much of what the reader is looking at is today's record and
  // how much is an older copy standing in for a server that did not answer.
  const sources = {network: 0, proxy: 0, cache: 0, stale: 0};
  let oldestStale = 0;
  let oldestProxy = 0;
  const noteSource = ({from, age}) => {
    sources[from] += 1;
    if (from === 'stale') oldestStale = Math.max(oldestStale, age);
    if (from === 'proxy') oldestProxy = Math.max(oldestProxy, age);
  };

  // --- Distance rings: true geodesic circles in metres, not traced ----------
  const ringLayer = L.layerGroup();
  for (const ring of RINGS) {
    L.circle(SITE, {pane: 'rings', radius: ring.meters, color: ring.color, weight: 3, dashArray: '10 7', fill: false})
      .bindPopup(`<b>${ring.label} from the parcel</b>${popupTable([
        ['Estimated homes', ring.homes.toLocaleString()],
        ['Estimated residents', ring.people.toLocaleString()],
      ])}<small>Counts from the May 2025 Sumter County GIS residential analysis (2.4 persons per household).</small>`)
      .addTo(ringLayer);
  }
  addOverlay('½ / 1 / 3 mile rings', ringLayer, true);

  // --- Subject parcel ------------------------------------------------------
  try {
    const {data: parcel, source} = await loadSource('parcel');
    noteSource(source);
    const layer = L.geoJSON(parcel, {
      pane: 'parcel',
      style: {color: '#22d3ee', weight: 4, fillColor: '#22d3ee', fillOpacity: 0.25},
      onEachFeature: (feature, target) => {
        const p = feature.properties || {};
        target.bindPopup(`<b>Subject parcel</b>${popupTable([
          ['Parcel ID', clean(p.PARCELID).replace(/\s+/g, '-') || '64-17'],
          ['Address', p.SITEADDRESS],
          ['Acres', p.TOTALACRES],
          ['Zoning', p.ZONING],
          ['Owner of record', p.FULLOWNERNAMES],
        ])}<small>Live from the Sumter County tax parcel layer.</small>`);
      },
    });
    addOverlay('Subject parcel (64-17)', layer, true);
    map.fitBounds(layer.getBounds().pad(3.2));
  } catch (error) {
    say(`The parcel outline did not load (${error.message}). Rings are still drawn from its recorded centre.`);
  }

  // --- Which way the water runs --------------------------------------------
  const failures = [];
  try {
    const flow = await buildFlowLayer(L);
    noteSource(flow.source);
    addOverlay(`Water flow direction (${flow.lines})`, flow.group, false);
  } catch {
    failures.push('water flow direction');
  }

  // --- Everything around it ------------------------------------------------
  await Promise.all(LAYERS.map(async (job) => {
    try {
      const {data, source} = await loadSource(job.source);
      noteSource(source);
      if (job.filter) data.features = (data.features || []).filter((f) => job.filter(f.properties || {}));
      const layer = L.geoJSON(data, {
        pane: job.pane,
        style: (feature) => {
          if (!job.district) return job.style;
          const color = job.district.colors[(districtNumber(feature.properties || {}) || 1) - 1] || '#67695f';
          return {color, weight: 2, fillColor: color, fillOpacity: 0.3};
        },
        pointToLayer: (feature, latlng) => L.circleMarker(latlng,
          {pane: job.pane, radius: 6, color: '#fff', weight: 2, fillColor: job.marker || '#171a18', fillOpacity: 1}),
        onEachFeature: (feature, target) => target.bindPopup(job.popup(feature.properties || {})),
      });
      addOverlay(`${job.name} (${(data.features || []).length})`, layer, job.on);
    } catch {
      failures.push(job.name);
    }
  }));

  // Say plainly where each layer came from. Lumping these together was
  // misleading during the county's outage: one cached layer made the map claim
  // everything was an hour-old local copy while the rest had failed outright.
  const describeAge = (ms) => {
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 1) return 'under an hour old';
    if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} old`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} old`;
  };
  const parts = [];
  if (sources.network) parts.push(`${sources.network} fetched now from the county service`);
  if (sources.proxy) parts.push(`${sources.proxy} from the field desk's shared copy (${describeAge(oldestProxy)})`);
  if (sources.cache) parts.push(`${sources.cache} from today's copy on this device`);
  if (sources.stale) parts.push(`${sources.stale} from an older copy on this device (${describeAge(oldestStale)}), because nothing else answered`);
  say([
    parts.length ? `Layers: ${parts.join('; ')}.` : '',
    failures.length
      ? `These did not respond and there is no local copy to fall back on: ${failures.join(', ')}.`
      : 'Every layer loaded.',
  ].filter(Boolean).join(' '));
  pruneCache(sources.network + sources.proxy > 0);

  // --- "Am I inside a ring?" -----------------------------------------------
  let youMarker = null;
  async function locateAddress(query) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({q: `${query}, Sumter County, Georgia`, format: 'jsonv2', limit: '1'});
    const response = await fetch(url, {headers: {Accept: 'application/json'}});
    if (!response.ok) throw new Error('Address lookup is unavailable right now.');
    const [hit] = await response.json();
    if (!hit) throw new Error('That address was not found near Americus.');

    const point = L.latLng(Number(hit.lat), Number(hit.lon));
    const meters = point.distanceTo(L.latLng(SITE));
    const miles = meters / 1609.344;
    const inside = RINGS.find((ring) => meters <= ring.meters);

    youMarker?.remove();
    youMarker = L.marker(point).addTo(map).bindPopup(`<b>${esc(hit.display_name.split(',').slice(0, 2).join(','))}</b>${popupTable([
      ['Distance to the parcel', `${miles.toFixed(2)} miles`],
      ['Ring', inside ? `inside the ${inside.label} ring` : 'outside the 3 mile ring'],
    ])}`).openPopup();
    map.setView(point, Math.max(map.getZoom(), 14));

    return {miles, label: inside ? `inside the ${inside.label} ring` : 'outside the 3 mile ring'};
  }

  L.control.scale({imperial: true, metric: false}).addTo(map);
  return {map, locateAddress, destroy: () => map.remove()};
}

export {RINGS, SITE};
