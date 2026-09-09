import { describe, expect, it } from 'vitest'

import {
  getAdaptiveModePrompt,
  getQuickModePrompt
} from '../search-mode-prompts'

describe('search mode prompts', () => {
  it('adds bounded parallel searches to adaptive mode', () => {
    const prompt = getAdaptiveModePrompt()

    expect(prompt).toContain(
      'independent searches for several angles in the same step'
    )
    expect(prompt).toContain('Use sequential searches only when')
    expect(prompt).toContain('at most 3 searches in parallel')
  })

  it('does not add bounded parallel searches to quick mode', () => {
    const prompt = getQuickModePrompt()

    expect(prompt).not.toContain(
      'independent searches for several angles in the same step'
    )
    expect(prompt).not.toContain('Use sequential searches only when')
    expect(prompt).not.toContain('at most 3 searches in parallel')
  })
})
