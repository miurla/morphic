import { describe, expect, it } from 'vitest'

import { hasResponseContentPart } from '../has-response-content'

describe('hasResponseContentPart', () => {
  it.each([
    undefined,
    null,
    { parts: [] },
    { parts: [{ type: 'step-start' }] }
  ])('treats %j as zero content', response => {
    expect(hasResponseContentPart(response)).toBe(false)
  })

  it.each(['text', 'reasoning', 'source-url', 'tool-search'])(
    'counts %s as delivered content',
    type => {
      expect(
        hasResponseContentPart({
          parts: [{ type: 'step-start' }, { type }]
        })
      ).toBe(true)
    }
  )
})
