import { NextRequest } from 'next/server'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from './route'

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
          authorization: 'Bearer token'
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
