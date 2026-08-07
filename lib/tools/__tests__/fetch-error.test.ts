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
      { toolCallId: 'fetch', messages: [] }
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
})
