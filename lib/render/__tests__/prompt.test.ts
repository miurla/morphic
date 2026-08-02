import { describe, expect, test } from 'vitest'

import { getImageSpecPrompt, getRelatedQuestionsSpecPrompt } from '../prompt'

describe('render prompts', () => {
  test('includes related questions by default for substantive answers', () => {
    const prompt = getRelatedQuestionsSpecPrompt()

    expect(prompt).toContain('expected on every substantive answer')
    expect(prompt).toContain(
      'Include the spec block whenever the answer contains substantive information'
    )
    expect(prompt).toContain(
      'SKIP the spec block entirely (output nothing) only in these cases'
    )
    expect(prompt).toContain('Greetings, small talk, or thanks')
    expect(prompt).toContain(
      'Trivial one-off lookups with no natural next step'
    )
    expect(prompt).toContain('Meta/operational replies')
    expect(prompt).toContain('Cases where you could not answer')
    expect(prompt).toContain(
      'Short answers where suggested next questions would be generic or forced'
    )
    expect(prompt).toContain('These skip cases are the exception')
    expect(prompt).not.toContain('RELATED QUESTIONS (MANDATORY)')
    expect(prompt).not.toContain('MUST generate exactly 3')
    expect(prompt).not.toContain('Emit exactly ONE related questions')
  })

  test('describes the related block as optional alongside image specs', () => {
    expect(getImageSpecPrompt()).toContain('which is itself optional')
  })
})
