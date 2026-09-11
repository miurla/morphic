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

  test('defines disjoint quick-mode early-stop paths', () => {
    const prompt = getQuickModePrompt()
    const earlyStopSection = prompt.slice(
      prompt.indexOf('**Early Stop Criteria'),
      prompt.indexOf('\n\nLanguage:')
    )

    expect(earlyStopSection).toContain(
      'The informational request contains no URLs: the single required search has completed'
    )
    expect(earlyStopSection).toContain(
      'The request asks only about content in the provided URLs: a fetch attempt has completed for every provided URL'
    )
    expect(earlyStopSection).toContain(
      'The request asks about the provided URLs and requires broader information: fetch attempts have completed for every provided URL AND the single required search has completed'
    )
    expect(earlyStopSection).toContain(
      'The request contains no URLs and needs no external information'
    )
    expect(earlyStopSection).not.toContain(
      "answer the user's question with current information"
    )
    expect(prompt).toContain(
      'On an allowed no-search turn, do not emit citation syntax'
    )
    expect(prompt).toContain(
      'If the request asks only about content in the provided URLs, do NOT search'
    )
    expect(prompt).toContain(
      'run exactly one search after every fetch attempt has completed'
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
