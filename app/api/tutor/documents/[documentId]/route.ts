import { NextRequest, NextResponse } from 'next/server'

import { enqueueDocumentParse, getDocumentParseState } from '@/lib/tutor/queue'
import {
  getDocument,
  publicDocument,
  resetDocumentPreparation,
  TutorRepositoryError
} from '@/lib/tutor/repository'

import { tutorRoute } from '../../_shared'

export const runtime = 'nodejs'
type Context = { params: Promise<{ documentId: string }> }

export async function GET(request: NextRequest, context: Context) {
  return tutorRoute(request, async userId => {
    const { documentId } = await context.params
    let document = await getDocument(userId, documentId)
    if (!document)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    if (document.status === 'uploaded' || document.status === 'parsing') {
      const state = await getDocumentParseState({ userId, documentId })
      if (state !== 'pending') {
        // Publication may have completed while consulting the queue.
        document = await getDocument(userId, documentId)
        if (!document)
          throw new TutorRepositoryError(
            'The requested learning resource was not found.'
          )
        if (document.status === 'uploaded' || document.status === 'parsing') {
          // Project a retryable failure without mutating: a concurrent retry
          // may already be starting, and a crashed worker may not have saved
          // its terminal status to PostgreSQL.
          document = {
            ...document,
            status: 'failed',
            error: 'Document preparation stopped. Retry to continue.'
          }
        }
      }
    }
    return NextResponse.json(
      { document: publicDocument(document) },
      { headers: { 'cache-control': 'private, no-store' } }
    )
  })
}

export async function POST(request: NextRequest, context: Context) {
  return tutorRoute(request, async userId => {
    const { documentId } = await context.params
    let document = await getDocument(userId, documentId)
    if (!document)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    if (!['parsed', 'ready'].includes(document.status)) {
      if (document.status === 'failed') {
        const reset = await resetDocumentPreparation(userId, documentId)
        if (!reset)
          throw new TutorRepositoryError(
            'The requested learning resource was not found.'
          )
        document = reset
      }
      try {
        await enqueueDocumentParse({ userId, documentId })
      } catch {
        throw new TutorRepositoryError(
          'Document preparation could not be queued. Please retry.',
          'QUEUE_UNAVAILABLE',
          503
        )
      }
    }
    return NextResponse.json(
      {
        document: publicDocument(document)
      },
      { status: 202 }
    )
  })
}
