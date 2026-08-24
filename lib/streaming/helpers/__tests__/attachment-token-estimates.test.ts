import { convertToModelMessages, type UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  estimateAttachmentTokens,
  UNKNOWN_ATTACHMENT_TOKENS
} from '@/lib/utils/attachment-tokens'
import { shouldTruncateMessages } from '@/lib/utils/context-window'

import { buildAttachmentTokenEstimates } from '../attachment-token-estimates'

function messages(): UIMessage[] {
  return [
    {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Compare these files' },
        {
          type: 'file',
          mediaType: 'application/pdf',
          url: 'https://example.com/large.pdf',
          size: 20_000_000
        },
        {
          type: 'file',
          mediaType: 'application/pdf',
          url: 'https://example.com/unknown.pdf'
        }
      ]
    } as unknown as UIMessage
  ]
}

describe('buildAttachmentTokenEstimates', () => {
  it('indexes the exact pre-conversion estimate by attachment URL', () => {
    const estimates = buildAttachmentTokenEstimates(messages())

    expect(estimates.get('https://example.com/large.pdf')).toBe(
      estimateAttachmentTokens({
        mediaType: 'application/pdf',
        size: 20_000_000
      })
    )
    expect(estimates.get('https://example.com/unknown.pdf')).toBe(
      UNKNOWN_ATTACHMENT_TOKENS
    )
  })

  it('ignores non-file parts', () => {
    const estimates = buildAttachmentTokenEstimates([
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'No files' }]
      }
    ])

    expect(estimates.size).toBe(0)
  })

  it('matches converted URL parts in the context-window guard', async () => {
    const input = messages()
    const estimates = buildAttachmentTokenEstimates(input)
    const modelMessages = await convertToModelMessages(input)

    expect(
      shouldTruncateMessages(
        modelMessages,
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o mini',
          provider: 'OpenAI',
          providerId: 'openai'
        },
        estimates
      )
    ).toBe(true)
  })
})
