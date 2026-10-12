import { type NextRequest } from 'next/server'

// Mirrors the destinations of the PostHog proxy rewrites this handler
// replaced.
const ASSET_SEGMENTS = new Set(['static', 'array'])
const ASSET_HOST = 'us-assets.i.posthog.com'
const API_HOST = 'us.i.posthog.com'
// Generous cap that only rejects absurd declared sizes; the body itself
// is streamed through, so an undeclared (chunked) payload cannot be
// used to balloon process memory.
const MAX_BODY_BYTES = 32 * 1024 * 1024

export class PayloadTooLargeError extends Error {}

/**
 * Passes the stream through while counting bytes, erroring the stream
 * when the cap is exceeded: a declared content-length can be absent
 * (chunked) or a lie, so the actual bytes must be counted as they flow.
 * Nothing is buffered; the cap only bounds how much is forwarded.
 */
export function cappedBody(
  body: ReadableStream<Uint8Array> | null,
  max: number = MAX_BODY_BYTES
): ReadableStream<Uint8Array> | null {
  if (!body) {
    return null
  }
  let total = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        if (total > max) {
          controller.error(new PayloadTooLargeError())
          return
        }
        controller.enqueue(chunk)
      }
    })
  )
}

/**
 * Same-origin PostHog relay, implemented as a route handler instead of a
 * next.config rewrite so credentials are structurally never forwarded:
 * a rewrite proxies the incoming request headers (session cookie
 * included) to an external host, and keeping any middleware strip in
 * sync with the rewrite's path matching is a drift hazard. This handler
 * forwards only what PostHog needs and nothing else.
 */
async function relay(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params
  const host = ASSET_SEGMENTS.has(path[0]) ? ASSET_HOST : API_HOST
  const target = new URL(`/${path.join('/')}`, `https://${host}`)
  if (target.host !== host) {
    // A decoded path segment escaped the PostHog origin (e.g. an encoded
    // slash turning the joined path protocol-relative). Refuse rather
    // than proxy payloads to an attacker-chosen host.
    return new Response('Not found', { status: 404 })
  }
  target.search = request.nextUrl.search

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  // PostHog derives geo/device stats from these; the old next.config
  // rewrites forwarded them too. Cookie and Authorization are
  // deliberately not forwarded: session credentials must never reach
  // the analytics provider.
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor)
  }
  const userAgent = request.headers.get('user-agent')
  if (userAgent) {
    headers.set('user-agent', userAgent)
  }

  // The body is streamed through rather than buffered: /relay is
  // reachable without a session, so materializing an attacker-sized
  // POST in memory would be a denial-of-service vector. cappedBody
  // bounds the forwarded bytes even when no content-length was sent.
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : cappedBody(request.body)

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      duplex: 'half'
    } as RequestInit & { duplex?: 'half' })
  } catch (error) {
    if (
      error instanceof PayloadTooLargeError ||
      (error instanceof Error && error.cause instanceof PayloadTooLargeError)
    ) {
      return new Response('Payload too large', { status: 413 })
    }
    throw error
  }

  const responseHeaders = new Headers()
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType)
  }
  const cacheControl = upstream.headers.get('cache-control')
  if (cacheControl) {
    responseHeaders.set('cache-control', cacheControl)
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  })
}

export { relay as GET, relay as POST }
