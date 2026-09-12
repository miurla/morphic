import { describe, expect, test } from 'vitest'

import {
  getAdaptiveModePrompt,
  getQuickModePrompt
} from '@/lib/agents/prompts/search-mode-prompts'

import {
  EXAMPLE_IMAGE_SPEC_BLOCK,
  getImageSpecPrompt,
  getRelatedQuestionsSpecPrompt
} from '../prompt'

describe('render prompts', () => {
  test('includes related questions by default for substantive answers', () => {
    const prompt = getRelatedQuestionsSpecPrompt()

    expect(prompt).toContain('expected on every substantive answer')
    expect(prompt).toContain('Decide from the answer you just wrote')
    expect(prompt).toContain(
      'Include the spec block whenever that answer compares options'
    )
    expect(prompt).toContain(
      'SKIP the spec block entirely (output nothing) only in these cases'
    )
    expect(prompt).toContain('Greetings, small talk, or thanks')
    expect(prompt).toContain(
      'The answer delivers a single fact, value, date, quantity, or yes/no'
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

  test.each([getQuickModePrompt, getAdaptiveModePrompt])(
    'uses persisted result labels for citations',
    getPrompt => {
      const prompt = getPrompt()

      expect(prompt).toContain('[number](#label)')
      expect(prompt).toContain('Each search result carries a `label` field')
      expect(prompt).toContain('number in brackets carries no meaning')
      expect(prompt).toContain('[1](#S3)')
      expect(prompt).toContain('[1](#S7)')
      expect(prompt).toContain('[1](#S12)')
      expect(prompt).not.toContain('toolCallId')
      expect(prompt).not.toContain('EXAMPLE_TOOL_CALL_ID')
    }
  )

  test('defines exhaustive quick-mode tool plans and terminal outcomes', () => {
    const prompt = getQuickModePrompt()
    const toolPlanSection = prompt.slice(
      prompt.indexOf('**Tool plan (classify once before acting):**'),
      prompt.indexOf('**Completion rule (the only early-stop rule):**')
    )

    const expectedPlans = [
      '| None | No | Use no tools; answer directly |',
      '| None | Yes | Search exactly once; then answer |',
      '| One or more | No | Retrieve every distinct actionable URL; then answer without search |',
      '| One or more | Yes | Retrieve every distinct actionable URL; then search exactly once; then answer |'
    ]
    const actualPlans = toolPlanSection
      .split('\n')
      .filter(line => /^\| (?:None|One or more) \|/.test(line))

    expect(toolPlanSection).toContain(
      'These four rows are exhaustive and mutually exclusive'
    )
    expect(actualPlans).toEqual(expectedPlans)
    expect(prompt).toContain('Model memory does not count as supplied material')
    expect(prompt).toContain(
      'A URL included only as literal text to translate, rewrite, reformat, or reproduce in creative output is not actionable and MUST NOT be fetched'
    )
    expect(prompt).toContain(
      "When one or more URLs are the turn's only substantive content, every URL is actionable"
    )
    expect(prompt).toContain('self-contained calculations')
    expect(prompt).toContain(
      'The single search reaches a terminal outcome when that invocation returns results, returns no results, or fails'
    )
    expect(prompt).toContain(
      'Never run a second search or substitute fetch for a failed or weak search'
    )
    expect(prompt).toContain(
      'Attempt every distinct actionable URL even when an earlier URL fails or is refused'
    )
    expect(prompt).toContain(
      'including a `.pdf` pathname with query parameters or a fragment'
    )
    expect(prompt).toContain(
      'empty, irrelevant, truncated-before-the-requested-material, app-shell, "enable JavaScript", or similar unusable content'
    )
    expect(prompt).toContain(
      'Any API attempt is terminal when it returns or fails, including empty or unusable output'
    )
    expect(prompt).toContain(
      'malformed, non-HTTP(S), unsafe, blocked, forbidden, or not found is terminal after the first refusal'
    )
    expect(prompt).not.toContain(
      "You can clearly answer the user's question with current information"
    )
  })

  test.each([
    [getQuickModePrompt, 'Example approach:'],
    [getAdaptiveModePrompt, 'Flexible example:']
  ])(
    'keeps spec fences out of the worked answer example',
    (getPrompt, marker) => {
      const prompt = getPrompt()
      const workedExample = prompt.slice(
        prompt.indexOf(marker),
        prompt.indexOf('INLINE IMAGE EMBEDDING:')
      )

      // The worked example shows a complete answer body. A spec fence inside
      // it makes it a finished answer that ends without the related-questions
      // block, which suppresses that block instead of teaching it.
      expect(workedExample).not.toContain('```spec')
      expect(prompt.split(EXAMPLE_IMAGE_SPEC_BLOCK)).toHaveLength(2)
    }
  )

  test.each([getQuickModePrompt, getAdaptiveModePrompt])(
    'uses placeholders for example tool calls and image sources',
    getPrompt => {
      const prompt = getPrompt()
      const oldToolCallIds = [
        'I8NzFUKwrKX88107',
        'aHvy9Vt17r3VSmnG',
        'abc123',
        'def456'
      ]
      const imageSources = [...prompt.matchAll(/"src":"([^"]+)"/g)].map(
        match => match[1]
      )

      for (const toolCallId of oldToolCallIds) {
        expect(prompt).not.toContain(toolCallId)
      }
      expect(imageSources.length).toBeGreaterThan(0)
      expect(imageSources).toEqual(
        imageSources.filter(source => source.startsWith('EXAMPLE_IMAGE_'))
      )
    }
  )
})
