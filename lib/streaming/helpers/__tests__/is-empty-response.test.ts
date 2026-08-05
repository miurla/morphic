import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { isEmptyResponse } from '@/lib/streaming/helpers/is-empty-response'

function createResponseMessage(parts: UIMessage['parts']): UIMessage {
  return {
    id: 'response-id',
    role: 'assistant',
    parts
  }
}

describe('isEmptyResponse', () => {
  it('returns false for a text part with content', () => {
    expect(
      isEmptyResponse(createResponseMessage([{ type: 'text', text: 'Answer' }]))
    ).toBe(false)
  })

  it('returns true when there are no parts', () => {
    expect(isEmptyResponse(createResponseMessage([]))).toBe(true)
  })

  it('returns true for tool-only parts', () => {
    expect(
      isEmptyResponse(
        createResponseMessage([
          {
            type: 'dynamic-tool',
            toolName: 'search',
            toolCallId: 'tool-call-id',
            state: 'output-available',
            input: {},
            output: {}
          }
        ])
      )
    ).toBe(true)
  })

  it('returns true for reasoning-only parts', () => {
    expect(
      isEmptyResponse(
        createResponseMessage([{ type: 'reasoning', text: 'Thinking' }])
      )
    ).toBe(true)
  })

  it('returns true for whitespace-only text', () => {
    expect(
      isEmptyResponse(createResponseMessage([{ type: 'text', text: ' \n\t ' }]))
    ).toBe(true)
  })
})
