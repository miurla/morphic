import { NextRequest } from 'next/server'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  get: vi.fn(),
  reset: vi.fn(),
  enqueue: vi.fn(),
  state: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUserId: mocks.user }))
vi.mock('@/lib/tutor/queue', () => ({
  enqueueDocumentParse: mocks.enqueue,
  getDocumentParseState: mocks.state
}))
vi.mock('@/lib/tutor/repository', () => ({
  getDocument: mocks.get,
  resetDocumentPreparation: mocks.reset,
  publicDocument: (document: {
    id: string
    status: string
    pageCount: number
  }) => ({
    id: document.id,
    status: document.status,
    pageCount: document.pageCount
  }),
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

import { GET, POST } from '../documents/[documentId]/route'

const context = { params: Promise.resolve({ documentId: 'doc-a' }) }
const request = (method = 'GET', headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost:3000/api/tutor/documents/doc-a', {
    method,
    headers
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue('user-a')
  mocks.get.mockResolvedValue({
    id: 'doc-a',
    status: 'parsed',
    pageCount: 8,
    objectKey: 'private/key',
    contentHash: 'private-hash'
  })
  mocks.enqueue.mockResolvedValue('parse-doc-a')
  mocks.state.mockResolvedValue('pending')
})

afterEach(() => vi.unstubAllEnvs())

describe('Tutor document preparation endpoints', () => {
  it.each(['failed', 'missing', 'completed'])(
    'makes a stranded document retryable when its job is %s',
    async state => {
      mocks.get.mockResolvedValue({
        id: 'doc-a',
        status: 'parsing',
        pageCount: null
      })
      mocks.state.mockResolvedValue(state)
      const response = await GET(request(), context)
      expect(await response.json()).toMatchObject({
        document: { status: 'failed' }
      })
      expect(mocks.state).toHaveBeenCalledWith({
        userId: 'user-a',
        documentId: 'doc-a'
      })
      expect(mocks.reset).not.toHaveBeenCalled()
    }
  )

  it('does not misreport a document published while polling its queue', async () => {
    mocks.get
      .mockResolvedValueOnce({
        id: 'doc-a',
        status: 'parsing',
        pageCount: null
      })
      .mockResolvedValueOnce({ id: 'doc-a', status: 'parsed', pageCount: 8 })
    mocks.state.mockResolvedValue('completed')
    const response = await GET(request(), context)
    expect(await response.json()).toMatchObject({
      document: { status: 'parsed' }
    })
  })

  it('honors maintenance mode at the route boundary', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true')
    const response = await POST(request('POST'), context)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('600')
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('polls using session ownership and returns only the public projection', async () => {
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith('user-a', 'doc-a')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({
      document: { id: 'doc-a', status: 'parsed', pageCount: 8 }
    })
  })

  it.each([GET, POST])(
    'requires authentication and ownership',
    async handler => {
      mocks.user.mockResolvedValueOnce(null)
      expect(
        (await handler(request(handler === POST ? 'POST' : 'GET'), context))
          .status
      ).toBe(401)
      expect(mocks.get).not.toHaveBeenCalled()
      mocks.get.mockResolvedValue(null)
      expect(
        (await handler(request(handler === POST ? 'POST' : 'GET'), context))
          .status
      ).toBe(404)
      expect(mocks.enqueue).not.toHaveBeenCalled()
    }
  )

  it('rejects cross-origin retries before changing state', async () => {
    expect(
      (
        await POST(
          request('POST', { origin: 'https://untrusted.example' }),
          context
        )
      ).status
    ).toBe(403)
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.reset).not.toHaveBeenCalled()
  })

  it('returns a pollable status after retrying failed preparation', async () => {
    mocks.get.mockResolvedValue({
      id: 'doc-a',
      status: 'failed',
      pageCount: null
    })
    mocks.reset.mockResolvedValue({
      id: 'doc-a',
      status: 'uploaded',
      pageCount: null
    })
    const response = await POST(request('POST'), context)
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      document: { status: 'uploaded' }
    })
    expect(mocks.reset).toHaveBeenCalledWith('user-a', 'doc-a')
    expect(mocks.enqueue).toHaveBeenCalledWith({
      userId: 'user-a',
      documentId: 'doc-a'
    })
  })

  it.each(['parsed', 'ready'])(
    'does not reparse %s documents',
    async status => {
      mocks.get.mockResolvedValue({ id: 'doc-a', status, pageCount: 8 })
      expect((await POST(request('POST'), context)).status).toBe(202)
      expect(mocks.reset).not.toHaveBeenCalled()
      expect(mocks.enqueue).not.toHaveBeenCalled()
    }
  )

  it('returns 404 if the document disappears during retry', async () => {
    mocks.get.mockResolvedValue({ id: 'doc-a', status: 'failed' })
    mocks.reset.mockResolvedValue(null)
    expect((await POST(request('POST'), context)).status).toBe(404)
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('reports queue failure without exposing connection details', async () => {
    mocks.get.mockResolvedValue({ id: 'doc-a', status: 'uploaded' })
    mocks.enqueue.mockRejectedValue(
      new Error('private Redis connection string')
    )
    const response = await POST(request('POST'), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'QUEUE_UNAVAILABLE' })
  })
})
