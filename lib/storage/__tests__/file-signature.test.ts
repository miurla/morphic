import { describe, expect, it } from 'vitest'

import { detectFileMediaType } from '../file-signature'

describe('detectFileMediaType', () => {
  it('detects JPEG content', () => {
    expect(detectFileMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg'
    )
  })

  it('detects PNG content', () => {
    expect(
      detectFileMediaType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png')
  })

  it('detects PDF content', () => {
    expect(detectFileMediaType(Buffer.from('%PDF-1.7', 'ascii'))).toBe(
      'application/pdf'
    )
  })

  it('detects a PDF header after a preamble', () => {
    expect(
      detectFileMediaType(Buffer.from('preamble\n%PDF-1.7', 'ascii'))
    ).toBe('application/pdf')
  })

  it('rejects the MP4 content from the production upload', () => {
    expect(
      detectFileMediaType(
        Buffer.from([
          0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d
        ])
      )
    ).toBeNull()
  })

  it('rejects empty and short content', () => {
    expect(detectFileMediaType(Buffer.alloc(0))).toBeNull()
    expect(detectFileMediaType(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})
