import { NextRequest, NextResponse } from 'next/server'

import { TUTOR_LIMITS } from '@/lib/tutor/config'
import { enqueueDocumentParse } from '@/lib/tutor/queue'
import {
  publicDocument,
  resetDocumentPreparation,
  TutorRepositoryError
} from '@/lib/tutor/repository'
import { storeTutorDocumentStream } from '@/lib/tutor/storage'

import { tutorRoute } from '../_shared'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  return tutorRoute(request, async userId => {
    if (
      request.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase() !== 'application/octet-stream'
    )
      throw new TutorRepositoryError(
        'Upload a document.',
        'INVALID_REQUEST',
        400
      )
    let name: string
    try {
      name = decodeURIComponent(request.headers.get('x-tutor-filename') || '')
    } catch {
      throw new TutorRepositoryError(
        'The filename is invalid.',
        'INVALID_FILENAME',
        400
      )
    }
    const length = request.headers.get('content-length')
    if (length !== null && !/^\d+$/.test(length))
      throw new TutorRepositoryError(
        'The request is invalid.',
        'INVALID_REQUEST',
        400
      )
    if (
      length !== null &&
      (!Number.isSafeInteger(Number(length)) ||
        Number(length) > TUTOR_LIMITS.maxFileSize)
    )
      throw new TutorRepositoryError(
        'The request is too large.',
        'REQUEST_TOO_LARGE',
        413
      )
    if (!request.body)
      throw new TutorRepositoryError(
        'The request is empty.',
        'INVALID_REQUEST',
        400
      )
    let document = await storeTutorDocumentStream(userId, {
      name,
      stream: request.body,
      size: length === null ? undefined : Number(length),
      signal: request.signal
    })
    if (document.status === 'failed') {
      const retried = await resetDocumentPreparation(userId, document.id)
      if (!retried)
        throw new TutorRepositoryError(
          'The requested learning resource was not found.'
        )
      document = publicDocument(retried)
    }
    if (document.status !== 'parsed' && document.status !== 'ready') {
      try {
        await enqueueDocumentParse({ userId, documentId: document.id })
      } catch {
        throw new TutorRepositoryError(
          'The document was uploaded but could not be queued for parsing. Please retry.',
          'QUEUE_UNAVAILABLE',
          503
        )
      }
    }
    return NextResponse.json({ document }, { status: 201 })
  })
}
