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
    'never caps a tool call id at a single citation number',
    getPrompt => {
      expect(getPrompt()).not.toContain(
        'Each unique toolCallId gets ONE number'
      )
    }
  )

  test('numbers citations by result position within a search', () => {
    expect(getQuickModePrompt()).toContain('position of the cited result')
    expect(getAdaptiveModePrompt()).toContain('result order within each search')
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
