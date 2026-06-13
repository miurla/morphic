import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CrwSearchProvider } from '@/lib/tools/search/providers/crw'

describe('CrwSearchProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRW_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRW_API_KEY
    delete process.env.CRW_API_URL
  })

  it('throws when CRW_API_KEY is not set', async () => {
    delete process.env.CRW_API_KEY
    const provider = new CrwSearchProvider()
    await expect(provider.search('hello world')).rejects.toThrow(
      'CRW_API_KEY is not set in the environment variables'
    )
  })

  it('maps web/news results and images into SearchResults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        success: true,
        data: {
          web: [
            {
              url: 'https://example.com/a',
              title: 'Example A',
              description: 'desc a',
              markdown: 'markdown a',
              position: 1
            }
          ],
          news: [
            {
              url: 'https://example.com/b',
              title: 'Example B',
              snippet: 'snippet b',
              date: '2024-01-01',
              position: 1
            }
          ],
          images: [
            {
              title: 'Image C',
              imageUrl: 'https://example.com/c.png',
              imageWidth: 100,
              imageHeight: 100,
              url: 'https://example.com/c',
              position: 1
            }
          ]
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new CrwSearchProvider()
    const result = await provider.search('example query', 5, 'advanced')

    // Defaults to the cloud base URL and the /v1/search endpoint.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fastcrw.com/api/v1/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    )

    expect(result.query).toBe('example query')
    expect(result.number_of_results).toBe(2)
    expect(result.results).toEqual([
      {
        title: 'Example A',
        url: 'https://example.com/a',
        content: 'markdown a'
      },
      {
        title: 'Example B',
        url: 'https://example.com/b',
        content: 'snippet b'
      }
    ])
    expect(result.images).toEqual([
      { url: 'https://example.com/c.png', description: 'Image C' }
    ])
  })

  it('honors CRW_API_URL for self-hosted instances', async () => {
    process.env.CRW_API_URL = 'http://localhost:3000/'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, data: {} })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new CrwSearchProvider()
    await provider.search('hello world')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/search',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws on non-ok responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom'
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new CrwSearchProvider()
    await expect(provider.search('hello world')).rejects.toThrow(
      'CRW status: 500, reason error: boom'
    )
  })
})
