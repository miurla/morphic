import { NextRequest, NextResponse } from 'next/server'

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'

import { capture } from '@/lib/analytics/dispatch'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import {
  detectFileMediaType,
  isSupportedFileType
} from '@/lib/storage/file-signature'
import {
  getChatFileObjectKeyPrefix,
  getObjectContentMd5,
  getR2Client,
  getSignedFileUrl,
  isObjectStorageConfigured,
  R2_BUCKET_NAME
} from '@/lib/storage/r2-client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isObjectStorageConfigured()) {
      return NextResponse.json(
        {
          error: 'File upload storage is not configured',
          message:
            'Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and either R2_ACCOUNT_ID or S3_ENDPOINT.'
        },
        { status: 400 }
      )
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const chatId = formData.get('chatId') as string
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 5MB)' },
        { status: 400 }
      )
    }

    if (!isSupportedFileType(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }
    const isAnonymous = process.env.ENABLE_AUTH === 'false'
    const buffer = Buffer.from(await file.arrayBuffer())

    // The browser reports file.type from the name, so an unreadable file passes
    // the check above and only fails later, once the provider rejects the whole
    // turn. The bytes decide whether the file is readable at all; which of the
    // supported formats they match is deliberately not used to overwrite the
    // declared type, because file identity downstream keys off it.
    if (!detectFileMediaType(buffer)) {
      return NextResponse.json(
        {
          error: 'Unsupported file content',
          message:
            'The file contents are not a JPEG, PNG, or PDF even though the file name suggests otherwise.'
        },
        { status: 400 }
      )
    }

    if (!isAnonymous && chatId) {
      const reused = await reuseExistingChatFile(file, buffer, userId, chatId)
      if (reused) {
        return NextResponse.json(
          { success: true, file: reused },
          { status: 200 }
        )
      }
    }

    const result = await uploadFileToR2(file, buffer, userId, chatId)
    if (isAnonymous) {
      return NextResponse.json({ success: true, file: result }, { status: 200 })
    }

    let libraryFile = null
    try {
      const createdFile = await dbActions.createLibraryFile({
        userId,
        chatId: chatId || null,
        filename: result.filename,
        objectKey: result.key,
        mediaType: result.mediaType,
        size: file.size
      })
      libraryFile = {
        ...createdFile,
        key: createdFile.objectKey,
        url: result.url
      }
      await capture({
        event: 'file_saved_to_library',
        distinctId: userId,
        properties: {
          mediaType: result.mediaType,
          source: 'upload',
          size: file.size
        }
      })
    } catch (error) {
      console.error('Library file metadata save failed:', error)
    }

    return NextResponse.json(
      {
        success: true,
        file: libraryFile
          ? { ...result, id: libraryFile.id, size: file.size, libraryFile }
          : { ...result, size: file.size }
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('Upload Error:', err)
    return NextResponse.json(
      { error: 'Upload failed', message: err.message },
      { status: 500 }
    )
  }
}

/**
 * Points a repeated upload at the copy already stored for this chat.
 *
 * Re-uploading the same file is the common way a conversation ends up carrying
 * two of it, usually because the first copy went unmentioned in the reply. A
 * fresh upload would mint a new object key, which reads as a different file
 * everywhere downstream, so the model would be handed both copies on every
 * later turn.
 *
 * Name, media type and size only narrow the search to a few stored candidates.
 * The decision itself is a digest comparison: handing back a different file
 * under the same name would be a silent substitution, which is a far worse
 * outcome than the duplicate this avoids. Every candidate is compared, or two
 * same-sized versions of one file would push each other out of the search and
 * mint a new object on every upload.
 *
 * Returns null whenever no match can be confirmed, and the caller uploads.
 */
async function reuseExistingChatFile(
  file: File,
  buffer: Buffer,
  userId: string,
  chatId: string
) {
  try {
    const candidates = await dbActions.findChatFileCandidates({
      userId,
      chatKeyPrefix: getChatFileObjectKeyPrefix(userId, chatId),
      filename: file.name,
      mediaType: file.type,
      size: file.size
    })
    if (candidates.length === 0) return null

    const uploadedMd5 = createHash('md5').update(buffer).digest('hex')

    for (const candidate of candidates) {
      const storedMd5 = await getObjectContentMd5(candidate.objectKey)
      if (!storedMd5 || storedMd5 !== uploadedMd5) continue

      const url = await getSignedFileUrl(candidate.objectKey)

      return {
        type: 'file',
        filename: candidate.filename,
        key: candidate.objectKey,
        url,
        mediaType: candidate.mediaType,
        id: candidate.id,
        size: file.size,
        libraryFile: { ...candidate, key: candidate.objectKey, url }
      }
    }

    return null
  } catch (error) {
    console.error('Duplicate upload lookup failed:', error)
    return null
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
}

async function uploadFileToR2(
  file: File,
  buffer: Buffer,
  userId: string,
  chatId: string
) {
  const sanitizedFileName = sanitizeFilename(file.name)
  const filePath = `${getChatFileObjectKeyPrefix(userId, chatId)}${Date.now()}-${sanitizedFileName}`

  try {
    const r2Client = getR2Client()

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filePath,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'max-age=3600'
      })
    )

    const signedUrl = await getSignedFileUrl(filePath)

    return {
      filename: file.name,
      key: filePath,
      url: signedUrl,
      mediaType: file.type,
      type: 'file'
    }
  } catch (error: any) {
    throw new Error('Upload failed: ' + error.message)
  }
}
