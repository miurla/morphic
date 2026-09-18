import { describe, expect, it } from 'vitest'

import { hasAnswerAfterToolFailure } from '../has-answer-after-tool-failure'

describe('hasAnswerAfterToolFailure', () => {
  it('accepts answer text written after the failed call', () => {
    expect(
      hasAnswerAfterToolFailure({
        parts: [
          { type: 'tool-fetch', state: 'output-available' },
          { type: 'tool-fetch', state: 'output-error' },
          { type: 'text', text: 'Answer' }
        ]
      })
    ).toBe(true)
  })

  it('rejects text that only preceded the failed call', () => {
    expect(
      hasAnswerAfterToolFailure({
        parts: [
          { type: 'text', text: 'Let me look that up.' },
          { type: 'tool-fetch', state: 'output-error' }
        ]
      })
    ).toBe(false)
  })

  it('rejects whitespace standing in for an answer', () => {
    expect(
      hasAnswerAfterToolFailure({
        parts: [
          { type: 'tool-search', state: 'output-error' },
          { type: 'text', text: '  \n' }
        ]
      })
    ).toBe(false)
  })

  it('reads the last failure, not the first', () => {
    expect(
      hasAnswerAfterToolFailure({
        parts: [
          { type: 'tool-fetch', state: 'output-error' },
          { type: 'text', text: 'Partial' },
          { type: 'tool-fetch', state: 'output-error' }
        ]
      })
    ).toBe(false)
  })

  it('rejects a message that carries no failed call at all', () => {
    expect(
      hasAnswerAfterToolFailure({ parts: [{ type: 'text', text: 'Answer' }] })
    ).toBe(false)
    expect(hasAnswerAfterToolFailure(undefined)).toBe(false)
  })
})
