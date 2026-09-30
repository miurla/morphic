import { describe, expect, it } from 'vitest'

import {
  countFileParts,
  exceedsAttachmentLimit,
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

describe('exceedsAttachmentLimit', () => {
  const withFiles = (count: number) => ({
    role: 'user',
    parts: Array.from({ length: count }, () => ({ type: 'file' }))
  })

  it('checks the submitted message for authenticated users', () => {
    expect(
      exceedsAttachmentLimit({
        isGuest: false,
        trigger: 'submit-message',
        message: withFiles(4),
        messages: undefined
      })
    ).toBe(true)
    expect(
      exceedsAttachmentLimit({
        isGuest: false,
        trigger: 'submit-message',
        message: withFiles(3),
        messages: undefined
      })
    ).toBe(false)
  })

  it('treats a missing or unknown trigger as a submission', () => {
    for (const trigger of [undefined, 'something-else']) {
      expect(
        exceedsAttachmentLimit({
          isGuest: false,
          trigger,
          message: withFiles(4),
          messages: undefined
        })
      ).toBe(true)
    }
  })

  it('does not block regenerating an existing message', () => {
    expect(
      exceedsAttachmentLimit({
        isGuest: false,
        trigger: 'regenerate-message',
        message: withFiles(5),
        messages: undefined
      })
    ).toBe(false)
  })

  it('checks the guest history instead of the separate message field', () => {
    expect(
      exceedsAttachmentLimit({
        isGuest: true,
        trigger: 'submit-message',
        message: withFiles(0),
        messages: [withFiles(1), withFiles(4)]
      })
    ).toBe(true)
    expect(
      exceedsAttachmentLimit({
        isGuest: true,
        trigger: 'submit-message',
        message: withFiles(0),
        messages: [withFiles(3), withFiles(3)]
      })
    ).toBe(false)
  })
})
