import { NextRequest, NextResponse } from 'next/server'

import { enqueueChapter } from '@/lib/tutor/queue'
import {
  getChapter,
  getStoredCourse,
  TutorRepositoryError,
  updateChapter
} from '@/lib/tutor/repository'

import { tutorRoute } from '../../../../../_shared'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  return tutorRoute(request, async (userId, locale) => {
    const { courseId, chapterId } = await context.params
    const course = await getStoredCourse(userId, courseId)
    if (!course)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    if (course.status !== 'ready')
      throw new TutorRepositoryError(
        'Wait for your learning route to finish.',
        'COURSE_NOT_READY',
        409
      )
    const chapter = await getChapter(userId, courseId, chapterId)
    if (!chapter)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    if (chapter.status === 'ready') return NextResponse.json({ chapter })
    const admitted = await updateChapter(userId, courseId, chapterId, {
      status: 'generating',
      error: null
    })
    if (admitted.status !== 'ready') {
      try {
        await enqueueChapter({ userId, courseId, chapterId })
      } catch {
        await updateChapter(userId, courseId, chapterId, {
          status: 'failed',
          error:
            locale === 'zh-CN'
              ? '任务队列暂时不可用，请重试。'
              : 'The task queue is unavailable. Please retry.'
        })
        throw new TutorRepositoryError(
          'The task queue is unavailable. Please retry.',
          'QUEUE_UNAVAILABLE',
          503
        )
      }
    }
    const refreshed = await getChapter(userId, courseId, chapterId)
    if (!refreshed)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    return NextResponse.json(
      { chapter: refreshed },
      { status: admitted.status === 'ready' ? 200 : 202 }
    )
  })
}
