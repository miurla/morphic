import { chunkDocument } from '../lib/tutor/chunking'
import { assertDocumentTextBudget } from '../lib/tutor/document-budget'
import { parseTutorDocument } from '../lib/tutor/documents'
import { safeTutorError, TutorError } from '../lib/tutor/errors'
import { getDocument } from '../lib/tutor/repository'
import { readTutorDocument } from '../lib/tutor/storage'

process.once(
  'message',
  async (input: { userId: string; documentId: string }) => {
    try {
      const document = await getDocument(input.userId, input.documentId)
      if (!document) throw new Error('Missing document')
      const bytes = await readTutorDocument(input.userId, input.documentId)
      const parsed = await parseTutorDocument(bytes, document.filename)
      const chunks = chunkDocument({
        documentId: document.id,
        filename: document.filename,
        parsed
      })
      const tokenCount = chunks.reduce(
        (sum, chunk) => sum + chunk.tokenCount,
        0
      )
      if (!chunks.length)
        throw new TutorError(
          'No readable text was found in this document.',
          'NO_TEXT'
        )
      assertDocumentTextBudget(tokenCount, chunks.length)
      process.send?.({
        result: { parsed, chunks, tokenCount, chunkCount: chunks.length }
      })
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'PARSE_FAILED'
      process.send?.({ error: { message: safeTutorError(error), code } })
    }
  }
)
