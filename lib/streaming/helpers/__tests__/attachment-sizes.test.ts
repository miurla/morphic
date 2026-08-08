import type { UIMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAttachmentSizesByObjectKey } from '@/lib/db/actions'

import { resolveAttachmentSizes } from '../attachment-sizes'

vi.mock('@/lib/db/actions', () => ({
  getAttachmentSizesByObjectKey: vi.fn()
}))

function messages(): UIMessage[] {
  return [
    {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Review these' },
        {
          type: 'file',
          mediaType: 'application/pdf',
          filename: 'a.pdf',
          url: 'https://example.com/a',
          key: 'files/a.pdf'
        },
        {
          type: 'file',
          mediaType: 'application/pdf',
          filename: 'b.pdf',
          url: 'https://example.com/b',
          key: 'files/b.pdf'
        },
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'no-key.png',
          url: 'data:image/png;base64,AAAA'
        }
      ]
    } as unknown as UIMessage
  ]
}

describe('resolveAttachmentSizes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('annotates only file parts with matching object keys', async () => {
    vi.mocked(getAttachmentSizesByObjectKey).mockResolvedValue(
      new Map([['files/a.pdf', 1234]])
    )
    const input = messages()

    const result = await resolveAttachmentSizes(input, 'user-1')

    expect(result).not.toBe(input)
    expect(result[0].parts[0]).toBe(input[0].parts[0])
    expect(result[0].parts[1]).toEqual({ ...input[0].parts[1], size: 1234 })
    expect(result[0].parts[2]).toBe(input[0].parts[2])
    expect(result[0].parts[3]).toBe(input[0].parts[3])
    expect(getAttachmentSizesByObjectKey).toHaveBeenCalledWith({
      userId: 'user-1',
      objectKeys: ['files/a.pdf', 'files/b.pdf']
    })
  })

  it('returns the input unchanged when no size matches', async () => {
    vi.mocked(getAttachmentSizesByObjectKey).mockResolvedValue(new Map())
    const input = messages()

    expect(await resolveAttachmentSizes(input, 'user-1')).toBe(input)
  })

  it('continues with unknown sizes when lookup fails', async () => {
    const error = new Error('database unavailable')
    vi.mocked(getAttachmentSizesByObjectKey).mockRejectedValue(error)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const input = messages()

    expect(await resolveAttachmentSizes(input, 'user-1')).toBe(input)
    expect(log).toHaveBeenCalledWith('Attachment size lookup failed:', error)

    log.mockRestore()
  })
})
