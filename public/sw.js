/* eslint-env serviceworker */
// Azayon service worker — minimal, hand-rolled (no Workbox).
//
// Strategies:
//   navigate (HTML)        → network-first, fall back to cached '/' shell when offline
//   /api/*                 → network-only (data must be fresh; never cached)
//   /api/public/*/pdf      → network-only (large binary, customer-facing)
//   static assets          → cache-first with network fallback (long-cached, hashed in build)
//   /favicon.svg, manifest → stale-while-revalidate

const VERSION = 'azayon-v1';
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const ASSET_CACHE     = `assets-${VERSION}`;

const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![APP_SHELL_CACHE, ASSET_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to ask the SW to take over immediately after a deploy
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isAsset(req, url) {
  // Vite emits hashed filenames in /assets/. Add .svg/.png/.ico for icons.
  if (url.pathname.startsWith('/assets/')) return true;
  return req.destination === 'script' || req.destination === 'style' ||
         req.destination === 'image'  || req.destination === 'font';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache POST/PUT/DELETE
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: always go to network. If offline, return a structured 503 the client can detect.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: 'offline', code: 'OFFLINE' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Navigation requests: network-first, fall back to the cached app shell.
  // This is what makes the app installable and usable when starting offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        return (await cache.match('/')) || Response.error();
      })
    );
    return;
  }

  // Static assets: cache-first with network fallback. Build files are hashed
  // so updates land naturally on the next deploy via the new HTML shell.
  if (isAsset(req, url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});
