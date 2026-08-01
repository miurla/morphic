import { generateText } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getModel } from '../../utils/registry'
import { generateChatTitle } from '../title-generator'

vi.mock('ai', () => ({
  generateText: vi.fn()
}))
vi.mock('../../utils/registry', () => ({
  getModel: vi.fn()
}))
vi.mock('../../utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => false)
}))

describe('generateChatTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockResolvedValue({
      text: 'Concise title'
    } as never)
  })

  it('disables reasoning and limits output for GPT-5.6 Luna', async () => {
    await expect(
      generateChatTitle({
        userMessageContent: 'Explain the latest model changes',
        modelId: 'openai:gpt-5.6-luna'
      })
    ).resolves.toBe('Concise title')

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 32,
        providerOptions: {
          openai: {
            reasoningEffort: 'none'
          }
        }
      })
    )
  })

  it('does not send OpenAI options to other providers', async () => {
    await generateChatTitle({
      userMessageContent: 'Explain the latest model changes',
      modelId: 'google:gemini-3.1-flash-lite'
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 32,
        providerOptions: undefined
      })
    )
  })
})
