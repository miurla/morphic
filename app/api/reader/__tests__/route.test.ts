import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSafeFetch = vi.fn()
const mockReadResponseWithLimit = vi.fn()

vi.mock('@/lib/utils/ssrf-guard', () => ({
  SSRFError: class SSRFError extends Error {
    url: string
    reason: string

    constructor(url: string, reason: string) {
      super(`SSRF blocked: ${reason}`)
      this.name = 'SSRFError'
      this.url = url
      this.reason = reason
    }
  },
  readResponseWithLimit: (...args: unknown[]) =>
    mockReadResponseWithLimit(...args),
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args)
}))

import { GET } from '../route'

function makeReaderRequest(url: string) {
  return new Request(`http://localhost:3000/api/reader?${url}`)
}

describe('reader API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadResponseWithLimit.mockResolvedValue(`
      <html>
        <body>
          <article><h1>Readable article</h1><p>Readable paragraph.</p></article>
        </body>
      </html>
    `)
    mockSafeFetch.mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    )
  })

  it('requires an explicit reader URL', async () => {
    const response = await GET(new Request('http://localhost:3000/api/reader'))

    expect(response.status).toBe(400)
    expect(mockSafeFetch).not.toHaveBeenCalled()
  })

  it('fetches a safe source and returns attributed readable content', async () => {
    const response = await GET(
      makeReaderRequest(
        'url=https%3A%2F%2Fexample.com%2Fstory&utm_source=ignored&title=Original%20Story&siteName=Example'
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockSafeFetch).toHaveBeenCalledWith('https://example.com/story', {
      headers: expect.objectContaining({
        Accept: expect.stringContaining('text/html')
      }),
      maxRedirects: 3,
      maxResponseBytes: 1000000
    })
    expect(body).toMatchObject({
      ok: true,
      reader: {
        url: 'https://example.com/story',
        sourceUrl: 'https://example.com/story',
        title: 'Readable article',
        siteName: 'Example',
        domain: 'example.com',
        content: expect.stringContaining('Readable paragraph.')
      }
    })
  })

  it('rejects unsupported content types without buffering content', async () => {
    mockSafeFetch.mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' }
      })
    )

    const response = await GET(
      makeReaderRequest('url=https%3A%2F%2Fexample.com%2Ffile.pdf')
    )
    const body = await response.json()

    expect(response.status).toBe(415)
    expect(body).toEqual({
      ok: false,
      error: 'Unsupported content type'
    })
    expect(mockReadResponseWithLimit).not.toHaveBeenCalled()
  })

  it('returns a safe error when SSRF protection blocks a private URL', async () => {
    mockSafeFetch.mockRejectedValue(
      Object.assign(new Error('SSRF blocked: Blocked hostname: localhost'), {
        name: 'SSRFError'
      })
    )

    const response = await GET(
      makeReaderRequest('url=http%3A%2F%2Flocalhost%2Fprivate')
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      ok: false,
      error: 'Source URL is not allowed'
    })
  })
})
