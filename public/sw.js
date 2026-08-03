// TeenMind Research — Service Worker
// Basic offline caching for PWA support

// BUG FIX: CACHE_NAME never changed between deploys, and the fetch handler
// served '/' (the Next.js HTML app shell) cache-first. Since the app shell
// is what references the current build's hashed JS chunk filenames, caching
// it cache-first meant returning visitors could be stuck on an old build
// FOREVER after a redeploy — new code on the server, but the browser never
// re-fetches the HTML that would point to it. Bumping the version here
// forces one immediate cache purge for everyone currently stuck on v1.
const CACHE_NAME = 'teenmind-v2'
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first for API requests and for navigation/HTML documents (the
// app shell) — always try to get the latest from the server first, only
// falling back to cache when truly offline. This is what guarantees a
// redeploy actually reaches returning users. Cache-first is kept only for
// hashed, immutable static assets (Next.js build chunks, images, fonts),
// where the filename itself changes whenever the content changes, so a
// stale cache entry is never actually stale.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // API requests: always network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
    return
  }

  // Navigation requests (the HTML document itself): always network-first,
  // so a new deploy is picked up on next load instead of being masked by
  // a cached app shell pointing at old JS chunks.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Everything else (hashed static assets): cache-first is safe here.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => cached)
    })
  )
})

