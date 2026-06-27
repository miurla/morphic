import { NextRequest, NextResponse } from 'next/server'

import { PutObjectCommand } from '@aws-sdk/client-s3'

import { capture } from '@/lib/analytics/dispatch'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import {
  getR2Client,
  getSignedFileUrl,
  isObjectStorageConfigured,
  R2_BUCKET_NAME
} from '@/lib/storage/r2-client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

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

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }
    const result = await uploadFileToR2(file, userId, chatId)
    if (process.env.ENABLE_AUTH === 'false') {
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

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
}

async function uploadFileToR2(file: File, userId: string, chatId: string) {
  const sanitizedFileName = sanitizeFilename(file.name)
  const filePath = `${userId}/chats/${chatId}/${Date.now()}-${sanitizedFileName}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
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
