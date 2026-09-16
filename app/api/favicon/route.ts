import {
  DEFAULT_FAVICON_SIZE,
  isFaviconSize,
  normalizeFaviconDomain
} from '@/lib/utils/favicon'
import { safeFetch } from '@/lib/utils/safe-fetch'

export const runtime = 'nodejs'

const DEFAULT_PROVIDER_URL =
  'https://www.google.com/s2/favicons?domain={domain}&sz={size}'

const MAX_BYTES = 100 * 1024
const UPSTREAM_TIMEOUT_MS = 5000
const HIT_TTL_MS = 24 * 60 * 60 * 1000
const MISS_TTL_MS = 10 * 60 * 1000
const MAX_CACHE_ENTRIES = 512
// The cache only bounds finished entries, so a burst of never-seen domains
// would otherwise open as many upstream requests as it likes.
const MAX_CONCURRENT_LOADS = 8

// SVG is left out on purpose: it is served from our own origin here, where an
// icon carrying script would run as us.
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon'
])

type CacheEntry = {
  expiresAt: number
  body: ArrayBuffer | null
  contentType: string
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<CacheEntry>>()

function providerTemplate(): string | null {
  const configured = process.env.FAVICON_PROVIDER_URL?.trim()
  if (configured === undefined || configured === '') return DEFAULT_PROVIDER_URL
  if (configured.toLowerCase() === 'off') return null
  return configured
}

function providerUrl(template: string, domain: string, size: number): string {
  return template
    .replaceAll('{domain}', encodeURIComponent(domain))
    .replaceAll('{size}', String(size))
}

function readCache(key: string): CacheEntry | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  // Refresh insertion order so the eviction below drops the coldest key.
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

function writeCache(key: string, entry: CacheEntry): void {
  cache.set(key, entry)
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

async function readCapped(response: Response): Promise<ArrayBuffer | null> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await response.body?.cancel().catch(() => {})
    return null
  }

  const reader = response.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

async function loadFavicon(
  template: string,
  domain: string,
  size: number
): Promise<CacheEntry> {
  const miss: CacheEntry = {
    expiresAt: Date.now() + MISS_TTL_MS,
    body: null,
    contentType: ''
  }

  let response: Response
  try {
    response = await safeFetch(providerUrl(template, domain, size), {
      headers: { accept: 'image/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    })
  } catch {
    return miss
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    return miss
  }

  const contentType = (response.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    await response.body?.cancel().catch(() => {})
    return miss
  }

  const body = await readCapped(response).catch(() => null)
  if (!body || body.byteLength === 0) return miss

  return { expiresAt: Date.now() + HIT_TTL_MS, body, contentType }
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'cache-control': 'public, max-age=600' }
  })
}

// Kept out of any cache: the icon is fine, this instance is just busy.
function unavailable(): Response {
  return new Response(null, {
    status: 503,
    headers: { 'cache-control': 'no-store' }
  })
}

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams

  const domain = normalizeFaviconDomain(params.get('domain') ?? '')
  if (!domain) return notFound()

  const requested = Number(params.get('sz'))
  const size = isFaviconSize(requested) ? requested : DEFAULT_FAVICON_SIZE

  const template = providerTemplate()
  if (!template) return notFound()

  const key = `${size}:${domain}`
  let entry = readCache(key)

  if (!entry) {
    let pending = inFlight.get(key)
    if (!pending) {
      if (inFlight.size >= MAX_CONCURRENT_LOADS) return unavailable()
      pending = loadFavicon(template, domain, size).finally(() => {
        inFlight.delete(key)
      })
      inFlight.set(key, pending)
    }
    entry = await pending
    writeCache(key, entry)
  }

  if (!entry.body) return notFound()

  return new Response(entry.body, {
    status: 200,
    headers: {
      'content-type': entry.contentType,
      'content-length': String(entry.body.byteLength),
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin'
    }
  })
}
