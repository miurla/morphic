import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const s3Mocks = vi.hoisted(() => {
  const send = vi.fn()
  const S3Client = vi.fn(function () {
    return { send }
  })

  class ListObjectsV2Command {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  }

  class DeleteObjectsCommand {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  }

  class GetObjectCommand {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  }

  return {
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    S3Client,
    getSignedUrl: vi.fn(),
    send
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectsCommand: s3Mocks.DeleteObjectsCommand,
  GetObjectCommand: s3Mocks.GetObjectCommand,
  ListObjectsV2Command: s3Mocks.ListObjectsV2Command,
  S3Client: s3Mocks.S3Client
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: s3Mocks.getSignedUrl
}))

const originalEnv = {
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  R2_SIGNED_URL_EXPIRES_SECONDS: process.env.R2_SIGNED_URL_EXPIRES_SECONDS,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT
}

async function importR2Client() {
  vi.resetModules()
  return import('../r2-client')
}

describe('R2 client', () => {
  beforeEach(() => {
    s3Mocks.send.mockReset()
    s3Mocks.getSignedUrl.mockReset()
    s3Mocks.S3Client.mockClear()

    process.env.R2_ACCESS_KEY_ID = 'test-access-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    process.env.R2_PUBLIC_URL = 'https://uploads.example.com'
    process.env.R2_SIGNED_URL_EXPIRES_SECONDS = '3600'
    process.env.S3_ENDPOINT = 'https://r2.example.com'
    delete process.env.R2_ACCOUNT_ID
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('counts deleted objects when object storage deletion succeeds', async () => {
    s3Mocks.send
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'user-id/file-1.png' },
          { Key: 'user-id/file-2.png' }
        ],
        IsTruncated: false
      })
      .mockResolvedValueOnce({})

    const { deleteObjectsByPrefix } = await importR2Client()

    await expect(deleteObjectsByPrefix('user-id/')).resolves.toEqual({
      deletedCount: 2,
      skipped: false
    })

    expect(s3Mocks.send).toHaveBeenCalledTimes(2)
    expect(s3Mocks.send.mock.calls[1][0]).toBeInstanceOf(
      s3Mocks.DeleteObjectsCommand
    )
    expect((s3Mocks.send.mock.calls[1][0] as any).input.Delete.Objects).toEqual(
      [{ Key: 'user-id/file-1.png' }, { Key: 'user-id/file-2.png' }]
    )
  })

  it('fails when object storage reports per-object delete errors', async () => {
    s3Mocks.send
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'user-id/file-1.png' },
          { Key: 'user-id/file-2.png' }
        ],
        IsTruncated: false
      })
      .mockResolvedValueOnce({
        Errors: [{ Code: 'AccessDenied', Key: 'user-id/file-2.png' }]
      })

    const { deleteObjectsByPrefix } = await importR2Client()

    await expect(deleteObjectsByPrefix('user-id/')).rejects.toThrow(
      'Failed to delete 1 object(s) from storage: user-id/file-2.png'
    )
  })

  it('does not require a public URL for object storage configuration', async () => {
    delete process.env.R2_PUBLIC_URL

    const { isObjectStorageConfigured } = await importR2Client()

    expect(isObjectStorageConfigured()).toBe(true)
  })

  it('creates signed file URLs from object keys', async () => {
    s3Mocks.getSignedUrl.mockResolvedValue('https://signed.example.com/file')

    const { getSignedFileUrl } = await importR2Client()

    await expect(getSignedFileUrl('/user-id/file.png')).resolves.toBe(
      'https://signed.example.com/file'
    )
    expect(s3Mocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(s3Mocks.GetObjectCommand),
      { expiresIn: 3600 }
    )
    expect((s3Mocks.getSignedUrl.mock.calls[0][1] as any).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'user-id/file.png'
    })
  })

  it('preserves existing file URLs when no object key is available', async () => {
    const { signFilePartUrls } = await importR2Client()

    await expect(
      signFilePartUrls([
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'external.png',
          url: 'https://external.example.com/external.png'
        }
      ])
    ).resolves.toEqual([
      {
        type: 'file',
        mediaType: 'image/png',
        filename: 'external.png',
        url: 'https://external.example.com/external.png'
      }
    ])
  })

  it('rejects object keys outside the allowed prefix', async () => {
    const { signFilePartUrls } = await importR2Client()

    await expect(
      signFilePartUrls(
        [
          {
            type: 'file',
            key: 'other-user/chats/chat-123/file.png',
            mediaType: 'image/png',
            filename: 'file.png',
            url: ''
          }
        ],
        { allowedKeyPrefix: 'user-123/chats/chat-123/' }
      )
    ).rejects.toThrow('File object key is not allowed for this user')

    expect(s3Mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('signs object keys inside the allowed prefix', async () => {
    s3Mocks.getSignedUrl.mockResolvedValue('https://signed.example.com/file')

    const { signFilePartUrls } = await importR2Client()

    await expect(
      signFilePartUrls(
        [
          {
            type: 'file',
            key: 'user-123/chats/chat-123/file.png',
            mediaType: 'image/png',
            filename: 'file.png',
            url: ''
          }
        ],
        { allowedKeyPrefix: 'user-123/chats/chat-123/' }
      )
    ).resolves.toEqual([
      {
        type: 'file',
        key: 'user-123/chats/chat-123/file.png',
        mediaType: 'image/png',
        filename: 'file.png',
        url: 'https://signed.example.com/file'
      }
    ])
  })
})
