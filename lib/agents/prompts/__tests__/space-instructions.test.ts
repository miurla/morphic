import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  attachSpaceNote,
  buildSpaceInstructions,
  SPACE_NOTE
} from '../space-instructions'

describe('buildSpaceInstructions', () => {
  it('returns nothing without a space', () => {
    expect(buildSpaceInstructions(null)).toBe('')
    expect(buildSpaceInstructions(undefined)).toBe('')
  })

  it('returns nothing for blank instructions', () => {
    expect(buildSpaceInstructions({ about: '  ', style: '\n' })).toBe('')
  })

  it('wraps about and style in the space block', () => {
    const result = buildSpaceInstructions({
      about: ' Writing for my blog ',
      style: 'Write in English.'
    })

    expect(result.startsWith('## Space instructions\n')).toBe(true)
    expect(result).toContain(
      'They do not change the search,\nfetch, and citation rules above.'
    )
    expect(result).toContain(
      '<space_instructions>\nWriting for my blog\nWrite in English.\n</space_instructions>'
    )
  })

  it('keeps only the filled field', () => {
    expect(buildSpaceInstructions({ about: '', style: 'Be brief.' })).toContain(
      '<space_instructions>\nBe brief.\n</space_instructions>'
    )
  })
})

describe('attachSpaceNote', () => {
  const messages: ModelMessage[] = [
    { role: 'user', content: 'first question' },
    { role: 'assistant', content: [{ type: 'text', text: 'answer' }] },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'second question' },
        { type: 'image', image: 'https://example.com/a.png' }
      ]
    }
  ]

  it('ends every user message with the note when instructions exist', () => {
    const result = attachSpaceNote(messages, '## Space instructions')

    expect(result[0].content).toEqual([
      { type: 'text', text: 'first question' },
      { type: 'text', text: SPACE_NOTE }
    ])
    expect(result[1]).toBe(messages[1])
    expect(result[2].content).toEqual([
      { type: 'text', text: 'second question' },
      { type: 'image', image: 'https://example.com/a.png' },
      { type: 'text', text: SPACE_NOTE }
    ])
  })

  it('renders an earlier turn the same way on the next turn', () => {
    const first = attachSpaceNote(messages.slice(0, 1), 'x')
    const next = attachSpaceNote(messages, 'x')

    expect(next[0]).toEqual(first[0])
  })

  it('leaves messages alone without instructions', () => {
    expect(attachSpaceNote(messages, '')).toBe(messages)
  })

  it('does not change the messages it was given', () => {
    const snapshot = structuredClone(messages)

    attachSpaceNote(messages, 'x')

    expect(messages).toEqual(snapshot)
  })
})
