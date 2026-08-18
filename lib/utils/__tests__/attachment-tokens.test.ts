import { describe, expect, it } from 'vitest'

import {
  BYTES_PER_TOKEN,
  estimateAttachmentTokens,
  IMAGE_ATTACHMENT_TOKENS,
  UNKNOWN_ATTACHMENT_TOKENS,
  VIDEO_ATTACHMENT_TOKENS
} from '../attachment-tokens'

describe('estimateAttachmentTokens', () => {
  it('uses a fixed estimate for images', () => {
    expect(
      estimateAttachmentTokens({ mediaType: 'image/png', size: 20_000_000 })
    ).toBe(IMAGE_ATTACHMENT_TOKENS)
  })

  it('uses a fixed estimate for video, not its byte length', () => {
    // Byte expansion would price one clip above the whole attachment budget and
    // drop every other file replayed to the model.
    expect(
      estimateAttachmentTokens({ mediaType: 'video/mp4', size: 5_000_000 })
    ).toBe(VIDEO_ATTACHMENT_TOKENS)
  })

  it('costs a clip above a single image', () => {
    expect(VIDEO_ATTACHMENT_TOKENS).toBeGreaterThan(IMAGE_ATTACHMENT_TOKENS)
  })

  it('estimates known PDF sizes from their byte length', () => {
    expect(
      estimateAttachmentTokens({ mediaType: 'application/pdf', size: 3_901 })
    ).toBe(Math.ceil(3_901 / BYTES_PER_TOKEN))
  })

  it('uses the unknown estimate when size is unavailable', () => {
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
