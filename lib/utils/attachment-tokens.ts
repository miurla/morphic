export const IMAGE_ATTACHMENT_TOKENS = 10_000
export const BYTES_PER_TOKEN = 3.9
export const UNKNOWN_ATTACHMENT_TOKENS = 50_000

export function estimateAttachmentTokens({
  mediaType,
  size
}: {
  mediaType?: string
  size?: number | null
}): number {
  // An image is tiled by the provider, so its cost does not follow its byte
  // length. Every other document is charged for what its bytes expand into.
  if (mediaType?.startsWith('image/')) return IMAGE_ATTACHMENT_TOKENS

  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    return Math.ceil(size / BYTES_PER_TOKEN)
  }

  return UNKNOWN_ATTACHMENT_TOKENS
}
