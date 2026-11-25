// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { groupTextRuns, parsePdf, removeRepeatedMargins } from '../pdf'
import type { ParsedPdfBlock } from '../types'

/** A real, minimal PDF fixture: byte offsets and stream lengths are computed. */
function makePdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 40 750 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const start = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return new Uint8Array(Buffer.from(pdf))
}

describe('Tutor PDF extraction', () => {
  it('extracts real PDF text with normalized on-page source regions', async () => {
    const text =
      'Database transactions preserve consistency. Atomicity makes related changes succeed or fail together. Isolation separates concurrent transactions.'
    const result = await parsePdf(makePdf(text))
    expect(result.pageCount).toBe(1)
    expect(result.blocks.map(block => block.text).join(' ')).toContain(
      'Database transactions'
    )
    for (const block of result.blocks) {
      expect(block.region.page).toBe(1)
      expect(block.region.x).toBeGreaterThanOrEqual(0)
      expect(block.region.y).toBeGreaterThanOrEqual(0)
      expect(block.region.x + block.region.width).toBeLessThanOrEqual(1)
      expect(block.region.y + block.region.height).toBeLessThanOrEqual(1)
    }
  })

  it('rejects documents without usable text rather than generating an empty course', async () => {
    await expect(parsePdf(makePdf(''))).rejects.toMatchObject({
      code: 'PDF_NO_TEXT'
    })
    await expect(
      parsePdf(new TextEncoder().encode('not a PDF'))
    ).rejects.toMatchObject({ code: 'INVALID_PDF' })
  })

  it('only removes repeated margin text, retaining repeated body evidence', () => {
    const blocks: ParsedPdfBlock[] = [1, 2, 3].flatMap(page => [
      {
        text: 'Course header',
        region: { page, x: 0.1, y: 0.02, width: 0.5, height: 0.02 }
      },
      {
        text: 'Important repeated definition',
        region: { page, x: 0.1, y: 0.4, width: 0.5, height: 0.02 }
      }
    ])
    expect(removeRepeatedMargins(blocks, 3).map(block => block.text)).toEqual(
      Array(3).fill('Important repeated definition')
    )
  })

  it('does not join two columns into a fabricated sentence', () => {
    const runs = [
      {
        text: 'Left column',
        region: { page: 1, x: 0.1, y: 0.2, width: 0.2, height: 0.02 },
        fontHeight: 12,
        endOfLine: true
      },
      {
        text: 'Right column',
        region: { page: 1, x: 0.6, y: 0.2, width: 0.2, height: 0.02 },
        fontHeight: 12,
        endOfLine: true
      }
    ]
    expect(groupTextRuns(runs).map(block => block.text)).toEqual([
      'Left column',
      'Right column'
    ])
  })
})
