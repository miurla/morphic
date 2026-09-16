// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const safeFetch = vi.fn()

vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: (...args: unknown[]) => safeFetch(...args)
}))

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function imageResponse(
  body: Uint8Array<ArrayBuffer> = PNG,
  contentType = 'image/png',
  status = 200
): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType }
  })
}

function request(query: string): Request {
  return new Request(`https://morphic.test/api/favicon?${query}`)
}

async function get(query: string): Promise<Response> {
  const { GET } = await import('../route')
  return GET(request(query))
}

let counter = 0

// Each case needs a domain the module-level cache has not seen.
function freshDomain(): string {
  counter += 1
  return `case-${counter}.example.com`
}

describe('GET /api/favicon', () => {
  beforeEach(() => {
    vi.resetModules()
    safeFetch.mockReset()
    delete process.env.FAVICON_PROVIDER_URL
  })

  afterEach(() => {
    delete process.env.FAVICON_PROVIDER_URL
  })

  it('serves the icon from our own origin, cached and non-sniffable', async () => {
    safeFetch.mockResolvedValue(imageResponse())

    const response = await get(`domain=${freshDomain()}&sz=32`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('max-age=86400')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG)
  })

  it('asks the provider for the requested domain and size', async () => {
    safeFetch.mockResolvedValue(imageResponse())
    const domain = freshDomain()

    await get(`domain=${domain}&sz=128`)

    expect(safeFetch).toHaveBeenCalledWith(
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      expect.anything()
    )
  })

  it('falls back to the default size for one it does not serve', async () => {
    safeFetch.mockResolvedValue(imageResponse())
    const domain = freshDomain()

    await get(`domain=${domain}&sz=4096`)

    expect(safeFetch).toHaveBeenCalledWith(
      expect.stringContaining('&sz=16'),
      expect.anything()
    )
  })

  it('fetches a domain once and answers the rest from cache', async () => {
    safeFetch.mockResolvedValue(imageResponse())
    const domain = freshDomain()

    const [first, second] = await Promise.all([
      get(`domain=${domain}&sz=16`),
      get(`domain=${domain}&sz=16`)
    ])
    const third = await get(`domain=${domain}&sz=16`)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(200)
    expect(safeFetch).toHaveBeenCalledTimes(1)
  })

  it('refuses a domain that is not a public hostname', async () => {
    const response = await get('domain=127.0.0.1&sz=16')

    expect(response.status).toBe(404)
    expect(safeFetch).not.toHaveBeenCalled()
  })

  it('refuses SVG, which would run as our own origin', async () => {
    safeFetch.mockResolvedValue(
      imageResponse(
        new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
        'image/svg+xml'
      )
    )

    const response = await get(`domain=${freshDomain()}&sz=16`)

    expect(response.status).toBe(404)
  })

  it('refuses a body past the size cap', async () => {
    safeFetch.mockResolvedValue(imageResponse(new Uint8Array(200 * 1024)))

    const response = await get(`domain=${freshDomain()}&sz=16`)

    expect(response.status).toBe(404)
  })

  it('answers 404 when the provider fails or refuses', async () => {
    safeFetch.mockResolvedValueOnce(imageResponse(PNG, 'image/png', 500))
    expect((await get(`domain=${freshDomain()}&sz=16`)).status).toBe(404)

    safeFetch.mockRejectedValueOnce(new Error('blocked'))
    expect((await get(`domain=${freshDomain()}&sz=16`)).status).toBe(404)
  })

  it('uses a configured provider template', async () => {
    process.env.FAVICON_PROVIDER_URL =
      'https://icons.example.net/{size}/{domain}'
    safeFetch.mockResolvedValue(imageResponse())
    const domain = freshDomain()

    await get(`domain=${domain}&sz=32`)

    expect(safeFetch).toHaveBeenCalledWith(
      `https://icons.example.net/32/${domain}`,
      expect.anything()
    )
  })

  it('contacts nobody when the provider is turned off', async () => {
    process.env.FAVICON_PROVIDER_URL = 'off'

    const response = await get(`domain=${freshDomain()}&sz=16`)

    expect(response.status).toBe(404)
    expect(safeFetch).not.toHaveBeenCalled()
  })
})
