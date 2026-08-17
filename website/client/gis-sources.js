// The catalogue of upstream GIS requests the map makes, shared by the browser
// (map.js) and the API server (server.mjs).
//
// It lives in its own file for one reason: `/api/gis` is a public endpoint, so
// it must never take a URL from the caller. It takes a short id from this table
// instead and builds the upstream request itself. Anything not listed here
// cannot be fetched through the server, which is what keeps a cache from being
// an open proxy.
//
// Both sides reading the same table also stops them drifting: a layer added to
// map.js without a matching entry simply has no id to ask for.

const GIS = 'https://ga31portal.kcsgis.com/ga31server/rest/services/Public';
const PUBLIC_LAYERS = `${GIS}/Public/MapServer`;
const PARCELS = `${GIS}/Sumter_Parcels/MapServer/1`;

// USGS, not the county: the county creek layer has FLOWDIR null on all 1,883
// records, so direction has to come from NHDPlus.
const NHD_FLOWLINES = 'https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer/3';

export const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Parcel 64-17: 301 Brady Rd, 125.1 acres, zoned I (Industrial).
//
// 125.1 is the county's tax-record acreage. The 2026 retracement survey and the
// recorded deed both describe 102 acres; the March 2026 Authority minutes call
// it "125/103 Acres". The map shows the county's parcel geometry, so its figure
// is the one quoted here. See research/09-development-agreement.md.
export const SUBJECT_PARCEL_ID = ' 64     17';
export const SITE = [32.04854, -84.20729]; // centroid of the parcel geometry

// Bounding box roughly covering the 3-mile ring, so point and line layers come
// back small and fast instead of pulling the whole county.
export const AREA = (() => {
  const dLat = 4828.032 / 111_320;
  const dLon = dLat / Math.cos((SITE[0] * Math.PI) / 180);
  return `${SITE[1] - dLon},${SITE[0] - dLat},${SITE[1] + dLon},${SITE[0] + dLat}`;
})();

// `clip: true` limits the query to AREA. Districts are county-wide and few, so
// they are never clipped, a resident may live outside the rings and still need
// to find theirs.
export const GIS_SOURCES = {
  parcel: {
    arcgis: PARCELS,
    where: `PARCELID = '${SUBJECT_PARCEL_ID.replace(/'/g, "''")}'`,
    outFields: 'PARCELID,TOTALACRES,FULLOWNERNAMES,SITEADDRESS,ZONING',
  },
  flow: {arcgis: NHD_FLOWLINES, clip: true, outFields: 'gnis_name,streamorde,flowdir,lengthkm'},
  flood: {arcgis: `${PUBLIC_LAYERS}/42`, clip: true},
  water: {arcgis: `${PUBLIC_LAYERS}/19`, clip: true},
  creeks: {arcgis: `${PUBLIC_LAYERS}/18`, clip: true},
  industrial: {arcgis: `${PUBLIC_LAYERS}/22`, clip: true},
  schools: {arcgis: `${PUBLIC_LAYERS}/3`, clip: true},
  medical: {arcgis: `${PUBLIC_LAYERS}/2`, clip: true},
  poi: {arcgis: `${PUBLIC_LAYERS}/1`, clip: true}, // split into parks and landmarks client-side
  councilDistricts: {arcgis: `${PUBLIC_LAYERS}/27`},
  commissionDistricts: {arcgis: `${PUBLIC_LAYERS}/28`},
  churches: {overpass: ['["amenity"="place_of_worship"]']},
  careHomes: {overpass: ['["amenity"="social_facility"]', '["amenity"="nursing_home"]', '["healthcare"~"nursing|hospice"]']},
};

// One ArcGIS query as a URL. Built the same way on both sides so the server's
// stored copy is byte-identical to what a browser would have fetched directly.
export function arcgisUrl(source) {
  const params = new URLSearchParams({
    where: source.where || '1=1',
    outFields: source.outFields || '*',
    outSR: '4326', f: 'geojson', returnGeometry: 'true',
  });
  if (source.clip) {
    params.set('geometry', AREA);
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  return `${source.arcgis}/query?${params}`;
}

export function overpassQuery(filters) {
  const around = `around:4828,${SITE[0]},${SITE[1]}`;
  return `[out:json][timeout:45];(${filters.map((filter) => `nwr${filter}(${around});`).join('')});out center tags;`;
}

// ArcGIS answers a failed query with HTTP 200 and an error in the body, and
// Overpass can return an HTML error page with the same status. Storing either
// as if it were data poisons the cache for as long as the entry is kept, so
// both sides check the parsed body before writing it anywhere.
export function gisPayloadError(source, body) {
  if (!body || typeof body !== 'object') return 'response was not a JSON object';
  if (body.error) return String(body.error.message || 'upstream reported an error');
  if (source.overpass) return Array.isArray(body.elements) ? '' : 'Overpass response had no elements array';
  return Array.isArray(body.features) ? '' : 'GeoJSON response had no features array';
}
