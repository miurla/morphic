import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn(() => Promise.resolve('user-1'))
}))

vi.mock('@/lib/analytics/dispatch', () => ({
  capture: vi.fn(() => Promise.resolve())
}))

vi.mock('@/lib/db/actions', () => ({
  findChatFileCandidates: vi.fn(),
  createLibraryFile: vi.fn()
}))

const send = vi.fn(() => Promise.resolve({}))

vi.mock('@/lib/storage/r2-client', () => ({
  getR2Client: vi.fn(() => ({ send })),
  getSignedFileUrl: vi.fn((key: string) =>
    Promise.resolve(`https://uploads.example.com/${key}?sig=abc`)
  ),
  isObjectStorageConfigured: vi.fn(() => true),
  getChatFileObjectKeyPrefix: (userId: string, chatId: string) =>
    `${userId}/chats/${chatId}/`,
  getObjectContentMd5: vi.fn(() => Promise.resolve<string | null>(null)),
  R2_BUCKET_NAME: 'test-bucket'
}))

import { createHash } from 'node:crypto'

import * as dbActions from '@/lib/db/actions'
import { getObjectContentMd5 } from '@/lib/storage/r2-client'

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
function uploadRequest(
  bytes = 1234,
  contents = pdfUploadBytes(bytes),
  declared = { name: 'report.pdf', type: 'application/pdf' }
) {
  const file = {
    name: declared.name,
    type: declared.type,
    size: bytes,
    arrayBuffer: async () => contents.buffer
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

function pdfUploadBytes(bytes = 1234) {
  const contents = new Uint8Array(bytes)
  contents.set(Buffer.from('%PDF-', 'ascii'))
  return contents
}

function md5OfUpload(bytes = 1234) {
  return createHash('md5').update(pdfUploadBytes(bytes)).digest('hex')
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_AUTH
    vi.mocked(getObjectContentMd5).mockResolvedValue(md5OfUpload())
    vi.mocked(dbActions.createLibraryFile).mockResolvedValue({
      ...EXISTING,
      id: 'file-2',
      objectKey: 'user-1/chats/chat-1/1800000000000-report.pdf'
    } as any)
  })

  it('reuses the stored copy when the same file is uploaded again', async () => {
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([
      EXISTING
    ] as any)

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).toBe(EXISTING.objectKey)
    expect(file.id).toBe(EXISTING.id)
    // Nothing written: no second object, no second library row.
    expect(send).not.toHaveBeenCalled()
    expect(dbActions.createLibraryFile).not.toHaveBeenCalled()
  })

  it('narrows the candidate by name, type and size', async () => {
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([])

    await POST(uploadRequest(9999))

    expect(dbActions.findChatFileCandidates).toHaveBeenCalledWith({
      userId: 'user-1',
      chatKeyPrefix: 'user-1/chats/chat-1/',
      filename: 'report.pdf',
      mediaType: 'application/pdf',
      size: 9999
    })
    expect(dbActions.createLibraryFile).toHaveBeenCalled()
  })

  it('uploads when nothing matches', async () => {
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([])

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).not.toBe(EXISTING.objectKey)
    expect(send).toHaveBeenCalledOnce()
  })

  it('rejects allowed declared types with unsupported content', async () => {
    const contents = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d
    ])

    const response = await POST(uploadRequest(contents.byteLength, contents))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Unsupported file content'
    })
    expect(dbActions.findChatFileCandidates).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(dbActions.createLibraryFile).not.toHaveBeenCalled()
  })

  it('stores a mislabelled file under the type its bytes say it is', async () => {
    // A document renamed to .jpg is reported as an image by the browser, and
    // handing it to the provider as one fails the turn just like unreadable
    // content does.
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([])
    const contents = pdfUploadBytes(1234)

    const { file } = await (
      await POST(
        uploadRequest(contents.byteLength, contents, {
          name: 'report.jpg',
          type: 'image/jpeg'
        })
      )
    ).json()

    expect(file.mediaType).toBe('application/pdf')
    expect(dbActions.findChatFileCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'application/pdf' })
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ ContentType: 'application/pdf' })
      })
    )
    expect(dbActions.createLibraryFile).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'application/pdf' })
    )
  })

  it('uploads when the candidate holds different bytes', async () => {
    // Same name, same type, same size, different content: the digest is the
    // only thing standing between the user and a silently substituted file.
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([
      EXISTING
    ] as any)
    vi.mocked(getObjectContentMd5).mockResolvedValue(
      createHash('md5').update('something else').digest('hex')
    )

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).not.toBe(EXISTING.objectKey)
    expect(send).toHaveBeenCalledOnce()
  })

  it('uploads when the stored object is gone or has no usable digest', async () => {
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([
      EXISTING
    ] as any)
    vi.mocked(getObjectContentMd5).mockResolvedValue(null)

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).not.toBe(EXISTING.objectKey)
    expect(send).toHaveBeenCalledOnce()
  })

  it('checks every candidate, not just the newest', async () => {
    // Two same-sized versions of one file: matching only the newest would mint
    // a new object every time the user alternates between them.
    const older = { ...EXISTING, id: 'file-0', objectKey: 'older-key' }
    const newer = { ...EXISTING, id: 'file-9', objectKey: 'newer-key' }
    vi.mocked(dbActions.findChatFileCandidates).mockResolvedValue([
      newer,
      older
    ] as any)
    vi.mocked(getObjectContentMd5).mockImplementation(async key =>
      key === older.objectKey
        ? md5OfUpload()
        : createHash('md5').update('another version').digest('hex')
    )

    const { file } = await (await POST(uploadRequest())).json()

    expect(file.key).toBe(older.objectKey)
    expect(send).not.toHaveBeenCalled()
  })

  it('uploads when the lookup fails', async () => {
    vi.mocked(dbActions.findChatFileCandidates).mockRejectedValue(
      new Error('db down')
    )

    const response = await POST(uploadRequest())

    expect(response.status).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('skips the lookup in anonymous mode, which has no library', async () => {
    process.env.ENABLE_AUTH = 'false'

    await POST(uploadRequest())

    expect(dbActions.findChatFileCandidates).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledOnce()
  })
})
