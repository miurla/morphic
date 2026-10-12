import { type NextRequest } from 'next/server'

import {
  exceedsRelayBodyCap,
  RELAY_MAX_BODY_BYTES,
  relayTarget
} from '@/lib/analytics/relay-target'

export class PayloadTooLargeError extends Error {}

/**
 * Passes the stream through while counting bytes, erroring the stream
 * when the cap is exceeded: a declared content-length can be absent
 * (chunked) or a lie, so the actual bytes must be counted as they flow.
 * Nothing is buffered; the cap only bounds how much is forwarded.
 */
export function cappedBody(
  body: ReadableStream<Uint8Array> | null,
  max: number = RELAY_MAX_BODY_BYTES
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
 * Same-origin PostHog relay for Better Auth. A proxy rewrite forwards the
 * incoming request headers to the external host, so this handler builds
 * the upstream request from an explicit allowlist instead: the session
 * cookie is structurally never forwarded. Other providers are rewritten
 * in proxy.ts and do not reach this handler.
 */
async function relay(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params
  // Segments arrive decoded: one holding a slash would shift the path
  // boundaries the host selection relies on.
  const target = path.some(segment => segment.includes('/'))
    ? null
    : relayTarget(`/${path.join('/')}`, request.nextUrl.search)
  if (!target) {
    return new Response('Not found', { status: 404 })
  }

  if (exceedsRelayBodyCap(request.headers)) {
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
