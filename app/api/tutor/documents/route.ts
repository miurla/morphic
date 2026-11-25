import { NextRequest, NextResponse } from 'next/server'

import { TUTOR_LIMITS } from '@/lib/tutor/config'
import { TutorRepositoryError } from '@/lib/tutor/repository'
import { storeTutorDocument } from '@/lib/tutor/storage'

import { readLimitedBody, tutorRoute } from '../_shared'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  return tutorRoute(request, async userId => {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.startsWith('multipart/form-data'))
      throw new TutorRepositoryError(
        'Upload a document.',
        'INVALID_REQUEST',
        400
      )
    const body = await readLimitedBody(
      request,
      TUTOR_LIMITS.maxFileSize + 64 * 1024
    )
    const form = await new Response(body, {
      headers: { 'content-type': contentType }
    }).formData()
    const file = form.get('file')
    if (!file || typeof file === 'string' || form.getAll('file').length !== 1)
      throw new TutorRepositoryError(
        'Choose one document.',
        'INVALID_REQUEST',
        400
      )
    return NextResponse.json(
      { document: await storeTutorDocument(userId, file) },
      { status: 201 }
    )
  })
}
