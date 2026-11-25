import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  getR2Client,
  isObjectStorageConfigured,
  R2_BUCKET_NAME
} from '@/lib/storage/r2-client'

import { TUTOR_LIMITS } from './config'
import {
  getTutorDocumentFormat,
  getTutorDocumentMimeType
} from './document-formats'
import { parseTutorDocument } from './documents'
import {
  createDocument,
  findDocumentByHash,
  getDocument,
  getDocumentIndexKey,
  publicDocument,
  TutorRepositoryError
} from './repository'

export function validateTutorPdf(
  file: { size: number; name: string },
  bytes: Uint8Array
) {
  if (
    file.size === 0 ||
    file.size > TUTOR_LIMITS.maxFileSize ||
    bytes.byteLength !== file.size
  )
    throw new TutorRepositoryError(
      'Upload a non-empty document no larger than 5 MB.',
      'INVALID_FILE_SIZE',
      400
    )
  if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from('%PDF-')))
    throw new TutorRepositoryError(
      'Only PDF files are supported.',
      'INVALID_PDF',
      400
    )
  if (!file.name.trim() || file.name.length > 255)
    throw new TutorRepositoryError(
      'The filename is invalid.',
      'INVALID_FILENAME',
      400
    )
}

export async function validateTutorDocument(
  file: { size: number; name: string },
  bytes: Uint8Array
) {
  if (
    !file.name.trim() ||
    file.name.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(file.name)
  )
    throw new TutorRepositoryError(
      'The filename is invalid.',
      'INVALID_FILENAME',
      400
    )
  if (
    !file.size ||
    file.size > TUTOR_LIMITS.maxFileSize ||
    bytes.byteLength !== file.size
  )
    throw new TutorRepositoryError(
      'Upload a non-empty document no larger than 5 MB.',
      'INVALID_FILE_SIZE',
      400
    )
  const format = getTutorDocumentFormat(file.name)
  if (!format)
    throw new TutorRepositoryError(
      'Upload a PDF, TXT, Markdown, or DOCX document.',
      'UNSUPPORTED_FILE_TYPE',
      400
    )
  if (format === 'pdf') validateTutorPdf(file, bytes)
  else await parseTutorDocument(bytes, file.name)
  return format
}

export function localTutorPath(objectKey: string) {
  if (!/^tutor\/[a-f0-9]{32}\/[a-f0-9]{64}\.(pdf|txt|md|docx)$/.test(objectKey))
    throw new Error('Invalid tutor object key')
  const root = path.resolve(
    /* turbopackIgnore: true */
    process.env.TUTOR_LOCAL_STORAGE_DIR ||
      path.join(process.cwd(), '.tutor-files')
  )
  const target = path.resolve(root, ...objectKey.split('/'))
  if (!target.startsWith(root + path.sep))
    throw new Error('Invalid tutor storage path')
  return target
}

export async function storeTutorDocument(userId: string, file: File) {
  if (file.size > TUTOR_LIMITS.maxFileSize)
    throw new TutorRepositoryError(
      'Upload a non-empty document no larger than 5 MB.',
      'INVALID_FILE_SIZE',
      400
    )
  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = await validateTutorDocument(file, bytes)
  if (
    (!process.env.DATABASE_URL?.trim() &&
      !process.env.DATABASE_RESTRICTED_URL?.trim()) ||
    (process.env.TUTOR_STORAGE_DRIVER !== 'local' &&
      !isObjectStorageConfigured())
  )
    throw new TutorRepositoryError(
      'Tutor is not configured yet.',
      'TUTOR_NOT_CONFIGURED',
      503
    )
  const contentHash = createHash('sha256').update(bytes).digest('hex')
  const existing = await findDocumentByHash(
    userId,
    contentHash,
    getDocumentIndexKey(file.name)
  )
  if (existing) return publicDocument(existing)
  const previousVersion = await findDocumentByHash(userId, contentHash, null)
  const ownerKey = createHash('sha256')
    .update(userId)
    .digest('hex')
    .slice(0, 32)
  // Reuse the original key across index versions, including identical TXT/MD
  // content uploaded with a different extension.
  const objectKey =
    previousVersion?.objectKey ?? `tutor/${ownerKey}/${contentHash}.${format}`
  if (!previousVersion && process.env.TUTOR_STORAGE_DRIVER === 'local') {
    const filename = localTutorPath(objectKey)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, bytes, { flag: 'w', mode: 0o600 })
  } else if (!previousVersion) {
    if (!isObjectStorageConfigured())
      throw new TutorRepositoryError(
        'File storage is not configured.',
        'STORAGE_UNAVAILABLE',
        503
      )
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        Body: bytes,
        ContentType: getTutorDocumentMimeType(file.name)
      })
    )
  }
  const document = await createDocument(userId, {
    id: randomUUID(),
    filename: file.name,
    size: bytes.byteLength,
    objectKey,
    contentHash
  })
  if (!document) throw new Error('Could not save document metadata')
  return publicDocument(document)
}

export async function readTutorDocument(
  userId: string,
  documentId: string
): Promise<Uint8Array> {
  const document = await getDocument(userId, documentId)
  if (!document)
    throw new TutorRepositoryError(
      'The requested learning resource was not found.'
    )
  const expectedOwner = createHash('sha256')
    .update(userId)
    .digest('hex')
    .slice(0, 32)
  if (
    !['pdf', 'txt', 'md', 'docx'].some(
      extension =>
        document.objectKey ===
        `tutor/${expectedOwner}/${document.contentHash}.${extension}`
    )
  )
    throw new Error('Invalid tutor document storage reference')
  let bytes: Uint8Array
  if (process.env.TUTOR_STORAGE_DRIVER === 'local') {
    // Uploaded documents are runtime data on a durable volume, never build assets.
    bytes = new Uint8Array(
      await readFile(
        /* turbopackIgnore: true */ localTutorPath(document.objectKey)
      )
    )
  } else {
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: document.objectKey })
    )
    if (!result.Body) throw new Error('Missing document content')
    if ((result.ContentLength ?? 0) > TUTOR_LIMITS.maxFileSize)
      throw new Error('Stored document is too large')
    bytes = await result.Body.transformToByteArray()
  }
  if (
    bytes.byteLength > TUTOR_LIMITS.maxFileSize ||
    createHash('sha256').update(bytes).digest('hex') !== document.contentHash
  )
    throw new Error('Document integrity check failed')
  return bytes
}
