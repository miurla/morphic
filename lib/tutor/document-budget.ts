import { getTutorDocumentFormat } from './document-formats'
import { TutorError } from './errors'
import { TUTOR_LIMITS } from './server-limits'
import type { ParsedPdf } from './types'

export interface DocumentBudget {
  filename?: string
  size: number
  pageCount: number | null
  tokenCount?: number | null
  chunkCount?: number | null
}

/** Enforced again by the worker before any embedding requests are made. */
export function assertCourseDocumentBudget(documents: DocumentBudget[]) {
  for (const document of documents) {
    assertDocumentTextBudget(document.tokenCount ?? 0, document.chunkCount ?? 0)
    if (
      document.filename &&
      getTutorDocumentFormat(document.filename) === 'pdf' &&
      (document.pageCount ?? 0) > TUTOR_LIMITS.maxPdfPages
    )
      throw new TutorError(
        'This PDF exceeds the page limit. Split it into smaller files.',
        'PDF_PAGE_LIMIT',
        422
      )
  }
  const total = (key: Exclude<keyof DocumentBudget, 'filename'>) =>
    documents.reduce((sum, document) => sum + (document[key] ?? 0), 0)
  const checks = [
    [
      documents.length,
      TUTOR_LIMITS.maxFiles,
      'COURSE_FILE_LIMIT',
      'file count'
    ],
    [
      total('size'),
      TUTOR_LIMITS.maxCourseSize,
      'COURSE_SIZE_LIMIT',
      'total file size'
    ],
    [
      total('pageCount'),
      TUTOR_LIMITS.maxPages,
      'COURSE_PAGE_LIMIT',
      'page or text segment'
    ],
    [
      total('tokenCount'),
      TUTOR_LIMITS.maxCourseTokens,
      'COURSE_TOKEN_LIMIT',
      'text token'
    ],
    [
      total('chunkCount'),
      TUTOR_LIMITS.maxCourseChunks,
      'COURSE_CHUNK_LIMIT',
      'text chunk'
    ]
  ] as const
  for (const [actual, limit, code, label] of checks) {
    if (actual > limit)
      throw new TutorError(
        `The materials exceed the course ${label} limit. Select fewer materials or split them into separate courses.`,
        code,
        422
      )
  }
}

export function assertDocumentTextBudget(
  tokenCount: number,
  chunkCount: number
) {
  if (
    tokenCount > TUTOR_LIMITS.maxDocumentTokens ||
    chunkCount > TUTOR_LIMITS.maxDocumentChunks
  )
    throw new TutorError(
      'This document contains too much text. Split it into smaller files.',
      'DOCUMENT_TEXT_LIMIT',
      422
    )
}

export function assertParsedDocumentBudget(
  parsed: ParsedPdf,
  filename: string
) {
  if (
    getTutorDocumentFormat(filename) === 'pdf' &&
    parsed.pageCount > TUTOR_LIMITS.maxPdfPages
  )
    throw new TutorError(
      'This PDF exceeds the page limit. Split it into smaller files.',
      'PDF_PAGE_LIMIT',
      422
    )
  if (
    parsed.blocks.reduce((sum, block) => sum + block.text.length, 0) >
    TUTOR_LIMITS.maxTextCharacters
  )
    throw new TutorError(
      'This document contains too much text. Split it into smaller files.',
      'DOCUMENT_TEXT_LIMIT',
      422
    )
}
