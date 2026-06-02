import { describe, expect, it } from 'vitest'

import {
  MODEL_SELECTION_COOKIE_VERSION,
  parseModelSelectionCookie,
  serializeModelSelectionCookie
} from '@/lib/config/model-selection-cookie'

describe('model selection cookie', () => {
  it('serializes model selections with an explicit version', () => {
    const serialized = serializeModelSelectionCookie({
      providerId: 'nvidia',
      modelId: 'meta/llama-3.1-8b-instruct'
    })

    expect(serialized).toBe('v2:nvidia:meta%2Fllama-3.1-8b-instruct')
    expect(parseModelSelectionCookie(serialized)).toEqual({
      providerId: 'nvidia',
      modelId: 'meta/llama-3.1-8b-instruct',
      version: MODEL_SELECTION_COOKIE_VERSION
    })
  })

  it('keeps legacy provider:model cookies parseable for migration', () => {
    expect(parseModelSelectionCookie('ollama:deepseek-r1%3A8b')).toEqual({
      providerId: 'ollama',
      modelId: 'deepseek-r1:8b',
      version: 1
    })
  })
})
