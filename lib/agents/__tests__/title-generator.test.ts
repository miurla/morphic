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

  it('disables reasoning without limiting output for GPT-6 Luna', async () => {
    await expect(
      generateChatTitle({
        userMessageContent: 'Explain the latest model changes',
        modelId: 'openai:gpt-6-luna'
      })
    ).resolves.toBe('Concise title')

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'none'
          }
        }
      })
    )
    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty(
      'maxOutputTokens'
    )
  })

  it('does not send OpenAI options to other providers', async () => {
    await generateChatTitle({
      userMessageContent: 'Explain the latest model changes',
      modelId: 'google:gemini-3.1-flash-lite'
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: undefined
      })
    )
    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty(
      'maxOutputTokens'
    )
  })

  it.each([
    ['zh-CN', 'Write an English email', 'Simplified Chinese (zh-CN)'],
    ['en', '请解释这段代码', 'English (en)']
  ] as const)(
    'uses %s for the title even when the requested content uses another language',
    async (locale, message, language) => {
      await generateChatTitle({
        userMessageContent: message,
        modelId: 'openai:test',
        locale
      })
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining(
            `Write the title in ${language}`
          ),
          prompt: message
        })
      )
    }
  )

  it('uses a localized fallback when title generation produces no result', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: '' } as never)
    await expect(
      generateChatTitle({
        userMessageContent: 'Hello',
        modelId: 'openai:test',
        locale: 'zh-CN'
      })
    ).resolves.toBe('新对话')
  })
})
