import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toPublicErrorPayload } from '@/lib/errors/public-error'
import { localizePublicError } from '@/lib/i18n/errors'
import { TutorError } from '@/lib/tutor/errors'

const mocks = vi.hoisted(() => ({
  capabilities: vi.fn(),
  listCourses: vi.fn(),
  createCourse: vi.fn(),
  enqueue: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: async () => 'user-a'
}))
vi.mock('@/lib/tutor/config', () => ({
  getTutorCapabilities: mocks.capabilities,
  TUTOR_LIMITS: { maxFiles: 5, maxGoalLength: 2000 }
}))
vi.mock('@/lib/tutor/repository', () => ({
  listCourses: mocks.listCourses,
  createCourse: mocks.createCourse,
  updateCourse: vi.fn(),
  TutorRepositoryError: class extends Error {
    constructor(
      message: string,
      public code = 'NOT_FOUND',
      public status = 404
    ) {
      super(message)
    }
  }
}))
vi.mock('@/lib/tutor/queue', () => ({ enqueueCourse: mocks.enqueue }))

import { tutorRoute } from '../_shared'
import { GET, POST } from '../courses/route'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.capabilities.mockResolvedValue({
    ready: false,
    missing: ['The learning database is not configured.'],
    maxFiles: 5,
    maxFileSize: 5 * 1024 * 1024
  })
})

describe('Tutor setup errors', () => {
  it('loads the new-course form without querying an unconfigured database', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/tutor/courses')
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      courses: [],
      capabilities: { ready: false }
    })
    expect(mocks.listCourses).not.toHaveBeenCalled()
  })

  it.each(['en', 'zh-CN'] as const)(
    'reports missing setup on submission using the normal chat error in %s',
    async locale => {
      const response = await POST(
        new NextRequest('http://localhost:3000/api/tutor/courses', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-morphic-locale': locale
          },
          body: JSON.stringify({
            documentIds: ['doc-a'],
            goal: 'Learn',
            level: 'beginner'
          })
        })
      )
      const chatError = localizePublicError(
        toPublicErrorPayload(new Error('Missing API key')),
        locale
      ).error
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: chatError,
        code: 'TUTOR_NOT_CONFIGURED'
      })
      expect(mocks.createCourse).not.toHaveBeenCalled()
      expect(mocks.enqueue).not.toHaveBeenCalled()
    }
  )

  it.each(['MODEL_NOT_CONFIGURED', 'STORAGE_UNAVAILABLE'])(
    'uses the same public message for %s without exposing setup details',
    async code => {
      const response = await tutorRoute(
        new NextRequest('http://localhost:3000/api/tutor/documents'),
        async () => {
          throw new TutorError('Internal configuration details', code, 503)
        }
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: toPublicErrorPayload(new Error('Missing API key')).error,
        code
      })
    }
  )
})
