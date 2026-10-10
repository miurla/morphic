import { NextRequest } from 'next/server'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { cappedBody, GET, POST } from './route'

function upstreamResponse() {
  return new Response('{"status":"ok"}', {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60'
    }
  })
}

describe('relay route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('proxies capture requests without credentials and forwards the payload', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse())
    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest(
      'http://localhost:3000/relay/capture?batch=1',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'better-auth.session_token=abc',
          authorization: 'Bearer token',
          'x-forwarded-for': '203.0.113.7',
          'user-agent': 'Mozilla/5.0 (test)'
        },
        body: '{"api_key":"phk"}'
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ path: ['capture'] })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"status":"ok"}')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      { method: string; headers: Headers; body: ReadableStream }
    ]
    expect(url.toString()).toBe('https://us.i.posthog.com/capture?batch=1')
    expect(init.method).toBe('POST')
    expect(init.headers.get('content-type')).toBe('application/json')
    // PostHog geo/device stats need these (the old rewrites forwarded
    // them too).
    expect(init.headers.get('x-forwarded-for')).toBe('203.0.113.7')
    expect(init.headers.get('user-agent')).toBe('Mozilla/5.0 (test)')
    // Session credentials must never be forwarded to the analytics host.
    expect(init.headers.get('cookie')).toBeNull()
    expect(init.headers.get('authorization')).toBeNull()
    // The body is streamed through, not buffered.
    expect(await new Response(init.body).text()).toBe('{"api_key":"phk"}')
  })

  it('refuses declared payloads above the cap', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse())
    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest('http://localhost:3000/relay/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    request.headers.set('content-length', String(64 * 1024 * 1024))

    const response = await POST(request, {
      params: Promise.resolve({ path: ['capture'] })
    })

    expect(response.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses paths that resolve off the PostHog origin', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse())
    vi.stubGlobal('fetch', fetchMock)

    // A decoded segment starting with a slash would turn the joined path
    // protocol-relative and resolve the target to an attacker host.
    const request = new NextRequest(
      'http://localhost:3000/relay/%2f%2fevil.example/x'
    )

    const response = await GET(request, {
      params: Promise.resolve({ path: ['//evil.example', 'x'] })
    })

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('routes static and array paths to the asset host', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse())
    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest(
      'http://localhost:3000/relay/static/array.js'
    )
    await GET(request, {
      params: Promise.resolve({ path: ['static', 'array.js'] })
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      { method: string; body: undefined }
    ]
    expect(url.toString()).toBe(
      'https://us-assets.i.posthog.com/static/array.js'
    )
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })
})

describe('cappedBody', () => {
  it('errors the stream when actual bytes exceed the cap', async () => {
    // A chunked (undeclared) payload must be bounded by counting the
    // bytes as they flow, not by the declared content-length.
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(100))
        controller.enqueue(new Uint8Array(100))
        controller.close()
      }
    })

    const capped = cappedBody(source, 150)

    await expect(new Response(capped).text()).rejects.toBeDefined()
  })

  it('passes through bodies within the cap', async () => {
    const source = new Response('hello').body

    const capped = cappedBody(source, 10)

    expect(await new Response(capped).text()).toBe('hello')
  })

  it('returns null for a missing body', () => {
    expect(cappedBody(null)).toBeNull()
  })
})
