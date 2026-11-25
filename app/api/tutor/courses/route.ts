import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { getTutorCapabilities, TUTOR_LIMITS } from '@/lib/tutor/config'
import { enqueueCourse } from '@/lib/tutor/queue'
import {
  createCourse,
  listCourses,
  TutorRepositoryError,
  updateCourse
} from '@/lib/tutor/repository'

import { readTutorJson, tutorRoute } from '../_shared'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  return tutorRoute(request, async userId => {
    const capabilities = await getTutorCapabilities()
    // The form remains usable before setup. Missing configuration is reported
    // when uploading or creating a course, just like the normal chat flow.
    const courses = capabilities.missing.includes(
      'The learning database is not configured.'
    )
      ? []
      : await listCourses(userId)
    return NextResponse.json(
      { courses, capabilities },
      { headers: { 'cache-control': 'private, no-store' } }
    )
  })
}

export async function POST(request: NextRequest) {
  return tutorRoute(request, async (userId, locale) => {
    const input = z
      .object({
        documentIds: z
          .array(z.string().min(1).max(200))
          .min(1)
          .max(TUTOR_LIMITS.maxFiles),
        goal: z.string().trim().min(1).max(TUTOR_LIMITS.maxGoalLength),
        level: z.enum(['beginner', 'intermediate', 'advanced']),
        locale: z.enum(['en', 'zh-CN']).optional()
      })
      .parse(await readTutorJson(request))
    if (!(await getTutorCapabilities()).ready)
      throw new TutorRepositoryError(
        locale === 'zh-CN'
          ? 'Tutor 服务尚未配置完成。'
          : 'Tutor is not configured yet.',
        'TUTOR_NOT_CONFIGURED',
        503
      )
    const course = await createCourse(userId, {
      ...input,
      locale: input.locale ?? locale
    })
    try {
      await enqueueCourse({ userId, courseId: course.id })
    } catch {
      await updateCourse(userId, course.id, {
        status: 'failed',
        stage: 'failed',
        error:
          locale === 'zh-CN'
            ? '学习任务未能加入队列，请重试。'
            : 'The learning task could not be queued. Please retry.'
      })
      throw new TutorRepositoryError(
        locale === 'zh-CN'
          ? '任务队列暂时不可用，请在课程列表中重试。'
          : 'The task queue is unavailable. Retry from your course list.',
        'QUEUE_UNAVAILABLE',
        503
      )
    }
    return NextResponse.json({ course }, { status: 202 })
  })
}
