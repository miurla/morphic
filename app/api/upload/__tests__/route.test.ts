import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.fn()
const mockSend = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/storage/r2-client', () => ({
  getR2Client: () => ({ send: mockSend }),
  isObjectStorageConfigured: () => true,
  R2_BUCKET_NAME: 'bucket',
  R2_PUBLIC_URL: 'https://cdn.example'
}))

import { POST } from '../route'

function fileStub(name: string, type: string, bytes: Uint8Array) {
  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  } as File
}

function multipartRequest(file: File) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type'
          ? 'multipart/form-data; boundary=vitest'
          : null
    },
    formData: async () => ({
      get: (key: string) => {
        if (key === 'file') return file
        if (key === 'chatId') return 'chat_123'
        return null
      }
    })
  } as any
}

describe('upload route hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockSend.mockResolvedValue({})
  })

  it('rejects files whose magic bytes do not match the declared MIME type', async () => {
    const fakePng = fileStub(
      'fake.png',
      'image/png',
      new TextEncoder().encode('not really a png')
    )

    const response = await POST(multipartRequest(fakePng))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('File content does not match declared type')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('uses random object IDs instead of predictable chat paths', async () => {
    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
    const png = fileStub('photo.png', 'image/png', pngBytes)

    const response = await POST(multipartRequest(png))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.file.url).toMatch(
      /^https:\/\/cdn\.example\/user_123\/uploads\//
    )

    const command = mockSend.mock.calls[0]?.[0]
    expect(command.input.Key).toMatch(
      /^user_123\/uploads\/[a-z0-9]+-photo\.png$/
    )
    expect(command.input.Key).not.toContain('/chats/chat_123/')
  })
})
