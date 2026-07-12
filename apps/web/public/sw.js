/* Hexalyte offline service worker — caches app shell and static assets */
const VERSION = 'hexalyte-v3'
const STATIC_CACHE = `${VERSION}-static`
const PAGES_CACHE = `${VERSION}-pages`
const PRECACHE_URLS = ['/offline.html', '/logo.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('hexalyte-') && key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  )
})

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname === '/logo.png' ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff2')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API calls — handled by app offline queue / error UI
  if (url.pathname.startsWith('/api/')) return

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request))
    return
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request, url))
  }
})

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return cached || Response.error()
  }
}

async function networkFirstPage(request, url) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    const exact = await cache.match(request)
    if (exact) return exact

    const pathRequest = new Request(url.origin + url.pathname, { mode: 'navigate' })
    const pathHit = await cache.match(pathRequest)
    if (pathHit) return pathHit

    const dashboard = await cache.match('/dashboard')
    if (dashboard) return dashboard

    const offline = await cache.match('/offline.html')
    if (offline) return offline

    return new Response('Offline — open Hexalyte while online first, then retry.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
