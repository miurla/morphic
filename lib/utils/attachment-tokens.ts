export const IMAGE_ATTACHMENT_TOKENS = 10_000
export const PDF_ATTACHMENT_TOKENS = 10_000
export const BYTES_PER_TOKEN = 3.9
export const UNKNOWN_ATTACHMENT_TOKENS = 50_000

export function estimateAttachmentTokens({
  mediaType,
  size
}: {
  mediaType?: string
  size?: number | null
}): number {
  // Provider processing for images and PDFs is based on rendered content, so
  // compressed file size is not a useful proxy for their token cost.
  if (mediaType?.startsWith('image/')) return IMAGE_ATTACHMENT_TOKENS
  if (mediaType === 'application/pdf') return PDF_ATTACHMENT_TOKENS

  // Retain byte-based estimation for text-like formats added in the future.
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    return Math.ceil(size / BYTES_PER_TOKEN)
  }

  return UNKNOWN_ATTACHMENT_TOKENS
}
