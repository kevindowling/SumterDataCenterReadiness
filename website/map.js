// Interactive site map for the proposed data center at 301 Brady Road.
//
// Every layer below is pulled live from the City of Americus & Sumter County
// public ArcGIS service — the same service behind the county's own public
// viewer — so the map shows the county's current record rather than a snapshot
// traced from a PDF exhibit. Nothing here is hand-drawn.

const GIS = 'https://ga31portal.kcsgis.com/ga31server/rest/services/Public';
const PUBLIC_LAYERS = `${GIS}/Public/MapServer`;
const PARCELS = `${GIS}/Sumter_Parcels/MapServer/1`;

// Parcel 64-17: 301 Brady Rd, 125.1 acres, zoned I (Industrial).
const SUBJECT_PARCEL_ID = ' 64     17';
const SITE = [32.04854, -84.20729]; // centroid of the parcel geometry

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
    css.href = './vendor/leaflet/leaflet.css';
    document.head.append(css);
    const script = document.createElement('script');
    script.src = './vendor/leaflet/leaflet.js';
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => reject(new Error('Could not load the map library.'));
    document.head.append(script);
  });
  return leafletReady;
}

// One ArcGIS query, returned as GeoJSON in WGS84.
async function queryLayer(url, {where = '1=1', outFields = '*', envelope} = {}) {
  const params = new URLSearchParams({where, outFields, outSR: '4326', f: 'geojson', returnGeometry: 'true'});
  if (envelope) {
    params.set('geometry', envelope);
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  const response = await fetch(`${url}/query?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'GIS query failed');
  return body;
}

// Bounding box roughly covering the 3-mile ring, so point and line layers come
// back small and fast instead of pulling the whole county.
const AREA = (() => {
  const dLat = 4828.032 / 111_320;
  const dLon = dLat / Math.cos((SITE[0] * Math.PI) / 180);
  return `${SITE[1] - dLon},${SITE[0] - dLat},${SITE[1] + dLon},${SITE[0] + dLat}`;
})();

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
// almost no care homes, so those two categories come from OpenStreetMap — the
// same source the county's own May 2025 exhibit credits for them.
const OVERPASS = 'https://overpass-api.de/api/interpreter';
async function overpassPoints(filters) {
  const around = `around:4828,${SITE[0]},${SITE[1]}`;
  const query = `[out:json][timeout:45];(${filters.map((f) => `nwr${f}(${around});`).join('')});out center tags;`;
  const response = await fetch(OVERPASS, {method: 'POST', body: new URLSearchParams({data: query})});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
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
// geometry's vertex order *is* downstream — so the arrows below follow the
// vertices rather than guessing from terrain.
const NHD_FLOWLINES = 'https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer/3';

// Web Mercator is conformal, so a bearing measured in projected space holds at
// every zoom — the arrows can be rotated once and never recomputed.
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
  const data = await queryLayer(NHD_FLOWLINES, {
    envelope: AREA, outFields: 'gnis_name,streamorde,flowdir,lengthkm',
  });
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
  return {group, lines: (data.features || []).length, arrows};
}

const LAYERS = [
  {
    name: 'FEMA flood zones', url: `${PUBLIC_LAYERS}/42`, on: true, clip: true, pane: 'flood',
    style: {color: '#1f6feb', weight: 1, fillColor: '#1f6feb', fillOpacity: 0.25},
    popup: (p) => `<b>Flood zone ${esc(clean(p.FLOODZONE))}</b>${popupTable([
      ['Special flood hazard area', p.SFHA === 'T' ? 'Yes' : 'No'],
      ['FIRM panel', p.FIRMPANEL],
    ])}<small>${esc(clean(p.LEGEND))}</small>`,
  },
  {
    name: 'Lakes, ponds & wetlands', url: `${PUBLIC_LAYERS}/19`, on: true, clip: true, pane: 'water',
    style: {color: '#0e7490', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.45},
    popup: (p) => `<b>${esc(clean(p.NAME) || clean(p.FEATURE) || 'Water body')}</b>${popupTable([
      ['Type', p.TYPE], ['Area (acres)', p.WATERAREA?.toFixed?.(1)],
    ])}`,
  },
  {
    // Off by default: 1,883 mostly unnamed lines that duplicate the NHD layer
    // above without carrying flow direction. Kept because it is the county's
    // own mapping.
    name: 'Creeks & streams (county)', url: `${PUBLIC_LAYERS}/18`, clip: true, pane: 'lines',
    style: {color: '#7aa7d9', weight: 2},
    popup: (p) => `<b>${esc(clean(p.NAME) || 'Stream or creek')}</b><small>County hydrology layer; no flow direction recorded.</small>`,
  },
  {
    name: 'Industrial areas', url: `${PUBLIC_LAYERS}/22`, clip: true, pane: 'industrial',
    style: {color: '#b45309', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.2},
    popup: (p) => `<b>${esc(clean(p.NAME) || 'Industrial area')}</b>${popupTable([
      ['Land use', p.LANDUSECODE], ['Square miles', p.SQUAREMILES?.toFixed?.(2)],
    ])}`,
  },
  {
    name: 'Schools', url: `${PUBLIC_LAYERS}/3`, on: true, clip: true, pane: 'points', marker: '#b9362c',
    popup: (p) => `<b>${esc(clean(p.Name) || clean(p.Schools) || 'School')}</b>${popupTable([
      ['Grades', p.Grades], ['Type', p.Education], ['Address', p.Address], ['Phone', p.Phone],
    ])}`,
  },
  {
    name: 'Hospitals & medical', url: `${PUBLIC_LAYERS}/2`, on: true, clip: true, pane: 'points', marker: '#0e7490',
    popup: (p) => `<b>${esc(clean(p.Name) || 'Medical facility')}</b>${popupTable([
      ['Address', p.Address], ['Community', p.Community], ['Open', p.OPERDAYS], ['Hours', p.OPERHOURS],
    ])}`,
  },
  {
    name: 'Churches (OSM)', overpass: ['["amenity"="place_of_worship"]'], on: true, pane: 'points', marker: '#8d6824',
    popup: (p) => `<b>${esc(clean(p.name) || 'Place of worship')}</b>${popupTable([
      ['Denomination', p.denomination], ['Address', [clean(p['addr:housenumber']), clean(p['addr:street'])].filter(Boolean).join(' ')],
    ])}<small>OpenStreetMap. The county POI layer does not map churches.</small>`,
  },
  {
    name: 'Care homes (OSM)', on: true, pane: 'points', marker: '#b45309',
    overpass: ['["amenity"="social_facility"]', '["amenity"="nursing_home"]', '["healthcare"~"nursing|hospice"]'],
    popup: (p) => `<b>${esc(clean(p.name) || 'Care facility')}</b>${popupTable([
      ['Type', p.social_facility || p.amenity || p.healthcare],
      ['Address', [clean(p['addr:housenumber']), clean(p['addr:street'])].filter(Boolean).join(' ')],
    ])}<small>OpenStreetMap coverage of care homes here is incomplete.</small>`,
  },
  {
    name: 'Parks & recreation', url: `${PUBLIC_LAYERS}/1`, on: true, clip: true, pane: 'points', marker: '#527553',
    filter: (p) => RECREATION.includes(clean(p.TYPE)),
    popup: (p) => `<b>${esc(clean(p.DESCRIP) || 'Park or recreation')}</b>${popupTable([
      ['Type', p.TYPE], ['Address', [clean(p.NUMBER_), clean(p.ADDRESS)].filter(Boolean).join(' ')],
    ])}`,
  },
  {
    name: 'Other landmarks', url: `${PUBLIC_LAYERS}/1`, clip: true, pane: 'points', marker: '#67695f',
    filter: (p) => !RECREATION.includes(clean(p.TYPE)),
    popup: (p) => `<b>${esc(clean(p.DESCRIP) || 'Point of interest')}</b>${popupTable([
      ['Type', p.TYPE], ['Address', [clean(p.NUMBER_), clean(p.ADDRESS)].filter(Boolean).join(' ')],
    ])}`,
  },
  // Districts are county-wide and few, so they are never clipped to the ring
  // area — a resident may live outside it and still need to find theirs.
  {name: 'Americus council districts', url: `${PUBLIC_LAYERS}/27`, pane: 'districts', district: COUNCIL, popup: districtPopup(COUNCIL)},
  {name: 'County commission districts', url: `${PUBLIC_LAYERS}/28`, pane: 'districts', district: COMMISSION, popup: districtPopup(COMMISSION)},
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

  const control = L.control.layers({Satellite: satellite, Streets: streets}, {}, {collapsed: false}).addTo(map);
  const addOverlay = (name, layer, on) => { control.addOverlay(layer, name); if (on) layer.addTo(map); };

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
    const parcel = await queryLayer(PARCELS, {
      where: `PARCELID = '${SUBJECT_PARCEL_ID.replace(/'/g, "''")}'`,
      outFields: 'PARCELID,TOTALACRES,FULLOWNERNAMES,SITEADDRESS,ZONING',
    });
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
    addOverlay(`Water flow direction (${flow.lines})`, flow.group, true);
  } catch {
    failures.push('water flow direction');
  }

  // --- Everything around it ------------------------------------------------
  await Promise.all(LAYERS.map(async (job) => {
    try {
      const data = job.overpass ? await overpassPoints(job.overpass) : await queryLayer(job.url, job.clip ? {envelope: AREA} : {});
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

  say(failures.length
    ? `Loaded from Sumter County GIS. These layers did not respond: ${failures.join(', ')}.`
    : 'All layers loaded live from the Sumter County GIS service.');

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
