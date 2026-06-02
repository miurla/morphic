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

  return {
    DeleteObjectsCommand,
    ListObjectsV2Command,
    S3Client,
    send
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectsCommand: s3Mocks.DeleteObjectsCommand,
  ListObjectsV2Command: s3Mocks.ListObjectsV2Command,
  S3Client: s3Mocks.S3Client
}))

const originalEnv = {
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
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
    s3Mocks.S3Client.mockClear()

    process.env.R2_ACCESS_KEY_ID = 'test-access-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    process.env.R2_PUBLIC_URL = 'https://uploads.example.com'
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
})
