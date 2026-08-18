import { afterEach, describe, expect, it, vi } from 'vitest'

import { isToolFailureError } from '@/lib/errors/tool-error'
import { fetchTool } from '@/lib/tools/fetch'

describe('fetch tool errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('marks a failed page request as a tool failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(null, { status: 403, statusText: 'Forbidden' })
      )
    )

    const result = fetchTool.execute?.(
      { url: 'https://example.com/private', type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    expect(result).toBeDefined()

    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()

    try {
      await iterator.next()
      throw new Error('Expected fetch tool to throw')
    } catch (error) {
      expect(isToolFailureError(error)).toBe(true)
      if (isToolFailureError(error)) {
        expect(error.toolName).toBe('fetch')
        expect(error.originalMessage).toBe('HTTP 403: Forbidden')
      }
    }
  })

  it.each([
    'URL To Web design Template Features',
    'example.com/page',
    'file:///etc/passwd',
    // `new URL` reads this as the host `url-to-web-design-template-features`.
    'https:URL-To-Web-design-Template-Features',
    'https://'
  ])('rejects invalid URL %s without a network call', async url => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = fetchTool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    expect(result).toBeDefined()

    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()

    try {
      await iterator.next()
      throw new Error('Expected fetch tool to throw')
    } catch (error) {
      expect(isToolFailureError(error)).toBe(true)
      if (isToolFailureError(error)) {
        expect(error.toolName).toBe('fetch')
        expect(error.originalMessage).toBe('Invalid fetch URL.')
        expect(isToolFailureError(error.cause)).toBe(false)
      }
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a valid HTTPS URL to the network unchanged', async () => {
    const url = 'https://example.com/path?query=value'
    const fetchMock = vi.fn(
      async () =>
        new Response(
          '<html><title>Example</title><body>Content</body></html>',
          {
            headers: { 'content-type': 'text/html' }
          }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = fetchTool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    expect(result).toBeDefined()

    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    await iterator.next()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(url, expect.any(Object))
  })
})
