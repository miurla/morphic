import { TUTOR_LIMITS } from './server-limits'
import type { ParsedPdf, ParsedPdfBlock, SourceRegion } from './types'

export const MAX_PDF_PAGES = TUTOR_LIMITS.maxPdfPages
export const MAX_PDF_TEXT_CHARACTERS = TUTOR_LIMITS.maxTextCharacters

export class PdfExtractionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'PdfExtractionError'
  }
}

interface PositionedText {
  text: string
  region: SourceRegion
  fontHeight: number
  endOfLine: boolean
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function unionRegions(regions: SourceRegion[]): SourceRegion[] {
  const pages = new Map<number, SourceRegion[]>()
  for (const region of regions) {
    const list = pages.get(region.page) ?? []
    list.push(region)
    pages.set(region.page, list)
  }
  return [...pages.values()].map(items => {
    const x = Math.min(...items.map(item => item.x))
    const y = Math.min(...items.map(item => item.y))
    return {
      page: items[0].page,
      x,
      y,
      width: Math.max(...items.map(item => item.x + item.width)) - x,
      height: Math.max(...items.map(item => item.y + item.height)) - y
    }
  })
}

/** Group physical text runs into lines without merging two distant columns. */
export function groupTextRuns(runs: PositionedText[]): ParsedPdfBlock[] {
  if (!runs.length) return []
  const sizes = runs.map(run => run.fontHeight).sort((a, b) => a - b)
  const medianSize = sizes[Math.floor(sizes.length / 2)]
  const lines: PositionedText[][] = []
  for (const run of [...runs].sort(
    (a, b) => a.region.y - b.region.y || a.region.x - b.region.x
  )) {
    const line = lines.slice(-12).find(items => {
      const first = items[0]
      const last = items[items.length - 1]
      const yTolerance = Math.min(first.region.height, run.region.height) * 0.45
      const gap = run.region.x - last.region.x - last.region.width
      return (
        Math.abs(first.region.y - run.region.y) <= yTolerance &&
        gap >= -0.015 &&
        gap < 0.04
      )
    })
    if (line) line.push(run)
    else lines.push([run])
  }
  const blocks = lines.map(items => {
    items.sort((a, b) => a.region.x - b.region.x)
    const text = items
      .reduce((result, run, index) => {
        if (!index) return run.text
        const previous = items[index - 1]
        const gap = run.region.x - previous.region.x - previous.region.width
        const adjacentCjk =
          /[\p{Script=Han}]$/u.test(result) &&
          /^[\p{Script=Han}]/u.test(run.text)
        return result + (adjacentCjk || gap < 0.001 ? '' : ' ') + run.text
      }, '')
      .trim()
    return {
      text,
      region: unionRegions(items.map(item => item.region))[0],
      heading:
        text.length < 160 &&
        items.some(item => item.fontHeight > medianSize * 1.22)
    }
  })
  // A consistent gutter gives a conservative two-column reading order. Wide
  // headings stay ahead of the following columns, rather than entering one.
  const left = blocks.filter(
    block =>
      block.region.x < 0.45 && block.region.x + block.region.width <= 0.53
  )
  const right = blocks.filter(block => block.region.x >= 0.47)
  if (left.length >= 5 && right.length >= 5) {
    const wide = blocks.filter(
      block => !left.includes(block) && !right.includes(block)
    )
    const result: ParsedPdfBlock[] = []
    let start = -1
    for (const separator of [
      ...wide.sort((a, b) => a.region.y - b.region.y),
      null
    ]) {
      const end = separator?.region.y ?? 2
      result.push(
        ...left.filter(block => block.region.y >= start && block.region.y < end)
      )
      result.push(
        ...right.filter(
          block => block.region.y >= start && block.region.y < end
        )
      )
      if (separator) result.push(separator)
      start = end
    }
    return result
  }
  return blocks
}

/** Remove only exact repeated margin text; body repetitions remain evidence. */
export function removeRepeatedMargins(
  blocks: ParsedPdfBlock[],
  pageCount: number
): ParsedPdfBlock[] {
  if (pageCount < 3) return blocks
  const pages = new Map<string, Set<number>>()
  for (const block of blocks) {
    if (block.region.y > 0.08 && block.region.y + block.region.height < 0.93)
      continue
    const key = block.text.trim()
    if (key.length > 180) continue
    const seen = pages.get(key) ?? new Set<number>()
    seen.add(block.region.page)
    pages.set(key, seen)
  }
  return blocks.filter(block => {
    const margin =
      block.region.y <= 0.08 || block.region.y + block.region.height >= 0.93
    return (
      !margin ||
      (pages.get(block.text.trim())?.size ?? 0) <
        Math.max(3, Math.ceil(pageCount * 0.6))
    )
  })
}

export async function parsePdf(data: Uint8Array): Promise<ParsedPdf> {
  if (new TextDecoder().decode(data.subarray(0, 1024)).indexOf('%PDF-') < 0) {
    throw new PdfExtractionError('INVALID_PDF', 'The file is not a valid PDF.')
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    enableXfa: false,
    stopAtErrors: true,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  })
  try {
    const document = await task.promise
    if (document.numPages > TUTOR_LIMITS.maxPdfPages) {
      throw new PdfExtractionError(
        'PDF_PAGE_LIMIT',
        'This PDF exceeds the page limit. Split it into smaller files.'
      )
    }
    const allBlocks: ParsedPdfBlock[] = []
    const emptyPages: number[] = []
    let characterCount = 0
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const runs: PositionedText[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const matrix = pdfjs.Util.transform(viewport.transform, item.transform)
        const horizontal = Math.hypot(matrix[0], matrix[1]) || 1
        const height = Math.hypot(matrix[2], matrix[3]) || item.height
        const width = item.width * viewport.scale
        const ascent = content.styles[item.fontName]?.ascent ?? 0.85
        const descent = content.styles[item.fontName]?.descent ?? -0.15
        const points = [ascent, descent].flatMap(offset =>
          [0, width].map(distance => ({
            x:
              matrix[4] +
              (matrix[0] / horizontal) * distance +
              matrix[2] * offset,
            y:
              matrix[5] +
              (matrix[1] / horizontal) * distance +
              matrix[3] * offset
          }))
        )
        const x = clamp(
          Math.min(...points.map(point => point.x)) / viewport.width
        )
        const y = clamp(
          Math.min(...points.map(point => point.y)) / viewport.height
        )
        const right = clamp(
          Math.max(...points.map(point => point.x)) / viewport.width
        )
        const bottom = clamp(
          Math.max(...points.map(point => point.y)) / viewport.height
        )
        if (!Number.isFinite(x + y + right + bottom)) continue
        runs.push({
          text: item.str,
          region: { page: number, x, y, width: right - x, height: bottom - y },
          fontHeight: height,
          endOfLine: item.hasEOL
        })
      }
      const blocks = groupTextRuns(runs)
      const length = blocks.reduce((sum, block) => sum + block.text.length, 0)
      if (length < 20) emptyPages.push(number)
      characterCount += length
      if (characterCount > TUTOR_LIMITS.maxTextCharacters) {
        throw new PdfExtractionError(
          'PDF_TEXT_LIMIT',
          'This PDF contains too much text. Split it into smaller files.'
        )
      }
      allBlocks.push(...blocks)
      page.cleanup()
    }
    if (characterCount < 100) {
      throw new PdfExtractionError(
        'PDF_NO_TEXT',
        'No usable text was found. Upload a text-based PDF; scanned documents need OCR.'
      )
    }
    // A mostly scanned mixed PDF must not silently become an incomplete course.
    if (emptyPages.length > document.numPages * 0.5 && document.numPages > 2) {
      throw new PdfExtractionError(
        'PDF_INCOMPLETE_TEXT',
        'Most pages have no readable text. Upload a text-based PDF.'
      )
    }
    return {
      pageCount: document.numPages,
      blocks: removeRepeatedMargins(allBlocks, document.numPages),
      warnings: emptyPages.length
        ? [`Pages with little or no extracted text: ${emptyPages.join(', ')}`]
        : []
    }
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfExtractionError(
        'PDF_PASSWORD',
        'Password-protected PDFs are not supported.'
      )
    }
    throw new PdfExtractionError(
      'PDF_PARSE_FAILED',
      'The PDF could not be read. Try exporting it as a new text-based PDF.'
    )
  } finally {
    await task.destroy()
  }
}
