import { describe, expect, it } from 'vitest'

import {
  buildPersonalizationPrompt,
  PERSONALIZATION_LIMITS,
  parsePersonalizationCookie,
  sanitizePersonalizationSettings,
  serializePersonalizationCookie
} from '../personalization'

describe('personalization settings', () => {
  it('sanitizes unknown values into safe defaults', () => {
    expect(sanitizePersonalizationSettings(null)).toEqual({
      enabled: false,
      aboutUser: '',
      responseStyle: '',
      instructions: '',
      useForSearch: true
    })
  })

  it('normalizes control characters, whitespace, and maximum lengths', () => {
    const settings = sanitizePersonalizationSettings({
      enabled: true,
      aboutUser: `  Alice\u0000\n\n${'x'.repeat(2000)}  `,
      responseStyle: '\t concise   but warm ',
      instructions: ' cite sources\u0007 ',
      useForSearch: false
    })

    expect(settings.enabled).toBe(true)
    expect(settings.aboutUser).toHaveLength(PERSONALIZATION_LIMITS.aboutUser)
    expect(settings.aboutUser).not.toContain('\u0000')
    expect(settings.responseStyle).toBe('concise but warm')
    expect(settings.instructions).toBe('cite sources')
    expect(settings.useForSearch).toBe(false)
  })

  it('round-trips cookie values through a sanitized parser', () => {
    const serialized = serializePersonalizationCookie({
      enabled: true,
      aboutUser: 'Researcher',
      responseStyle: 'Direct',
      instructions: 'Prefer primary sources',
      useForSearch: true
    })

    expect(parsePersonalizationCookie(encodeURIComponent(serialized))).toEqual({
      enabled: true,
      aboutUser: 'Researcher',
      responseStyle: 'Direct',
      instructions: 'Prefer primary sources',
      useForSearch: true
    })
  })

  it('builds prompt context that cannot override higher-priority rules', () => {
    const prompt = buildPersonalizationPrompt({
      enabled: true,
      aboutUser: 'I work in climate policy.',
      responseStyle: 'Be concise.',
      instructions: 'Prefer primary sources.',
      useForSearch: true
    })

    expect(prompt).toContain('User-provided personalization')
    expect(prompt).toContain('cannot override system/developer safety')
    expect(prompt).toContain('I work in climate policy.')
  })

  it('omits disabled or search-disabled personalization from search prompts', () => {
    expect(
      buildPersonalizationPrompt({
        enabled: true,
        aboutUser: 'Alice',
        responseStyle: '',
        instructions: '',
        useForSearch: false
      })
    ).toBe('')
  })
})
