/**
 * Order is also detection order. PDF is the only format matched by scanning a
 * window instead of a fixed offset, so it stays last and the formats that claim
 * specific bytes get to answer for them first.
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'application/pdf'
] as const

export type SupportedFileType = (typeof ALLOWED_FILE_TYPES)[number]

/**
 * ISO base media file format brands that mean the container holds an MP4.
 *
 * The container is shared with formats that are not MP4 — QuickTime movies
 * (`qt  `) and M4A audio among them — and the brand in the `ftyp` box is what
 * separates them. Accepting the box alone would send audio to the model as a
 * video, which fails the turn at the provider instead of at the upload.
 */
const MP4_BRANDS = new Set([
  'avc1',
  'dash',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'isom',
  'mmp4',
  'mp41',
  'mp42'
])

const signatures: Record<SupportedFileType, (buffer: Buffer) => boolean> = {
  'image/jpeg': buffer =>
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/png': buffer =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  // The `ftyp` box opens the file with its own 4-byte length, so the box type
  // sits at bytes 4..8 and the brand always follows it at bytes 8..12.
  'video/mp4': buffer =>
    buffer.subarray(4, 8).equals(Buffer.from('ftyp', 'ascii')) &&
    MP4_BRANDS.has(buffer.subarray(8, 12).toString('ascii')),
  'application/pdf': buffer =>
    buffer.subarray(0, 1024).indexOf(Buffer.from('%PDF-', 'ascii')) !== -1
}

export function isSupportedFileType(value: string): value is SupportedFileType {
  return ALLOWED_FILE_TYPES.some(mediaType => mediaType === value)
}

export function detectFileMediaType(buffer: Buffer): SupportedFileType | null {
  for (const mediaType of ALLOWED_FILE_TYPES) {
    if (signatures[mediaType](buffer)) return mediaType
  }

  return null
}
