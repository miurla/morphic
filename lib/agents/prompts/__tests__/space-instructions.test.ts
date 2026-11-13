import { describe, expect, it } from 'vitest'

import { buildSpaceInstructions } from '../space-instructions'

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
