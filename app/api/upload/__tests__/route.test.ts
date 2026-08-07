import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn(() => Promise.resolve('user-1'))
}))

vi.mock('@/lib/analytics/dispatch', () => ({
  capture: vi.fn(() => Promise.resolve())
}))

vi.mock('@/lib/db/actions', () => ({
  findChatFileByContent: vi.fn(),
  createLibraryFile: vi.fn()
}))

const send = vi.fn(() => Promise.resolve({}))

vi.mock('@/lib/storage/r2-client', () => ({
  getR2Client: vi.fn(() => ({ send })),
  getSignedFileUrl: vi.fn((key: string) =>
    Promise.resolve(`https://uploads.example.com/${key}?sig=abc`)
  ),
  isObjectStorageConfigured: vi.fn(() => true),
  objectExists: vi.fn(() => Promise.resolve(true)),
  R2_BUCKET_NAME: 'test-bucket'
}))

import * as dbActions from '@/lib/db/actions'
import { objectExists } from '@/lib/storage/r2-client'

import { POST } from '../route'

const EXISTING = {
  id: 'file-1',
  userId: 'user-1',
  chatId: 'chat-1',
  filename: 'report.pdf',
  objectKey: 'user-1/chats/chat-1/1700000000000-report.pdf',
  mediaType: 'application/pdf',
  size: 1234,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

/**
 * The route only reads headers and formData, so a stub avoids round-tripping a
 * File through multipart encoding in the test environment.
 */
function uploadRequest(bytes = 1234) {
  const file = {
    name: 'report.pdf',
    type: 'application/pdf',
    size: bytes,
    arrayBuffer: async () => new Uint8Array(bytes).buffer
  }
  const formData = new Map<string, unknown>([
    ['file', file],
    ['chatId', 'chat-1']
  ])

  return {
    headers: { get: () => 'multipart/form-data; boundary=x' },
    formData: async () => ({ get: (key: string) => formData.get(key) ?? null })
  } as any
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_AUTH
    vi.mocked(objectExists).mockResolvedValue(true)
    vi.mocked(dbActions.createLibraryFile).mockResolvedValue({
      ...EXISTING,
      id: 'file-2',
      objectKey: 'user-1/chats/chat-1/1800000000000-report.pdf'
    } as any)
  })

  it('reuses the stored copy when the same file is uploaded again', async () => {
    vi.mocked(dbActions.findChatFileByContent).mockResolvedValue(
      EXISTING as any
    )

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).toBe(EXISTING.objectKey)
    expect(file.id).toBe(EXISTING.id)
    // Nothing written: no second object, no second library row.
    expect(send).not.toHaveBeenCalled()
    expect(dbActions.createLibraryFile).not.toHaveBeenCalled()
  })

  it('matches on name, type and size together', async () => {
    vi.mocked(dbActions.findChatFileByContent).mockResolvedValue(null)

    await POST(uploadRequest(9999))

    expect(dbActions.findChatFileByContent).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      filename: 'report.pdf',
      mediaType: 'application/pdf',
      size: 9999
    })
    expect(dbActions.createLibraryFile).toHaveBeenCalled()
  })

  it('uploads when nothing matches', async () => {
    vi.mocked(dbActions.findChatFileByContent).mockResolvedValue(null)

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).not.toBe(EXISTING.objectKey)
    expect(send).toHaveBeenCalledOnce()
  })

  it('uploads when the stored object is gone', async () => {
    vi.mocked(dbActions.findChatFileByContent).mockResolvedValue(
      EXISTING as any
    )
    vi.mocked(objectExists).mockResolvedValue(false)

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).not.toBe(EXISTING.objectKey)
    expect(send).toHaveBeenCalledOnce()
  })

  it('uploads when the lookup fails', async () => {
    vi.mocked(dbActions.findChatFileByContent).mockRejectedValue(
      new Error('db down')
    )

    const response = await POST(uploadRequest())

    expect(response.status).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('skips the lookup in anonymous mode, which has no library', async () => {
    process.env.ENABLE_AUTH = 'false'

    await POST(uploadRequest())

    expect(dbActions.findChatFileByContent).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledOnce()
  })
})
