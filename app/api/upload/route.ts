import { NextRequest, NextResponse } from 'next/server'

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createId } from '@paralleldrive/cuid2'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  getR2Client,
  isObjectStorageConfigured,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL
} from '@/lib/storage/r2-client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d]
}

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
            'Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL, and either R2_ACCOUNT_ID or S3_ENDPOINT.'
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
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasValidMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 }
      )
    }

    const result = await uploadFileToR2(file, buffer, userId, chatId)
    return NextResponse.json({ success: true, file: result }, { status: 200 })
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

function hasValidMagicBytes(buffer: Buffer, contentType: string) {
  const expected = MAGIC_BYTES[contentType]
  if (!expected || buffer.length < expected.length) {
    return false
  }

  return expected.every((byte, index) => buffer[index] === byte)
}

async function uploadFileToR2(
  file: File,
  buffer: Buffer,
  userId: string,
  _chatId: string
) {
  const sanitizedFileName = sanitizeFilename(file.name)
  const filePath = `${userId}/uploads/${createId()}-${sanitizedFileName}`

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

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${filePath}`

    return {
      filename: file.name,
      url: publicUrl,
      mediaType: file.type,
      type: 'file'
    }
  } catch (error: any) {
    throw new Error('Upload failed: ' + error.message)
  }
}
