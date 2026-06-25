import { describe, expect, test } from 'vitest'

import { getImageSpecPrompt, getRelatedQuestionsSpecPrompt } from '../prompt'

describe('render prompts', () => {
  test('makes related questions conditional instead of mandatory', () => {
    const prompt = getRelatedQuestionsSpecPrompt()

    expect(prompt).toContain('Generate related questions only when')
    expect(prompt).toContain('SKIP the spec block entirely')
    expect(prompt).toContain('When in doubt, skip the related questions')
    expect(prompt).not.toContain('RELATED QUESTIONS (MANDATORY)')
    expect(prompt).not.toContain('MUST generate exactly 3')
    expect(prompt).not.toContain('Emit exactly ONE related questions')
  })

  test('describes the related block as optional alongside image specs', () => {
    expect(getImageSpecPrompt()).toContain('which is itself optional')
  })
})
