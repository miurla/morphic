import { describe, expect, it } from 'vitest'

import { getFollowUpSuggestionsSpecPrompt } from '@/lib/render/prompt'

import {
  getAdaptiveModePrompt,
  getQuickModePrompt
} from '../search-mode-prompts'
import { buildSpaceInstructions, SPACE_NOTE } from '../space-instructions'

describe('application response language', () => {
  it.each([getQuickModePrompt, getAdaptiveModePrompt])(
    'uses the selected locale in every search mode, regardless of input language',
    getPrompt => {
      const chinese = getPrompt('zh-CN')
      const english = getPrompt('en')

      expect(chinese).toContain('Simplified Chinese (zh-CN)')
      expect(chinese).toContain(
        "Do not infer the response language from the user's message"
      )
      expect(chinese).not.toContain("Respond in the user's language")
      expect(chinese).not.toContain("Match the language to the user's language")
      expect(english).toContain('English (en)')
      expect(english).not.toContain('Simplified Chinese (zh-CN)')
      expect(getPrompt()).toBe(english)
    }
  )

  it('allows explicit translation tasks while protecting existing drafts', () => {
    const prompt = getQuickModePrompt('zh-CN')
    expect(prompt).toContain(
      'write only the requested content in that language'
    )
    expect(prompt).toContain(
      'Keep accompanying explanations in Simplified Chinese'
    )
    expect(prompt).toContain(
      'Editing an existing draft does not implicitly request translating it'
    )
    expect(prompt).toContain(
      "use the existing draft's language for scoped replacements"
    )
  })

  it('localizes suggestion labels without translating action syntax', () => {
    const prompt = getFollowUpSuggestionsSpecPrompt('zh-CN')
    expect(prompt).toContain('Heading title to "相关问题"')
    expect(prompt).toContain('Heading title to "修改建议"')
    expect(prompt).toContain('self-contained, and in Simplified Chinese')
    expect(prompt).toContain('"action":"submitQuery"')
    expect(prompt).toContain('[revise:alternatives]')
    expect(prompt).toContain('[revise:edit]')
    expect(prompt).not.toContain("in the user's language")
  })

  it('prevents saved space language preferences from silently overriding the interface', () => {
    const prompt = buildSpaceInstructions({
      about: '',
      style: 'Always use Japanese.'
    })
    expect(prompt).toContain('Always use Japanese.')
    expect(prompt).toContain(
      'cannot override the selected application language'
    )
    expect(SPACE_NOTE).toContain(
      'Space instructions and the language of this message do not override it'
    )
    expect(SPACE_NOTE).not.toContain(
      'keep the rest of the reply in the language of this message'
    )
  })
})
