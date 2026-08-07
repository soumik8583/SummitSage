'use strict';

/**
 * Summit Sage — Service Worker (PWA offline support).
 *
 * Strategy:
 *   • Navigations (HTML pages)  → network-first, fall back to cache, then /offline.html.
 *   • Same-origin static assets → stale-while-revalidate (fast, self-updating).
 *   • /api/* requests           → never handled here (always go to the network,
 *                                  so admin data & submissions are always fresh).
 *   • Cross-origin (fonts CDN, Google) → passed through to the network.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next deploy.
 */

const CACHE_VERSION = 'v2';
const CACHE = 'summitsage-' + CACHE_VERSION;

const PRECACHE = [
  '/',
  '/offline.html',
  '/css/styles.css',
  '/js/theme.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Only handle same-origin requests; let everything else hit the network.
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic — always fresh.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: network-first with offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
