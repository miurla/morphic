const CACHE_VERSION = 'morphic-static-v1'
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-any.svg',
  '/icons/icon-maskable.svg'
]

const CACHEABLE_STATIC_PREFIXES = ['/icons/', '/_next/static/']
const CACHEABLE_STATIC_PATHS = new Set([
  '/favicon.ico',
  '/icon.svg',
  '/manifest.webmanifest',
  '/apple-touch-icon.png'
])
const CACHEABLE_EXTENSIONS = [
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.png',
  '.svg',
  '.webp',
  '.woff',
  '.woff2'
]
const SENSITIVE_PATH_PREFIXES = [
  '/api/',
  '/auth',
  '/login',
  '/settings',
  '/search',
  '/api/upload',
  '/api/chat',
  '/api/auth',
  '/api/history'
]

function hasCacheableExtension(pathname) {
  return CACHEABLE_EXTENSIONS.some(extension => pathname.endsWith(extension))
}

function isSensitivePath(pathname) {
  return SENSITIVE_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isCacheableStaticPath(pathname) {
  if (CACHEABLE_STATIC_PATHS.has(pathname)) return true

  return CACHEABLE_STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix)) &&
    hasCacheableExtension(pathname)
}

function shouldCacheRequest(request) {
  if (request.method !== 'GET') return false

  let url
  try {
    url = new URL(request.url)
  } catch {
    return false
  }

  if (url.origin !== self.location.origin) return false
  if (isSensitivePath(url.pathname)) return false

  return isCacheableStaticPath(url.pathname)
}

async function cacheStaticAssets() {
  const cache = await caches.open(CACHE_VERSION)
  await cache.addAll(STATIC_ASSETS)
}

async function deleteOldCaches() {
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter(key => key !== CACHE_VERSION)
      .map(key => caches.delete(key))
  )
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('install', event => {
  event.waitUntil(cacheStaticAssets())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const { request } = event

  if (!shouldCacheRequest(request)) {
    return
  }

  event.respondWith(cacheFirst(request))
})
