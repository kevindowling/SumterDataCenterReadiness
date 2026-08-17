// Service worker for the Sumter Field Desk.
//
// Deliberately conservative about what it caches. The research notes and the
// app shell are worth having offline; live data is not. Anything the desk
// reports must be current, so GIS queries, Auth0, and every /api/* call go to
// the network and are never stored.
// Bump this on ANY change to app.js, sw.js, or the shell list, not only when
// URLs move. The shell is served cache-first, so without a bump a returning
// reader runs the previous app.js for one more visit. That is invisible for a
// wording change and badly wrong for a new route: the deploy that added
// /meetings/ served the new prerendered HTML to a cached app.js that had no
// such route, so the router fell through and rendered the home page at the
// /meetings/ URL. Anyone who had ever opened the site saw it; a first-time
// visitor saw the calendar. Reproduce by loading the old build, deploying the
// new one to the same origin, and opening the new route.
const VERSION = 'field-desk-v10';
// Rooted, not './'-relative. This file has to stay at the site root to claim
// scope '/', but the assets it caches now live under /client and /assets.
const SHELL = [
  '/',
  '/index.html',
  '/client/app.js',
  '/client/map.js',
  '/client/auth.js',
  '/client/auth-config.js',
  '/client/content.js',
  '/client/petition.js',
  '/client/contacts.js',
  '/client/meetings.js',
  '/client/meetings-data.js',
  // Both of these are imported but were missing here, which made the offline
  // promise false in the one case it matters: a reader who has visited exactly
  // once. app.js imports install.js at the top, so offline that import failed
  // and the whole module died, shell served from cache, #app empty, blank
  // page. It went unnoticed because a second visit caches them at runtime, and
  // every manual test had made more than one. Keep this list in step with the
  // imports; check.mjs already lists both files.
  '/client/install.js',
  '/client/gis-sources.js',
  '/assets/styles.css',
  '/assets/fonts.css',
  // Only the latin subsets are precached. The latin-ext and vietnamese files
  // are declared in fonts.css with their unicode-range and fetched on demand,
  // which for this site's text means never.
  '/assets/fonts/newsreader-latin.woff2',
  '/assets/fonts/dm-mono-400-latin.woff2',
  '/assets/fonts/dm-mono-500-latin.woff2',
  '/assets/manifest.webmanifest',
  '/assets/favicon.svg',
  '/assets/icons/seal.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/vendor/leaflet/leaflet.js',
  '/assets/vendor/leaflet/leaflet.css',
  '/assets/vendor/leaflet/images/marker-icon.png',
  '/assets/vendor/leaflet/images/marker-icon-2x.png',
  '/assets/vendor/leaflet/images/marker-shadow.png',
  '/assets/vendor/leaflet/images/layers.png',
  '/assets/vendor/leaflet/images/layers-2x.png',
];

self.addEventListener('install', (event) => {
  // addAll fails the whole install if any entry 404s, so add individually and
  // let a missing optional asset be filled in later by the fetch handler.
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Never cache here: anything that belongs to someone's session, plus the GIS
// and tile services. The GIS is not uncached, map.js keeps those responses in
// its own store with a 24-hour expiry, so it owns that policy rather than
// splitting it across two files.
const isLive = (url) =>
  url.pathname.startsWith('/api/') ||
  /(^|\.)auth0\.com$/.test(url.hostname) ||
  /(^|\.)kcsgis\.com$/.test(url.hostname) ||
  /(^|\.)nationalmap\.gov$/.test(url.hostname) ||
  /(^|\.)openstreetmap\.org$/.test(url.hostname) ||
  /(^|\.)arcgisonline\.com$/.test(url.hostname) ||
  /(^|\.)overpass-api\.de$/.test(url.hostname);

// What a deploy can change the meaning of: the pages, the router, and the
// stylesheet that lays them out. These go to the network first, because
// cache-first served them one deploy behind, harmless for a wording change,
// wrong for anything structural. A reader whose cached app.js predated the
// /meetings/ route was handed the new prerendered page and rendered the home
// view over it, at the /meetings/ URL. Icons, fonts and the vendored Leaflet
// copy stay cache-first below: those are replaced, not revised.
const isAppCode = (url, request) =>
  request.mode === 'navigate' ||
  url.pathname.startsWith('/client/') ||
  url.pathname === '/assets/styles.css';

// Network first, cache as the offline fallback.
async function fresh(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // A navigation with nothing cached still gets the shell if we have it.
    return request.mode === 'navigate'
      ? (await caches.match('/index.html')) || Response.error()
      : Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const {request} = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isLive(url)) return;                       // straight to the network
  if (url.origin !== self.location.origin) return;

  // Research notes: network first so corrections show up immediately. Same
  // policy as the app code, for the same reason.
  if (url.pathname.includes('/research/') || isAppCode(url, request)) {
    event.respondWith(fresh(request));
    return;
  }

  // Everything else: cache first, refreshed in the background.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
      return response;
    }).catch(() => null);

    if (cached) { network.catch(() => {}); return cached; }
    return (await network) || Response.error();
  })());
});
