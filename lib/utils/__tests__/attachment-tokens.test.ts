import { describe, expect, it } from 'vitest'

import {
  BYTES_PER_TOKEN,
  estimateAttachmentTokens,
  IMAGE_ATTACHMENT_TOKENS,
  MIN_PDF_ATTACHMENT_TOKENS,
  PDF_BYTES_PER_TOKEN,
  UNKNOWN_ATTACHMENT_TOKENS
} from '../attachment-tokens'

describe('estimateAttachmentTokens', () => {
  it('uses a fixed estimate for images', () => {
    expect(
      estimateAttachmentTokens({ mediaType: 'image/png', size: 20_000_000 })
    ).toBe(IMAGE_ATTACHMENT_TOKENS)
  })

  it('uses a floor for small PDFs and scales large PDFs conservatively', () => {
    expect(
      estimateAttachmentTokens({ mediaType: 'application/pdf', size: 3_901 })
    ).toBe(MIN_PDF_ATTACHMENT_TOKENS)
    expect(
      estimateAttachmentTokens({
        mediaType: 'application/pdf',
        size: 20_000_000
      })
    ).toBe(Math.ceil(20_000_000 / PDF_BYTES_PER_TOKEN))
  })

  it('uses a conservative PDF estimate when size is unavailable', () => {
    expect(estimateAttachmentTokens({ mediaType: 'application/pdf' })).toBe(
      UNKNOWN_ATTACHMENT_TOKENS
    )
    expect(
      estimateAttachmentTokens({ mediaType: 'application/pdf', size: null })
    ).toBe(UNKNOWN_ATTACHMENT_TOKENS)
  })

  it('estimates an unrecognized media type from its byte length', () => {
    expect(
      estimateAttachmentTokens({
        mediaType: 'application/octet-stream',
        size: 3_901
      })
    ).toBe(Math.ceil(3_901 / BYTES_PER_TOKEN))
  })

  it('uses the unknown estimate when neither type nor size says anything', () => {
    expect(estimateAttachmentTokens({})).toBe(UNKNOWN_ATTACHMENT_TOKENS)
  })
})
