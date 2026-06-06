const CACHEABLE_STATIC_PREFIXES = ['/icons/', '/_next/static/'] as const

const CACHEABLE_STATIC_PATHS = [
  '/favicon.ico',
  '/icon.svg',
  '/manifest.webmanifest',
  '/apple-touch-icon.png'
] as const

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
] as const

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
] as const

export interface ServiceWorkerCacheDecisionInput {
  method?: string
  url: string
  origin?: string
}

function parseUrl(input: ServiceWorkerCacheDecisionInput): URL | null {
  try {
    return new URL(input.url, input.origin ?? 'https://morphic.local')
  } catch {
    return null
  }
}

function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function hasCacheableExtension(pathname: string): boolean {
  return CACHEABLE_EXTENSIONS.some(extension => pathname.endsWith(extension))
}

function isExplicitStaticPath(pathname: string): boolean {
  return CACHEABLE_STATIC_PATHS.includes(
    pathname as (typeof CACHEABLE_STATIC_PATHS)[number]
  )
}

function isStaticPrefixPath(pathname: string): boolean {
  return CACHEABLE_STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function shouldCacheServiceWorkerRequest(
  input: ServiceWorkerCacheDecisionInput
): boolean {
  const method = input.method ?? 'GET'
  if (method.toUpperCase() !== 'GET') return false

  const url = parseUrl(input)
  if (!url) return false

  if (input.origin && url.origin !== input.origin) return false

  if (isSensitivePath(url.pathname)) return false

  if (isExplicitStaticPath(url.pathname)) return true

  if (isStaticPrefixPath(url.pathname) && hasCacheableExtension(url.pathname)) {
    return true
  }

  return false
}

export function shouldBypassServiceWorkerRequest(
  input: ServiceWorkerCacheDecisionInput
): boolean {
  return !shouldCacheServiceWorkerRequest(input)
}
