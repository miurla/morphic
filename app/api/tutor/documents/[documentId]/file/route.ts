import { NextRequest } from 'next/server'

import {
  getTutorDocumentFormat,
  getTutorDocumentMimeType
} from '@/lib/tutor/document-formats'
import { getDocument, TutorRepositoryError } from '@/lib/tutor/repository'
import { readTutorDocument } from '@/lib/tutor/storage'

import { tutorRoute } from '../../../_shared'

export const runtime = 'nodejs'
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  return tutorRoute(request, async userId => {
    const { documentId } = await context.params
    const document = await getDocument(userId, documentId)
    if (!document)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    const data = await readTutorDocument(userId, documentId)
    const format = getTutorDocumentFormat(document.filename)
    const disposition = format === 'pdf' ? 'inline' : 'attachment'
    const filename = encodeURIComponent(document.filename).replace(
      /['()*]/g,
      character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    )
    return new Response(new Uint8Array(data), {
      headers: {
        'content-type': getTutorDocumentMimeType(document.filename),
        'content-length': String(data.byteLength),
        'content-disposition': `${disposition}; filename="learning-material.${format ?? 'bin'}"; filename*=UTF-8''${filename}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      }
    })
  })
}
