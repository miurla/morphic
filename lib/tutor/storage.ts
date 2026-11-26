import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, open, rename, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  getR2Client,
  isObjectStorageConfigured,
  R2_BUCKET_NAME
} from '@/lib/storage/r2-client'

import { TUTOR_LIMITS } from './config'
import {
  getTutorDocumentFormat,
  getTutorDocumentMimeType,
  type TutorDocumentFormat
} from './document-formats'
import {
  createDocument,
  findDocumentByHash,
  getDocument,
  getDocumentIndexKey,
  publicDocument,
  TutorRepositoryError
} from './repository'

// Lowering admission limits must not make previously accepted files unreadable.
const MAX_STORED_DOCUMENT_BYTES = 100 * 1024 * 1024

function invalidSize() {
  return new TutorRepositoryError(
    'The document must be non-empty and within the upload size limit.',
    'INVALID_FILE_SIZE',
    413
  )
}

function validateFilename(name: string): TutorDocumentFormat {
  if (
    !name.trim() ||
    name.length > 255 ||
    /[\u0000-\u001f\u007f/\\]/.test(name)
  )
    throw new TutorRepositoryError(
      'The filename is invalid.',
      'INVALID_FILENAME',
      400
    )
  const format = getTutorDocumentFormat(name)
  if (!format)
    throw new TutorRepositoryError(
      'Upload a PDF, TXT, Markdown, or DOCX document.',
      'UNSUPPORTED_FILE_TYPE',
      400
    )
  return format
}

/** Cheap reception checks only; the background parser establishes validity. */
function validateSignature(format: TutorDocumentFormat, prefix: Uint8Array) {
  if (format === 'pdf' && !Buffer.from(prefix).includes(Buffer.from('%PDF-')))
    throw new TutorRepositoryError(
      'Only PDF files are supported.',
      'INVALID_PDF',
      400
    )
  if (
    format === 'docx' &&
    !Buffer.from(prefix.subarray(0, 4)).equals(Buffer.from([0x50, 0x4b, 3, 4]))
  )
    throw new TutorRepositoryError(
      'The file is not a valid DOCX document.',
      'INVALID_DOCX',
      400
    )
  if (format === 'txt' || format === 'md') {
    const utf16 =
      (prefix[0] === 0xff && prefix[1] === 0xfe) ||
      (prefix[0] === 0xfe && prefix[1] === 0xff)
    if (
      !utf16 &&
      prefix.some(
        byte => byte <= 8 || byte === 11 || (byte >= 14 && byte <= 31)
      )
    )
      throw new TutorRepositoryError(
        'The document is not readable text. Save it as UTF-8 or UTF-16 and try again.',
        'INVALID_TEXT',
        400
      )
  }
}

export function validateTutorPdf(
  file: { size: number; name: string },
  bytes: Uint8Array
) {
  validateFilename(file.name)
  if (
    !file.size ||
    file.size > TUTOR_LIMITS.maxFileSize ||
    bytes.length !== file.size
  )
    throw invalidSize()
  validateSignature('pdf', bytes.subarray(0, 1024))
}

export async function validateTutorDocument(
  file: { size: number; name: string },
  bytes: Uint8Array
) {
  const format = validateFilename(file.name)
  if (
    !file.size ||
    file.size > TUTOR_LIMITS.maxFileSize ||
    bytes.length !== file.size
  )
    throw invalidSize()
  validateSignature(format, bytes.subarray(0, 1024))
  return format
}

function localStorageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.TUTOR_LOCAL_STORAGE_DIR ||
      path.join(process.cwd(), '.tutor-files')
  )
}

export function localTutorPath(objectKey: string) {
  if (!/^tutor\/[a-f0-9]{32}\/[a-f0-9]{64}\.(pdf|txt|md|docx)$/.test(objectKey))
    throw new Error('Invalid tutor object key')
  const root = localStorageRoot()
  const target = path.resolve(root, ...objectKey.split('/'))
  if (!target.startsWith(root + path.sep))
    throw new Error('Invalid tutor storage path')
  return target
}

interface TutorUpload {
  name: string
  stream: ReadableStream<Uint8Array>
  size?: number
  signal?: AbortSignal
}

export async function storeTutorDocumentStream(
  userId: string,
  input: TutorUpload
) {
  const format = validateFilename(input.name)
  if (
    input.size !== undefined &&
    (!Number.isSafeInteger(input.size) ||
      input.size <= 0 ||
      input.size > TUTOR_LIMITS.maxFileSize)
  )
    throw invalidSize()
  input.signal?.throwIfAborted()
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

  // Same-volume temporary files allow atomic publication for local storage.
  const temporaryRoot =
    process.env.TUTOR_STORAGE_DRIVER === 'local'
      ? path.join(localStorageRoot(), '.incoming')
      : tmpdir()
  await mkdir(temporaryRoot, { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(path.join(temporaryRoot, 'tutor-'))
  const temporaryPath = path.join(directory, 'upload')
  let temporaryExists = false
  try {
    const handle = await open(temporaryPath, 'wx', 0o600)
    temporaryExists = true
    let reader: ReadableStreamDefaultReader<Uint8Array>
    try {
      reader = input.stream.getReader()
    } catch (error) {
      await handle.close()
      throw error
    }
    const abort = () => {
      void reader.cancel(input.signal?.reason).catch(() => {})
    }
    input.signal?.addEventListener('abort', abort, { once: true })
    let size = 0
    const hash = createHash('sha256')
    const prefix = new Uint8Array(1024)
    let prefixLength = 0
    try {
      while (true) {
        input.signal?.throwIfAborted()
        const { value, done } = await reader.read()
        input.signal?.throwIfAborted()
        if (done) break
        size += value.byteLength
        if (
          size > TUTOR_LIMITS.maxFileSize ||
          (input.size !== undefined && size > input.size)
        )
          throw invalidSize()
        const amount = Math.min(value.length, prefix.length - prefixLength)
        prefix.set(value.subarray(0, amount), prefixLength)
        prefixLength += amount
        hash.update(value)
        // Await writes to apply backpressure, including platforms with short writes.
        let offset = 0
        while (offset < value.length) {
          input.signal?.throwIfAborted()
          const result = await handle.write(
            value,
            offset,
            value.length - offset
          )
          if (!result.bytesWritten) throw new Error('Could not write document')
          offset += result.bytesWritten
        }
      }
      if (!size || (input.size !== undefined && size !== input.size))
        throw invalidSize()
      validateSignature(format, prefix.subarray(0, prefixLength))
    } finally {
      input.signal?.removeEventListener('abort', abort)
      await reader.cancel().catch(() => {})
      reader.releaseLock()
      await handle.close()
    }

    const contentHash = hash.digest('hex')
    const existing = await findDocumentByHash(
      userId,
      contentHash,
      getDocumentIndexKey(input.name)
    )
    input.signal?.throwIfAborted()
    if (existing) return publicDocument(existing)
    const previousVersion = await findDocumentByHash(userId, contentHash, null)
    input.signal?.throwIfAborted()
    const ownerKey = createHash('sha256')
      .update(userId)
      .digest('hex')
      .slice(0, 32)
    const objectKey =
      previousVersion?.objectKey ?? `tutor/${ownerKey}/${contentHash}.${format}`
    if (!previousVersion && process.env.TUTOR_STORAGE_DRIVER === 'local') {
      const filename = localTutorPath(objectKey)
      await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
      input.signal?.throwIfAborted()
      await rename(temporaryPath, filename)
      temporaryExists = false
    } else if (!previousVersion) {
      const body = createReadStream(temporaryPath)
      try {
        await getR2Client().send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: objectKey,
            Body: body,
            ContentLength: size,
            ContentType: getTutorDocumentMimeType(input.name)
          }),
          { abortSignal: input.signal }
        )
      } finally {
        body.destroy()
        // Windows cannot unlink a file until its stream descriptor closes.
        if (!body.closed)
          await new Promise<void>(resolve => body.once('close', resolve))
      }
    }
    // Once published, finish metadata even if the client disconnects so retries
    // can reuse it. Deleting the object could damage another concurrent request.
    const document = await createDocument(userId, {
      id: randomUUID(),
      filename: input.name,
      size,
      objectKey,
      contentHash
    })
    if (!document) throw new Error('Could not save document metadata')
    return publicDocument(document)
  } finally {
    if (temporaryExists) await unlink(temporaryPath)
    await rmdir(directory)
  }
}

export async function storeTutorDocument(userId: string, file: File) {
  return storeTutorDocumentStream(userId, {
    name: file.name,
    size: file.size,
    stream: file.stream()
  })
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
  if (
    !Number.isSafeInteger(document.size) ||
    document.size <= 0 ||
    document.size > MAX_STORED_DOCUMENT_BYTES
  )
    throw new Error('Stored document is too large')
  let bytes: Uint8Array
  if (process.env.TUTOR_STORAGE_DRIVER === 'local') {
    const handle = await open(
      /* turbopackIgnore: true */ localTutorPath(document.objectKey),
      'r'
    )
    try {
      if ((await handle.stat()).size !== document.size)
        throw new Error('Document integrity check failed')
      bytes = new Uint8Array(document.size)
      let offset = 0
      while (offset < bytes.length) {
        const result = await handle.read(
          bytes,
          offset,
          bytes.length - offset,
          offset
        )
        if (!result.bytesRead)
          throw new Error('Document integrity check failed')
        offset += result.bytesRead
      }
      if ((await handle.read(new Uint8Array(1), 0, 1, offset)).bytesRead)
        throw new Error('Document integrity check failed')
    } finally {
      await handle.close()
    }
  } else {
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: document.objectKey })
    )
    if (!result.Body) throw new Error('Missing document content')
    const reader = result.Body.transformToWebStream().getReader()
    try {
      if (
        result.ContentLength !== undefined &&
        result.ContentLength !== document.size
      )
        throw new Error('Document integrity check failed')
      bytes = new Uint8Array(document.size)
      let offset = 0
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (offset + value.byteLength > bytes.length)
          throw new Error('Document integrity check failed')
        bytes.set(value, offset)
        offset += value.byteLength
      }
      if (offset !== bytes.length)
        throw new Error('Document integrity check failed')
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  if (createHash('sha256').update(bytes).digest('hex') !== document.contentHash)
    throw new Error('Document integrity check failed')
  return bytes
}
