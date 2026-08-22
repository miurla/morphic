import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { summarizeCarriedContext } from '@/lib/streaming/helpers/summarize-carried-context'
import { IMAGE_ATTACHMENT_TOKENS } from '@/lib/utils/attachment-tokens'

function createMessages(parts: unknown[]): UIMessage[] {
  return [{ id: 'message-1', role: 'user', parts: parts as UIMessage['parts'] }]
}

describe('summarizeCarriedContext', () => {
  it('returns undefined for text-only history', () => {
    expect(
      summarizeCarriedContext(createMessages([{ type: 'text', text: 'hello' }]))
    ).toBeUndefined()
  })

  it('counts file parts and their estimated tokens', () => {
    expect(
      summarizeCarriedContext(
        createMessages([
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'https://example.com/a'
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            size: 39,
            url: 'https://example.com/b'
          }
        ])
      )
    ).toEqual({
      attachments: 2,
      attachmentTokens: IMAGE_ATTACHMENT_TOKENS + 10
    })
  })

  it('counts each structured text kind by characters', () => {
    expect(
      summarizeCarriedContext(
        createMessages([
          { type: 'data-pastedContent', data: { text: 'paste' } },
          { type: 'data-quotedContext', data: { text: 'quote' } },
          { type: 'data-noteContext', data: { text: 'note' } }
        ])
      )
    ).toEqual({ pastedChars: 5, quotedChars: 5, noteChars: 4 })
  })

  it('omits zero-valued keys and ignores non-string data text', () => {
    expect(
      summarizeCarriedContext(
        createMessages([
          {
            type: 'file',
            mediaType: 'application/pdf',
            size: 0,
            url: 'https://example.com/a'
          },
          { type: 'data-pastedContent', data: { text: '' } },
          { type: 'data-quotedContext', data: { text: 42 } },
          { type: 'data-noteContext', data: { text: null } }
        ])
      )
    ).toEqual({ attachments: 1 })
  })
})
