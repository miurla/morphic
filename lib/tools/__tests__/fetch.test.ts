import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchTool } from '@/lib/tools/fetch'

const url = 'https://example.com/resource'

async function fetchRegular(body: string, contentType: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(body, { headers: { 'content-type': contentType } })
    )
  )

  const result = fetchTool.execute?.(
    { url, type: 'regular' },
    { toolCallId: 'fetch', messages: [], context: {} }
  )
  const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()

  await iterator.next()
  return iterator.next()
}

describe('regular fetch content types', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns JSON verbatim', async () => {
    const body = '{\n  "markup": "<value>",\n  "spaced": "a   b"\n}'
    const result = await fetchRegular(body, 'application/json; charset=utf-8')

    expect(result.value).toMatchObject({
      results: [{ content: body, title: 'example.com', url }],
      state: 'complete'
    })
  })

  it('accepts structured JSON media types', async () => {
    const result = await fetchRegular('{"data":[]}', 'application/vnd.api+json')

    expect(result.value).toMatchObject({ state: 'complete' })
  })

  it('returns plain text without tag stripping', async () => {
    const body = 'Keep <literal> tags and   whitespace.'
    const result = await fetchRegular(body, 'text/plain')

    expect(result.value).toMatchObject({ results: [{ content: body }] })
  })

  it('continues to process HTML content', async () => {
    const result = await fetchRegular(
      '<html><title>Page title</title><body>Hello <strong>world</strong><script>bad()</script></body></html>',
      'text/html'
    )

    expect(result.value).toMatchObject({
      results: [{ content: 'Page title Hello world', title: 'Page title' }]
    })
  })

  it('rejects unsupported content types', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = fetchRegular('PDF', 'application/pdf')

    await expect(result).rejects.toThrow(
      'Unsupported content type: application/pdf'
    )
  })
})
