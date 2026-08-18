export const IMAGE_ATTACHMENT_TOKENS = 10_000
// A clip is sampled into frames, so it costs a small multiple of a single
// image rather than what its bytes expand into. The upload size ceiling bounds
// how long a clip can be, which is what keeps a fixed estimate usable here.
export const VIDEO_ATTACHMENT_TOKENS = 5 * IMAGE_ATTACHMENT_TOKENS
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
  // length. A video is sampled the same way, and reading it by byte length
  // instead would price one short clip above a whole conversation and evict
  // every other attachment to make room for it.
  if (mediaType?.startsWith('image/')) return IMAGE_ATTACHMENT_TOKENS
  if (mediaType?.startsWith('video/')) return VIDEO_ATTACHMENT_TOKENS

  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    return Math.ceil(size / BYTES_PER_TOKEN)
  }

  return UNKNOWN_ATTACHMENT_TOKENS
}
