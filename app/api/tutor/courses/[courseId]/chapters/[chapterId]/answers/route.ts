import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { TUTOR_LIMITS } from '@/lib/tutor/config'
import { gradeAnswer } from '@/lib/tutor/service'

import { readTutorJson, tutorRoute } from '../../../../../_shared'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  return tutorRoute(request, async (userId, locale) => {
    const { courseId, chapterId } = await context.params
    const input = z
      .object({
        questionId: z.string().min(1).max(200),
        answer: z.string().trim().min(1).max(TUTOR_LIMITS.maxAnswerLength),
        attemptId: z.string().uuid()
      })
      .parse(await readTutorJson(request))
    return NextResponse.json(
      await gradeAnswer({ userId, courseId, chapterId, ...input, locale })
    )
  })
}
