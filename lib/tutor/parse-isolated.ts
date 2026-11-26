import { spawn } from 'node:child_process'
import path from 'node:path'

import { TutorError } from './errors'
import { TUTOR_LIMITS } from './server-limits'
import type { ParsedPdf, TutorChunk } from './types'

export interface PreparedDocument {
  parsed: ParsedPdf
  tokenCount: number
  chunkCount: number
  chunks: TutorChunk[]
}

/** Killable process boundary also covers synchronous DOCX XML and tokenization. */
export function parseDocumentIsolated(
  userId: string,
  documentId: string,
  options: {
    signal?: AbortSignal
    scriptPath?: string
    timeoutMs?: number
  } = {}
): Promise<PreparedDocument> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(
        new TutorError('Document preparation was cancelled.', 'PARSE_CANCELLED')
      )
      return
    }
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        `--max-old-space-size=${TUTOR_LIMITS.parseMemoryMb}`,
        options.scriptPath ??
          path.join(process.cwd(), 'scripts', 'tutor-parse-worker.ts')
      ],
      {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        serialization: 'advanced',
        windowsHide: true
      }
    )
    let settled = false
    const finish = (error?: Error, result?: PreparedDocument) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
      // SIGKILL also stops synchronous parsers; Promise.race alone does not.
      if (child.exitCode === null) child.kill('SIGKILL')
      if (error) reject(error)
      else resolve(result!)
    }
    const abort = () =>
      finish(
        new TutorError('Document preparation was cancelled.', 'PARSE_CANCELLED')
      )
    const timeout = setTimeout(
      () =>
        finish(
          new TutorError(
            'Document preparation timed out. Split the file into smaller files and retry.',
            'PARSE_TIMEOUT',
            422
          )
        ),
      options.timeoutMs ?? TUTOR_LIMITS.parseTimeoutMs
    )
    options.signal?.addEventListener('abort', abort, { once: true })
    child.on('error', () =>
      finish(
        new TutorError(
          'Document preparation is unavailable. Please retry.',
          'PARSE_UNAVAILABLE',
          503
        )
      )
    )
    child.on('exit', () =>
      finish(
        new TutorError(
          'Document preparation exceeded its resources or stopped. Split the file into smaller files and retry.',
          'PARSE_RESOURCE_LIMIT',
          422
        )
      )
    )
    child.on(
      'message',
      (message: {
        result?: PreparedDocument
        error?: { message: string; code: string }
      }) => {
        if (message.error)
          finish(new TutorError(message.error.message, message.error.code, 422))
        else if (message.result) finish(undefined, message.result)
      }
    )
    child.send({ userId, documentId }, error => {
      if (error)
        finish(
          new TutorError(
            'Document preparation is unavailable. Please retry.',
            'PARSE_UNAVAILABLE',
            503
          )
        )
    })
  })
}
