import { getEncoding } from 'js-tiktoken'
import { createHash } from 'node:crypto'

import { buildLexicalText } from './lexical'
import type {
  ParsedPdf,
  ParsedPdfBlock,
  SourceRegion,
  TutorChunk
} from './types'

export const CHUNKING_VERSION = 'tutor-structured-v1'
export const CHILD_TARGET_TOKENS = 450
export const CHILD_MAX_TOKENS = 600
export const PARENT_TARGET_TOKENS = 1400
export const PARENT_MAX_TOKENS = 1800
const FORCED_SPLIT_OVERLAP = 60
const encoder = getEncoding('cl100k_base')

export function countTokens(text: string): number {
  return encoder.encode(text).length
}

function stableId(...parts: (string | number)[]): string {
  return createHash('sha256')
    .update(parts.join('\u0000'))
    .digest('hex')
    .slice(0, 32)
}

/** Split at Unicode scalar boundaries; splitting token bytes can corrupt CJK. */
export function splitLongText(
  text: string,
  maxTokens = CHILD_MAX_TOKENS,
  overlap = FORCED_SPLIT_OVERLAP
): string[] {
  if (maxTokens < 4 || overlap < 0 || overlap >= maxTokens)
    throw new Error('Invalid chunk token budget.')
  if (countTokens(text) <= maxTokens) return [text]
  const chars = Array.from(text)
  const pieces: string[] = []
  let start = 0
  while (start < chars.length) {
    let low = start + 1
    let high = Math.min(chars.length, start + maxTokens * 8)
    let end = low
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (countTokens(chars.slice(start, mid).join('')) <= maxTokens) {
        end = mid
        low = mid + 1
      } else high = mid - 1
    }
    // Prefer a nearby sentence boundary, without producing tiny fragments.
    if (end < chars.length) {
      const minimum = start + Math.floor((end - start) * 0.7)
      for (let index = end - 1; index > minimum; index--) {
        if (/[。！？!?\n]/u.test(chars[index])) {
          end = index + 1
          break
        }
      }
    }
    pieces.push(chars.slice(start, end).join(''))
    if (end === chars.length) break
    let next = end
    while (
      next > start + 1 &&
      countTokens(chars.slice(next - 1, end).join('')) <= overlap
    )
      next--
    start = Math.max(start + 1, next)
  }
  return pieces
}

function uniqueRegions(blocks: ParsedPdfBlock[]): SourceRegion[] {
  const seen = new Set<string>()
  return blocks
    .map(block => block.region)
    .filter(region => {
      const key = JSON.stringify(region)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function chunkDocument({
  documentId,
  filename,
  parsed
}: {
  documentId: string
  filename: string
  parsed: ParsedPdf
}): TutorChunk[] {
  const blocks = parsed.blocks
    .filter(block => block.text.trim())
    .flatMap(block =>
      splitLongText(block.text).map(text => ({ ...block, text }))
    )
  const parents: { blocks: ParsedPdfBlock[]; heading: string }[] = []
  let parent: ParsedPdfBlock[] = []
  let heading = filename
  let parentTokens = 0
  const flushParent = () => {
    if (parent.length) parents.push({ blocks: parent, heading })
    parent = []
    parentTokens = 0
  }
  for (const block of blocks) {
    const tokens = countTokens(block.text) + 1
    if (block.heading && parent.length) flushParent()
    if (block.heading) heading = block.text
    if (
      parentTokens + tokens > PARENT_MAX_TOKENS ||
      parentTokens >= PARENT_TARGET_TOKENS
    )
      flushParent()
    parent.push(block)
    parentTokens += tokens
  }
  flushParent()

  const chunks: TutorChunk[] = []
  parents.forEach((group, parentIndex) => {
    const parentText = group.blocks.map(block => block.text).join('\n')
    const parentId = stableId(
      documentId,
      CHUNKING_VERSION,
      'parent',
      parentIndex,
      parentText
    )
    let child: ParsedPdfBlock[] = []
    let childTokens = 0
    const flushChild = () => {
      if (!child.length) return
      const text = child.map(block => block.text).join('\n')
      const position = chunks.length
      const retrievalText = `${filename}\n${group.heading}\n${text}`
      chunks.push({
        id: stableId(documentId, CHUNKING_VERSION, position, text),
        documentId,
        parentId,
        position,
        text,
        parentText,
        retrievalText,
        lexicalText: buildLexicalText(retrievalText),
        heading: group.heading,
        regions: uniqueRegions(child),
        tokenCount: countTokens(text)
      })
      child = []
      childTokens = 0
    }
    for (const block of group.blocks) {
      const tokens = countTokens(block.text) + (child.length ? 1 : 0)
      if (child.length && childTokens + tokens > CHILD_MAX_TOKENS) flushChild()
      child.push(block)
      childTokens += countTokens(block.text) + (child.length > 1 ? 1 : 0)
      if (
        childTokens >= CHILD_TARGET_TOKENS &&
        /[。！？.!?:：]$/.test(block.text.trim())
      )
        flushChild()
    }
    flushChild()
  })
  return chunks
}
