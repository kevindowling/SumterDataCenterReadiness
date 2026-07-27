// Service worker for the Sumter Field Desk.
//
// Deliberately conservative about what it caches. The research notes and the
// app shell are worth having offline; live data is not. Anything the desk
// reports must be current, so GIS queries, Auth0, and every /api/* call go to
// the network and are never stored.
const VERSION = 'field-desk-v8';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './map.js',
  './auth.js',
  './auth-config.js',
  './content.js',
  './petition.js',
  './styles.css',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/seal.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
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
// and tile services. The GIS is not uncached — map.js keeps those responses in
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

self.addEventListener('fetch', (event) => {
  const {request} = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isLive(url)) return;                       // straight to the network
  if (url.origin !== self.location.origin) return;

  // Research notes: network first so corrections show up immediately, with the
  // cached copy as the offline fallback.
  if (url.pathname.includes('/research/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  // App shell: cache first, refreshed in the background.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
      return response;
    }).catch(() => null);

    if (cached) { network.catch(() => {}); return cached; }
    const response = await network;
    if (response) return response;
    // A navigation with nothing cached still gets the shell if we have it.
    return request.mode === 'navigate'
      ? (await caches.match('./index.html')) || Response.error()
      : Response.error();
  })());
});
