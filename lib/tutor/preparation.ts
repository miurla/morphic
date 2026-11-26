import { CHUNKING_VERSION } from './chunking'
import {
  assertDocumentTextBudget,
  assertParsedDocumentBudget
} from './document-budget'
import { safeTutorError, TutorError } from './errors'
import { parseDocumentIsolated, type PreparedDocument } from './parse-isolated'
import * as repository from './repository'

export const DOCUMENT_PARSER_VERSION = `${CHUNKING_VERSION}:preparation-v2`
const inFlight = new Map<string, Promise<PreparedDocument | null>>()

export async function prepareDocument(
  userId: string,
  documentId: string
): Promise<PreparedDocument | null> {
  const key = JSON.stringify([userId, documentId])
  const existing = inFlight.get(key)
  if (existing) return existing
  const operation = prepare(userId, documentId)
  inFlight.set(key, operation)
  try {
    return await operation
  } finally {
    inFlight.delete(key)
  }
}

async function prepare(
  userId: string,
  documentId: string
): Promise<PreparedDocument | null> {
  try {
    const document = await repository.getDocument(userId, documentId)
    if (!document)
      throw new TutorError(
        'The requested learning resource was not found.',
        'NOT_FOUND',
        404
      )
    if (document.status === 'ready') return null
    const cached = await repository.getDocumentParse(
      userId,
      documentId,
      document.contentHash,
      DOCUMENT_PARSER_VERSION
    )
    if (
      cached?.chunks &&
      document.tokenCount !== null &&
      document.chunkCount !== null
    ) {
      assertParsedDocumentBudget(cached, document.filename)
      assertDocumentTextBudget(document.tokenCount, document.chunkCount)
      const { chunks, ...parsed } = cached
      if (document.status !== 'parsed')
        await repository.saveDocumentParse(userId, documentId, {
          parsed: cached,
          chunks: cached.chunks,
          contentHash: document.contentHash,
          parserVersion: DOCUMENT_PARSER_VERSION,
          tokenCount: document.tokenCount,
          chunkCount: document.chunkCount
        })
      return {
        parsed,
        chunks,
        tokenCount: document.tokenCount,
        chunkCount: document.chunkCount
      }
    }
    await repository.startDocumentPreparation(
      userId,
      documentId,
      DOCUMENT_PARSER_VERSION
    )
    const result = await parseDocumentIsolated(userId, documentId)
    assertParsedDocumentBudget(result.parsed, document.filename)
    assertDocumentTextBudget(result.tokenCount, result.chunkCount)
    await repository.saveDocumentParse(userId, documentId, {
      ...result,
      contentHash: document.contentHash,
      parserVersion: DOCUMENT_PARSER_VERSION
    })
    return result
  } catch (error) {
    // Queue state remains the fallback if the database itself is unavailable.
    try {
      await repository.updateDocument(userId, documentId, {
        status: 'failed',
        error: safeTutorError(error)
      })
    } catch {
      /* A GET can still expose the terminal queue state for retry. */
    }
    throw error
  }
}

export async function processDocumentParse(input: {
  userId: string
  documentId: string
}) {
  await prepareDocument(input.userId, input.documentId)
}
