import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  createCourse: vi.fn(),
  deleteCourse: vi.fn(),
  listCourses: vi.fn(),
  updateCourse: vi.fn(),
  getCourse: vi.fn(),
  getStoredCourse: vi.fn(),
  getChapter: vi.fn(),
  updateChapter: vi.fn(),
  prepareCourseRetry: vi.fn(),
  enqueue: vi.fn(),
  enqueueChapter: vi.fn(),
  enqueueDocumentParse: vi.fn(),
  removeCourseJobs: vi.fn(),
  capabilities: vi.fn(),
  grade: vi.fn(),
  store: vi.fn(),
  readDocument: vi.fn(),
  getDocument: vi.fn(),
  resetDocumentPreparation: vi.fn()
}))
vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUserId: mocks.user }))
vi.mock('@/lib/tutor/config', () => ({
  getTutorCapabilities: mocks.capabilities,
  TUTOR_LIMITS: {
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 5,
    maxGoalLength: 2000,
    maxAnswerLength: 12000
  }
}))
vi.mock('@/lib/tutor/repository', () => ({
  createCourse: mocks.createCourse,
  deleteCourse: mocks.deleteCourse,
  listCourses: mocks.listCourses,
  updateCourse: mocks.updateCourse,
  getCourse: mocks.getCourse,
  getStoredCourse: mocks.getStoredCourse,
  getChapter: mocks.getChapter,
  updateChapter: mocks.updateChapter,
  prepareCourseRetry: mocks.prepareCourseRetry,
  getDocument: mocks.getDocument,
  resetDocumentPreparation: mocks.resetDocumentPreparation,
  publicDocument: (document: unknown) => document,
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
vi.mock('@/lib/tutor/queue', () => ({
  enqueueCourse: mocks.enqueue,
  enqueueChapter: mocks.enqueueChapter,
  enqueueDocumentParse: mocks.enqueueDocumentParse,
  removeCourseJobs: mocks.removeCourseJobs
}))
vi.mock('@/lib/tutor/service', () => ({ gradeAnswer: mocks.grade }))
vi.mock('@/lib/tutor/storage', () => ({
  storeTutorDocumentStream: mocks.store,
  readTutorDocument: mocks.readDocument
}))

import { TutorRepositoryError } from '@/lib/tutor/repository'

import { POST as answer } from '../courses/[courseId]/chapters/[chapterId]/answers/route'
import { POST as generateChapter } from '../courses/[courseId]/chapters/[chapterId]/generate/route'
import { POST as retryCourse } from '../courses/[courseId]/retry/route'
import {
  DELETE as deleteCourse,
  GET as getCourse
} from '../courses/[courseId]/route'
import { GET as listCourses, POST as createCourse } from '../courses/route'
import { GET as download } from '../documents/[documentId]/file/route'
import { POST as upload } from '../documents/route'

const course = { id: 'course-a', status: 'queued' }
const json = (
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {}
) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue('user-a')
  mocks.capabilities.mockResolvedValue({
    ready: true,
    missing: [],
    maxFiles: 5,
    maxFileSize: 5 * 1024 * 1024
  })
  mocks.createCourse.mockResolvedValue(course)
  mocks.listCourses.mockResolvedValue([])
  mocks.enqueue.mockResolvedValue('job-a')
  mocks.deleteCourse.mockResolvedValue(['chapter-a'])
  mocks.removeCourseJobs.mockResolvedValue(undefined)
})

describe('Tutor API boundaries', () => {
  it.each(['generating', 'ready'])(
    'returns 404 if a chapter disappears after admission with status %s',
    async status => {
      mocks.getStoredCourse.mockResolvedValue({ ...course, status: 'ready' })
      mocks.getChapter
        .mockResolvedValueOnce({ id: 'chapter-a', status: 'pending' })
        .mockResolvedValueOnce(null)
      mocks.updateChapter.mockResolvedValue({ id: 'chapter-a', status })
      const response = await generateChapter(
        json('/api/tutor/courses/course-a/chapters/chapter-a/generate', {}),
        {
          params: Promise.resolve({
            courseId: 'course-a',
            chapterId: 'chapter-a'
          })
        }
      )
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
      expect(mocks.enqueueChapter).toHaveBeenCalledTimes(
        status === 'ready' ? 0 : 1
      )
    }
  )

  it.each(['queued', 'ready'])(
    'returns 404 if a retried course disappears after admission with status %s',
    async status => {
      mocks.getCourse
        .mockResolvedValueOnce({ ...course, status: 'failed' })
        .mockResolvedValueOnce(null)
      mocks.prepareCourseRetry.mockResolvedValue({ ...course, status })
      const response = await retryCourse(
        json('/api/tutor/courses/course-a/retry', {}),
        { params: Promise.resolve({ courseId: 'course-a' }) }
      )
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
      expect(mocks.enqueue).toHaveBeenCalledTimes(status === 'ready' ? 0 : 1)
    }
  )

  it('deletes using session ownership before cleaning queued jobs, without requiring AI configuration', async () => {
    mocks.capabilities.mockResolvedValue({ ready: false })
    const response = await deleteCourse(
      new NextRequest('http://localhost:3000/api/tutor/courses/course-a', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ courseId: 'course-a' }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      deleted: true,
      courseId: 'course-a'
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.deleteCourse).toHaveBeenCalledWith('user-a', 'course-a')
    expect(mocks.removeCourseJobs).toHaveBeenCalledWith({
      courseId: 'course-a',
      chapterIds: ['chapter-a']
    })
    expect(mocks.deleteCourse.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeCourseJobs.mock.invocationCallOrder[0]
    )
    expect(mocks.capabilities).not.toHaveBeenCalled()
  })

  it('requires authentication before deleting', async () => {
    mocks.user.mockResolvedValue(null)
    const response = await deleteCourse(
      new NextRequest('http://localhost:3000/api/tutor/courses/course-a', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ courseId: 'course-a' }) }
    )
    expect(response.status).toBe(401)
    expect(mocks.deleteCourse).not.toHaveBeenCalled()
    expect(mocks.removeCourseJobs).not.toHaveBeenCalled()
  })

  it('rejects cross-origin deletion before touching data or the queue', async () => {
    const response = await deleteCourse(
      new NextRequest('http://localhost:3000/api/tutor/courses/course-a', {
        method: 'DELETE',
        headers: { origin: 'https://untrusted.example' }
      }),
      { params: Promise.resolve({ courseId: 'course-a' }) }
    )
    expect(response.status).toBe(403)
    expect(mocks.deleteCourse).not.toHaveBeenCalled()
    expect(mocks.removeCourseJobs).not.toHaveBeenCalled()
  })

  it('returns 404 for missing or unowned deletion without cleaning any jobs', async () => {
    mocks.deleteCourse.mockRejectedValue(
      new TutorRepositoryError('The requested learning resource was not found.')
    )
    const response = await deleteCourse(
      new NextRequest('http://localhost:3000/api/tutor/courses/other', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ courseId: 'other' }) }
    )
    expect(response.status).toBe(404)
    expect(mocks.deleteCourse).toHaveBeenCalledWith('user-a', 'other')
    expect(mocks.removeCourseJobs).not.toHaveBeenCalled()
  })

  it.each(['pdf', 'txt', 'md', 'markdown', 'docx'])(
    'passes a %s upload to content validation with session ownership',
    async extension => {
      mocks.store.mockResolvedValue({
        id: 'doc-a',
        filename: `学习.${extension}`,
        status: 'uploaded'
      })
      const response = await upload(
        new NextRequest('http://localhost:3000/api/tutor/documents', {
          method: 'POST',
          headers: {
            'content-type': 'application/octet-stream',
            'x-tutor-filename': encodeURIComponent(`学习.${extension}`)
          },
          body: 'document content'
        })
      )
      expect(response.status).toBe(201)
      expect(mocks.store).toHaveBeenCalledWith(
        'user-a',
        expect.objectContaining({
          name: `学习.${extension}`,
          stream: expect.any(ReadableStream),
          signal: expect.any(AbortSignal)
        })
      )
      expect(mocks.enqueueDocumentParse).toHaveBeenCalledWith({
        userId: 'user-a',
        documentId: 'doc-a'
      })
    }
  )

  it.each([
    ['pdf', 'application/pdf', 'inline'],
    ['txt', 'text/plain', 'attachment'],
    ['md', 'text/markdown', 'attachment'],
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'attachment'
    ]
  ])(
    'serves %s originals with correct content type and disposition',
    async (extension, mime, disposition) => {
      mocks.getDocument.mockResolvedValue({ filename: `学习.${extension}` })
      mocks.readDocument.mockResolvedValue(new Uint8Array([1, 2, 3]))
      const response = await download(
        new NextRequest('http://localhost:3000/api/tutor/documents/doc-a/file'),
        { params: Promise.resolve({ documentId: 'doc-a' }) }
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe(mime)
      expect(response.headers.get('content-disposition')).toContain(
        `${disposition};`
      )
      expect(response.headers.get('content-disposition')).toContain(
        encodeURIComponent(`学习.${extension}`)
      )
      expect(mocks.getDocument).toHaveBeenCalledWith('user-a', 'doc-a')
      expect(mocks.readDocument).toHaveBeenCalledWith('user-a', 'doc-a')
    }
  )

  it('does not read a missing or unowned original file', async () => {
    mocks.getDocument.mockResolvedValue(null)
    const response = await download(
      new NextRequest('http://localhost:3000/api/tutor/documents/other/file'),
      { params: Promise.resolve({ documentId: 'other' }) }
    )
    expect(response.status).toBe(404)
    expect(mocks.readDocument).not.toHaveBeenCalled()
  })
  it('requires authentication before listing private courses', async () => {
    mocks.user.mockResolvedValue(null)
    const response = await listCourses(
      new NextRequest('http://localhost:3000/api/tutor/courses')
    )
    expect(response.status).toBe(401)
    expect(mocks.listCourses).not.toHaveBeenCalled()
  })

  it('rejects cross-origin writes before a database call', async () => {
    const response = await createCourse(
      json(
        '/api/tutor/courses',
        { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
        { origin: 'https://untrusted.example' }
      )
    )
    expect(response.status).toBe(403)
    expect(mocks.createCourse).not.toHaveBeenCalled()
  })

  it('accepts the real HTTP Host when Next normalizes a loopback URL', async () => {
    const response = await createCourse(
      json(
        '/api/tutor/courses',
        { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
        {
          host: '127.0.0.1:3002',
          origin: 'http://127.0.0.1:3002',
          'sec-fetch-site': 'same-origin'
        }
      )
    )
    expect(response.status).toBe(202)
    expect(mocks.createCourse).toHaveBeenCalledOnce()
  })

  it('uses the request URL when no Host header is available', async () => {
    const request = new NextRequest('https://app.example/api/tutor/courses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://app.example'
      },
      body: JSON.stringify({
        documentIds: ['doc-a'],
        goal: 'Learn',
        level: 'beginner'
      })
    })
    expect((await createCourse(request)).status).toBe(202)
  })

  it('fails closed when a loopback URL has been normalized and the HTTP Host was lost', async () => {
    const request = new NextRequest('http://127.0.0.1:3002/api/tutor/courses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:3002'
      },
      body: JSON.stringify({
        documentIds: ['doc-a'],
        goal: 'Learn',
        level: 'beginner'
      })
    })
    expect(new URL(request.url).hostname).toBe('localhost')
    expect((await createCourse(request)).status).toBe(403)
    expect(mocks.createCourse).not.toHaveBeenCalled()
  })

  it('supports an explicitly configured public origin behind a TLS proxy', async () => {
    vi.stubEnv('TUTOR_PUBLIC_ORIGIN', 'https://learning.example')
    try {
      const response = await createCourse(
        json(
          '/api/tutor/courses',
          { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
          {
            host: 'internal-web:3000',
            origin: 'https://learning.example',
            'sec-fetch-site': 'same-origin'
          }
        )
      )
      expect(response.status).toBe(202)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects external origins even if a forwarded Host header claims to match', async () => {
    const response = await createCourse(
      json(
        '/api/tutor/courses',
        { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
        {
          host: '127.0.0.1:3002',
          origin: 'https://attacker.example',
          'x-forwarded-host': 'attacker.example'
        }
      )
    )
    expect(response.status).toBe(403)
    expect(mocks.createCourse).not.toHaveBeenCalled()
  })

  it.each(['http://127.0.0.1:3003', 'https://127.0.0.1:3002', 'null'])(
    'rejects mismatched or opaque origin %s',
    async origin => {
      const response = await createCourse(
        json(
          '/api/tutor/courses',
          { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
          { host: '127.0.0.1:3002', origin }
        )
      )
      expect(response.status).toBe(403)
      expect(mocks.createCourse).not.toHaveBeenCalled()
    }
  )

  it('rejects browser-declared cross-site writes even without an Origin header', async () => {
    const response = await createCourse(
      json(
        '/api/tutor/courses',
        { documentIds: ['doc-a'], goal: 'Learn', level: 'beginner' },
        { 'sec-fetch-site': 'cross-site' }
      )
    )
    expect(response.status).toBe(403)
    expect(mocks.createCourse).not.toHaveBeenCalled()
  })

  it('captures locale and uses session ownership, ignoring a supplied userId', async () => {
    const response = await createCourse(
      json(
        '/api/tutor/courses',
        {
          documentIds: ['doc-a'],
          goal: '  Learn this material  ',
          level: 'beginner',
          userId: 'user-b'
        },
        { 'x-morphic-locale': 'zh-CN' }
      )
    )
    expect(response.status).toBe(202)
    expect(mocks.createCourse).toHaveBeenCalledWith('user-a', {
      documentIds: ['doc-a'],
      goal: 'Learn this material',
      level: 'beginner',
      locale: 'zh-CN'
    })
    expect(mocks.enqueue).toHaveBeenCalledWith({
      userId: 'user-a',
      courseId: 'course-a'
    })
  })

  it('does not accept an empty route or more than five documents', async () => {
    for (const documentIds of [[], ['a', 'b', 'c', 'd', 'e', 'f']]) {
      expect(
        (
          await createCourse(
            json('/api/tutor/courses', {
              documentIds,
              goal: 'Learn',
              level: 'beginner'
            })
          )
        ).status
      ).toBe(400)
    }
    expect(mocks.createCourse).not.toHaveBeenCalled()
  })

  it('persists a retryable failure if enqueueing fails', async () => {
    mocks.enqueue.mockRejectedValue(
      new Error('redis://secret:password@example')
    )
    const response = await createCourse(
      json('/api/tutor/courses', {
        documentIds: ['a'],
        goal: 'Learn',
        level: 'beginner'
      })
    )
    expect(response.status).toBe(503)
    expect(mocks.updateCourse).toHaveBeenCalledWith(
      'user-a',
      'course-a',
      expect.objectContaining({ status: 'failed', stage: 'failed' })
    )
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })

  it('treats other users resources as not found', async () => {
    mocks.getCourse.mockResolvedValue(null)
    const response = await getCourse(
      new NextRequest('http://localhost:3000/api/tutor/courses/other'),
      { params: Promise.resolve({ courseId: 'other' }) }
    )
    expect(response.status).toBe(404)
    expect(mocks.getCourse).toHaveBeenCalledWith('user-a', 'other')
  })

  it('validates answers before calling a paid grading service', async () => {
    const response = await answer(
      json('/api/tutor/courses/a/chapters/b/answers', {
        questionId: 'q',
        answer: 'x'.repeat(12001),
        attemptId: 'not-a-uuid'
      }),
      { params: Promise.resolve({ courseId: 'a', chapterId: 'b' }) }
    )
    expect(response.status).toBe(400)
    expect(mocks.grade).not.toHaveBeenCalled()
  })

  it('rejects oversized uploads before buffering or invoking storage', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/tutor/documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-tutor-filename': 'notes.txt',
          'content-length': String(8 * 1024 * 1024)
        },
        body: 'small'
      }
    )
    const response = await upload(request)
    expect(response.status).toBe(413)
    expect(mocks.store).not.toHaveBeenCalled()
  })

  it('passes the original body stream through without buffering', async () => {
    mocks.store.mockResolvedValue({ id: 'doc-a', status: 'uploaded' })
    const request = new NextRequest(
      'http://localhost:3000/api/tutor/documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-tutor-filename': 'notes.txt',
          'content-length': '5'
        },
        body: 'small'
      }
    )
    const buffer = vi.spyOn(request, 'arrayBuffer')
    const multipart = vi.spyOn(request, 'formData')
    expect((await upload(request)).status).toBe(201)
    expect(mocks.store.mock.calls[0][1]).toMatchObject({
      stream: request.body,
      size: 5,
      signal: request.signal
    })
    expect(buffer).not.toHaveBeenCalled()
    expect(multipart).not.toHaveBeenCalled()
  })

  it.each(['parsed', 'ready'])(
    'does not requeue an already %s document',
    async status => {
      mocks.store.mockResolvedValue({ id: 'doc-a', status })
      const response = await upload(
        new NextRequest('http://localhost:3000/api/tutor/documents', {
          method: 'POST',
          headers: {
            'content-type': 'application/octet-stream',
            'x-tutor-filename': 'notes.txt'
          },
          body: 'small'
        })
      )
      expect(response.status).toBe(201)
      expect(mocks.enqueueDocumentParse).not.toHaveBeenCalled()
    }
  )

  it('reports a retryable parse queue failure after upload without exposing internals', async () => {
    mocks.store.mockResolvedValue({ id: 'doc-a', status: 'uploaded' })
    mocks.enqueueDocumentParse.mockRejectedValue(
      new Error('redis://secret@host')
    )
    const response = await upload(
      new NextRequest('http://localhost:3000/api/tutor/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-tutor-filename': 'notes.txt'
        },
        body: 'small'
      })
    )
    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.code).toBe('QUEUE_UNAVAILABLE')
    expect(payload.error).not.toContain('secret')
  })

  it('returns a pending status after retrying a failed duplicate upload', async () => {
    mocks.store.mockResolvedValue({
      id: 'doc-a',
      status: 'failed',
      error: 'Old failure'
    })
    mocks.resetDocumentPreparation.mockResolvedValue({
      id: 'doc-a',
      status: 'uploaded',
      error: null
    })
    const response = await upload(
      new NextRequest('http://localhost:3000/api/tutor/documents', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-tutor-filename': 'notes.txt'
        },
        body: 'small'
      })
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      document: { id: 'doc-a', status: 'uploaded', error: null }
    })
    expect(mocks.resetDocumentPreparation).toHaveBeenCalledWith(
      'user-a',
      'doc-a'
    )
    expect(mocks.enqueueDocumentParse).toHaveBeenCalledWith({
      userId: 'user-a',
      documentId: 'doc-a'
    })
  })

  it.each([
    {
      'content-type': 'multipart/form-data; boundary=test',
      'x-tutor-filename': 'notes.txt',
      'content-length': '5'
    },
    {
      'content-type': 'application/octet-stream',
      'x-tutor-filename': '%invalid',
      'content-length': '5'
    },
    {
      'content-type': 'application/octet-stream',
      'x-tutor-filename': 'notes.txt',
      'content-length': '-1'
    }
  ])('rejects invalid raw upload metadata before storage', async headers => {
    const response = await upload(
      new NextRequest('http://localhost:3000/api/tutor/documents', {
        method: 'POST',
        headers,
        body: 'small'
      })
    )
    expect(response.status).toBe(400)
    expect(mocks.store).not.toHaveBeenCalled()
  })

  it('authenticates and checks origin before receiving raw uploads', async () => {
    mocks.user.mockResolvedValue(null)
    expect(
      (
        await upload(
          new NextRequest('http://localhost:3000/api/tutor/documents', {
            method: 'POST',
            headers: {
              'content-type': 'application/octet-stream',
              'x-tutor-filename': 'notes.txt'
            },
            body: 'small'
          })
        )
      ).status
    ).toBe(401)
    mocks.user.mockResolvedValue('user-a')
    expect(
      (
        await upload(
          new NextRequest('http://localhost:3000/api/tutor/documents', {
            method: 'POST',
            headers: {
              'content-type': 'application/octet-stream',
              'x-tutor-filename': 'notes.txt',
              origin: 'https://untrusted.example'
            },
            body: 'small'
          })
        )
      ).status
    ).toBe(403)
    expect(mocks.store).not.toHaveBeenCalled()
    expect(mocks.enqueueDocumentParse).not.toHaveBeenCalled()
  })

  it('hides raw database or provider failures', async () => {
    mocks.listCourses.mockRejectedValue(
      new Error('postgres://admin:secret@host')
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await listCourses(
      new NextRequest('http://localhost:3000/api/tutor/courses')
    )
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
    errorSpy.mockRestore()
  })
})
// @vitest-environment node
