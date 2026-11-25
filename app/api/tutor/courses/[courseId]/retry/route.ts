import { NextRequest, NextResponse } from 'next/server'

import { enqueueCourse } from '@/lib/tutor/queue'
import {
  getCourse,
  prepareCourseRetry,
  TutorRepositoryError,
  updateCourse
} from '@/lib/tutor/repository'

import { tutorRoute } from '../../../_shared'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  return tutorRoute(request, async (userId, locale) => {
    const { courseId } = await context.params
    const course = await getCourse(userId, courseId)
    if (!course)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    if (course.status === 'ready') return NextResponse.json({ course })
    const admitted = await prepareCourseRetry(userId, courseId)
    if (admitted.status === 'ready')
      return NextResponse.json({ course: await getCourse(userId, courseId) })
    try {
      await enqueueCourse({ userId, courseId })
    } catch {
      await updateCourse(userId, courseId, {
        status: 'failed',
        stage: 'failed',
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
    return NextResponse.json(
      { course: await getCourse(userId, courseId) },
      { status: 202 }
    )
  })
}
