export const IMAGE_ATTACHMENT_TOKENS = 10_000
export const MIN_PDF_ATTACHMENT_TOKENS = 10_000
// A 500 KB PDF reaches the small-document floor; larger containers scale so
// multi-page files cannot all hide behind a flat estimate.
export const PDF_BYTES_PER_TOKEN = 50
export const BYTES_PER_TOKEN = 3.9
export const UNKNOWN_ATTACHMENT_TOKENS = 50_000

export function estimateAttachmentTokens({
  mediaType,
  size
}: {
  mediaType?: string
  size?: number | null
}): number {
  // Provider processing for images is based on rendered content, so compressed
  // file size is not a useful proxy for its token cost.
  if (mediaType?.startsWith('image/')) return IMAGE_ATTACHMENT_TOKENS

  // PDF bytes are compressed and therefore expand into substantially fewer
  // tokens than text bytes. Keep a floor for small documents while retaining a
  // conservative size signal for long, multi-page files.
  if (mediaType === 'application/pdf') {
    if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
      return Math.max(
        MIN_PDF_ATTACHMENT_TOKENS,
        Math.ceil(size / PDF_BYTES_PER_TOKEN)
      )
    }

    return UNKNOWN_ATTACHMENT_TOKENS
  }

  // Retain byte-based estimation for text-like formats added in the future.
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    return Math.ceil(size / BYTES_PER_TOKEN)
  }

  return UNKNOWN_ATTACHMENT_TOKENS
}
