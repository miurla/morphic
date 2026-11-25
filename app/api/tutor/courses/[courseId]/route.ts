import { NextRequest, NextResponse } from 'next/server'

import { removeCourseJobs } from '@/lib/tutor/queue'
import {
  deleteCourse,
  getCourse,
  TutorRepositoryError
} from '@/lib/tutor/repository'

import { tutorRoute } from '../../_shared'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  return tutorRoute(request, async userId => {
    const { courseId } = await context.params
    const course = await getCourse(userId, courseId)
    if (!course)
      throw new TutorRepositoryError(
        'The requested learning resource was not found.'
      )
    return NextResponse.json(
      { course },
      { headers: { 'cache-control': 'private, no-store' } }
    )
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  return tutorRoute(request, async userId => {
    const { courseId } = await context.params
    const chapterIds = await deleteCourse(userId, courseId)
    await removeCourseJobs({ courseId, chapterIds })
    return NextResponse.json(
      { deleted: true, courseId },
      { headers: { 'cache-control': 'private, no-store' } }
    )
  })
}
