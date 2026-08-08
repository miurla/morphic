export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf'
] as const

export type SupportedFileType = (typeof ALLOWED_FILE_TYPES)[number]

const signatures: Record<SupportedFileType, (buffer: Buffer) => boolean> = {
  'image/jpeg': buffer =>
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/png': buffer =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
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
