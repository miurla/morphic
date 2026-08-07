import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'user-uploads'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''
const DEFAULT_SIGNED_URL_EXPIRES_SECONDS = 60 * 60
const configuredSignedUrlExpiresSeconds = Number(
  process.env.R2_SIGNED_URL_EXPIRES_SECONDS
)
export const R2_SIGNED_URL_EXPIRES_SECONDS =
  Number.isFinite(configuredSignedUrlExpiresSeconds) &&
  configuredSignedUrlExpiresSeconds > 0
    ? configuredSignedUrlExpiresSeconds
    : DEFAULT_SIGNED_URL_EXPIRES_SECONDS

const DEFAULT_SIGNED_URL_STABILITY_WINDOW_SECONDS = 15 * 60

/**
 * Only an explicit `0` goes back to signing every request with the current time.
 *
 * Templated environments routinely define a variable as an empty string, and
 * `Number('')` is `0` — which would silently turn the window off while looking
 * configured. Anything unusable falls back to the default instead.
 */
export function parseSignedUrlStabilityWindowSeconds(
  raw: string | undefined
): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_SIGNED_URL_STABILITY_WINDOW_SECONDS

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SIGNED_URL_STABILITY_WINDOW_SECONDS
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const R2_SIGNED_URL_STABILITY_WINDOW_SECONDS =
  parseSignedUrlStabilityWindowSeconds(
    process.env.R2_SIGNED_URL_STABILITY_WINDOW_SECONDS
  )

let _r2Client: S3Client | null = null

type SignFilePartUrlsOptions = {
  allowedKeyPrefix?: string
}

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

  return hasCredentials && hasEndpointOrAccount
}

function normalizeObjectKey(key: string) {
  return key.replace(/^\/+/, '')
}

export function getChatFileObjectKeyPrefix(userId: string, chatId: string) {
  return `${normalizeObjectKey(userId)}/chats/${normalizeObjectKey(chatId)}/`
}

export function getUserFileObjectKeyPrefix(userId: string) {
  return `${normalizeObjectKey(userId)}/`
}

function isObjectKeyWithinPrefix(key: string, prefix: string) {
  const normalizedKey = normalizeObjectKey(key)
  const normalizedPrefix = normalizeObjectKey(prefix).replace(/\/+$/, '')

  return (
    normalizedPrefix.length > 0 &&
    normalizedKey.startsWith(`${normalizedPrefix}/`)
  )
}

/**
 * Rounds the signing time down to a fixed window so the same object key signs
 * to a byte-identical URL for the whole window.
 *
 * Attachments are replayed on every turn of a conversation, and a URL whose
 * signature changes per request changes the prompt prefix with it, so the
 * provider re-reads every replayed attachment instead of serving it from the
 * prompt cache.
 *
 * The window is capped at half the expiry so a URL handed out at the end of a
 * window still keeps at least half its configured lifetime.
 */
function getStableSigningDate(expiresIn: number): Date | undefined {
  const windowSeconds = Math.min(
    R2_SIGNED_URL_STABILITY_WINDOW_SECONDS,
    Math.floor(expiresIn / 2)
  )
  if (windowSeconds < 1) {
    return undefined
  }

  const windowMs = windowSeconds * 1000
  return new Date(Math.floor(Date.now() / windowMs) * windowMs)
}

export async function getSignedFileUrl(
  key: string,
  expiresIn = R2_SIGNED_URL_EXPIRES_SECONDS
) {
  const normalizedKey = normalizeObjectKey(key)
  if (!normalizedKey) {
    throw new Error('Cannot sign an empty object key')
  }

  const signingDate = getStableSigningDate(expiresIn)

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: normalizedKey
    }),
    signingDate ? { expiresIn, signingDate } : { expiresIn }
  )
}

/**
 * Whether the object is still in the bucket.
 *
 * Stored metadata can outlive the object it points at, so anything that reuses
 * a key it did not just write has to ask. A failed lookup answers `false`: the
 * caller falls back to uploading, which is correct either way.
 */
export async function objectExists(key: string): Promise<boolean> {
  const normalizedKey = normalizeObjectKey(key)
  if (!normalizedKey) return false

  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: normalizedKey })
    )
    return true
  } catch {
    return false
  }
}

export async function signFilePartUrls(
  parts: any[] = [],
  options: SignFilePartUrlsOptions = {}
) {
  return Promise.all(
    parts.map(async part => {
      if (part?.type !== 'file') {
        return part
      }

      if (!part.key) {
        return part
      }

      if (
        options.allowedKeyPrefix &&
        !isObjectKeyWithinPrefix(part.key, options.allowedKeyPrefix)
      ) {
        throw new Error('File object key is not allowed for this user')
      }

      try {
        return {
          ...part,
          url: await getSignedFileUrl(part.key)
        }
      } catch (error) {
        console.error('Failed to sign file URL:', error)
        return { ...part, url: '' }
      }
    })
  )
}

export async function signFilePartUrlsInMessages<T extends { parts?: any[] }>(
  messages: T[]
): Promise<T[]> {
  return Promise.all(
    messages.map(async message => ({
      ...message,
      parts: await signFilePartUrls(message.parts)
    }))
  )
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
