import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'user-uploads'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

let _r2Client: S3Client | null = null

export function getR2Client(): S3Client {
  if (_r2Client) {
    return _r2Client
  }

  const s3Endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, '')
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 configuration missing: R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY'
    )
  }

  if (!s3Endpoint && !accountId) {
    throw new Error(
      'S3 configuration missing: set S3_ENDPOINT (generic S3) or R2_ACCOUNT_ID (Cloudflare R2)'
    )
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: s3Endpoint || `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: !!s3Endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })

  return _r2Client
}

export function isObjectStorageConfigured() {
  const hasCredentials =
    !!process.env.R2_ACCESS_KEY_ID && !!process.env.R2_SECRET_ACCESS_KEY
  const hasEndpointOrAccount =
    !!process.env.S3_ENDPOINT || !!process.env.R2_ACCOUNT_ID
  const hasPublicUrl = !!R2_PUBLIC_URL

  return hasCredentials && hasEndpointOrAccount && hasPublicUrl
}

export async function deleteObjectsByPrefix(prefix: string) {
  if (!isObjectStorageConfigured()) {
    return { deletedCount: 0, skipped: true }
  }

  const r2Client = getR2Client()
  let continuationToken: string | undefined
  let deletedCount = 0

  do {
    const listedObjects = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
    )

    const keys =
      listedObjects.Contents?.map(object => object.Key).filter(
        (key): key is string => Boolean(key)
      ) ?? []

    if (keys.length > 0) {
      const deleteResponse = await r2Client.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: {
            Objects: keys.map(Key => ({ Key })),
            Quiet: true
          }
        })
      )

      const deleteErrors = deleteResponse.Errors ?? []
      if (deleteErrors.length > 0) {
        const sampleErrors = deleteErrors
          .slice(0, 3)
          .map(error => error.Key ?? error.Code ?? 'unknown')
          .join(', ')

        throw new Error(
          `Failed to delete ${deleteErrors.length} object(s) from storage: ${sampleErrors}`
        )
      }

      deletedCount += keys.length
    }

    continuationToken = listedObjects.IsTruncated
      ? listedObjects.NextContinuationToken
      : undefined
  } while (continuationToken)

  return { deletedCount, skipped: false }
}

export async function deleteUserObjects(userId: string) {
  return deleteObjectsByPrefix(`${userId}/`)
}
