import { describe, expect, it } from 'vitest'

import {
  countFileParts,
  MAX_ATTACHMENTS_PER_MESSAGE,
  remainingAttachmentSlots
} from '../attachment-limits'

describe('countFileParts', () => {
  it('counts only file parts', () => {
    expect(
      countFileParts({
        parts: [
          { type: 'text', text: 'hi' },
          { type: 'file', mediaType: 'application/pdf' },
          { type: 'data-pastedContent', data: { text: 'x' } },
          { type: 'file', mediaType: 'image/png' }
        ]
      })
    ).toBe(2)
  })

  it('returns 0 for malformed input', () => {
    expect(countFileParts(undefined)).toBe(0)
    expect(countFileParts(null)).toBe(0)
    expect(countFileParts({ parts: 'file' })).toBe(0)
    expect(countFileParts({ parts: [null, 'file'] })).toBe(0)
  })
})

describe('remainingAttachmentSlots', () => {
  it('counts down to zero and never goes negative', () => {
    expect(remainingAttachmentSlots(0)).toBe(MAX_ATTACHMENTS_PER_MESSAGE)
    expect(remainingAttachmentSlots(MAX_ATTACHMENTS_PER_MESSAGE)).toBe(0)
    expect(remainingAttachmentSlots(MAX_ATTACHMENTS_PER_MESSAGE + 2)).toBe(0)
  })
})
