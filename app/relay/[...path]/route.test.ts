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
      { method: string; headers: Headers; body: ArrayBuffer }
    ]
    expect(url.toString()).toBe('https://us.i.posthog.com/capture?batch=1')
    expect(init.method).toBe('POST')
    expect(init.headers.get('content-type')).toBe('application/json')
    // Session credentials must never be forwarded to the analytics host.
    expect(init.headers.get('cookie')).toBeNull()
    expect(init.headers.get('authorization')).toBeNull()
    expect(new TextDecoder().decode(init.body)).toBe('{"api_key":"phk"}')
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
