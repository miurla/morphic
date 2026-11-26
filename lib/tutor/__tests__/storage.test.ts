// @vitest-environment node
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  get: vi.fn(),
  send: vi.fn(),
  configured: vi.fn(),
  limits: { maxFileSize: 20 * 1024 * 1024 }
}))
vi.mock('../repository', () => ({
  TutorRepositoryError: class extends Error {
    constructor(
      message: string,
      public code = 'NOT_FOUND',
      public status = 404
    ) {
      super(message)
    }
  },
  createDocument: mocks.create,
  findDocumentByHash: mocks.find,
  getDocument: mocks.get,
  getDocumentIndexKey: (filename: string) =>
    `index:${filename.split('.').pop()}`,
  publicDocument: (document: unknown) => document
}))
vi.mock('../config', () => ({ TUTOR_LIMITS: mocks.limits }))
vi.mock('@/lib/storage/r2-client', () => ({
  getR2Client: () => ({ send: mocks.send }),
  isObjectStorageConfigured: mocks.configured,
  R2_BUCKET_NAME: 'test-bucket'
}))
import {
  localTutorPath,
  readTutorDocument,
  storeTutorDocument,
  storeTutorDocumentStream,
  validateTutorDocument,
  validateTutorPdf
} from '../storage'

let temporaryRoot: string
beforeEach(async () => {
  vi.resetAllMocks()
  mocks.limits.maxFileSize = 20 * 1024 * 1024
  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tutor-storage-test-'))
  vi.stubEnv('DATABASE_URL', 'postgres://test')
  vi.stubEnv('TUTOR_STORAGE_DRIVER', 'local')
  vi.stubEnv('TUTOR_LOCAL_STORAGE_DIR', temporaryRoot)
  mocks.create.mockImplementation(async (_user, document) => document)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  const target = path.resolve(temporaryRoot)
  if (
    !target.startsWith(path.join(path.resolve(tmpdir()), 'tutor-storage-test-'))
  )
    throw new Error('Unsafe test cleanup')
  await rm(target, { recursive: true, force: true })
})

function stream(...chunks: (string | Uint8Array)[]) {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === chunks.length) {
        controller.close()
        return
      }
      const value = chunks[index++]
      controller.enqueue(
        typeof value === 'string' ? new TextEncoder().encode(value) : value
      )
    }
  })
}

function stored(bytes: Uint8Array, extension = 'txt') {
  const contentHash = createHash('sha256').update(bytes).digest('hex')
  const owner = createHash('sha256').update('alice').digest('hex').slice(0, 32)
  return {
    objectKey: `tutor/${owner}/${contentHash}.${extension}`,
    contentHash,
    size: bytes.length
  }
}

describe('Tutor streaming document storage', () => {
  it('validates real signatures and reports configured size failures', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n')
    expect(() =>
      validateTutorPdf({ size: bytes.length, name: 'notes.pdf' }, bytes)
    ).not.toThrow()
    expect(() =>
      validateTutorPdf({ size: 21 * 1024 * 1024, name: 'notes.pdf' }, bytes)
    ).toThrow('upload size limit')
    expect(() =>
      validateTutorPdf({ size: 3, name: 'fake.pdf' }, new Uint8Array(3))
    ).toThrow('Only PDF files')
    await expect(
      validateTutorDocument({ name: 'notes.txt', size: 1 }, new Uint8Array(2))
    ).rejects.toMatchObject({ code: 'INVALID_FILE_SIZE' })
    await expect(
      validateTutorDocument({ name: 'notes.docx', size: 3 }, new Uint8Array(3))
    ).rejects.toMatchObject({ code: 'INVALID_DOCX' })
  })

  it('only resolves generated object keys within the configured root', () => {
    const key = `tutor/${'a'.repeat(32)}/${'b'.repeat(64)}.pdf`
    expect(localTutorPath(key)).toBe(
      path.join(temporaryRoot, ...key.split('/'))
    )
    for (const invalid of [
      '../secret',
      'tutor/../../secret',
      'C:\\secret',
      '/etc/passwd',
      'tutor/u/file.pdf'
    ])
      expect(() => localTutorPath(invalid)).toThrow()
  })

  it.each(['txt', 'md', 'markdown'])(
    'stores %s without buffering the File or requiring a model',
    async extension => {
      const text = '# Transactions\nAll changes commit together.'
      const file = new File([text], `notes.${extension}`)
      const arrayBuffer = vi
        .spyOn(file, 'arrayBuffer')
        .mockRejectedValue(new Error('Do not buffer uploads'))
      const document = await storeTutorDocument('alice', file)
      expect(document.filename).toBe(file.name)
      expect(arrayBuffer).not.toHaveBeenCalled()
      const metadata = mocks.create.mock.calls[0][1]
      expect(metadata.objectKey).toMatch(
        new RegExp(`\\.${extension === 'markdown' ? 'md' : extension}$`)
      )
      expect(await readFile(localTutorPath(metadata.objectKey), 'utf8')).toBe(
        text
      )
      expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
    }
  )

  it('defers deep parsing: a DOCX signature can be received without claiming validity', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])
    await storeTutorDocument('alice', new File([bytes], 'notes.docx'))
    expect(mocks.create).toHaveBeenCalledOnce()
  })

  it('rejects invalid metadata, signatures and empty files before database publication', async () => {
    for (const file of [
      new File(['text'], 'notes.exe'),
      new File(['PK\0binary'], 'notes.md'),
      new File([''], 'empty.txt'),
      new File(['text'], '../secret.txt')
    ])
      await expect(storeTutorDocument('alice', file)).rejects.toThrow()
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
  })

  it('checks cumulative bytes even when content-length is absent or forged', async () => {
    mocks.limits.maxFileSize = 8
    for (const input of [
      { stream: stream('12345', '6789') },
      { stream: stream('12345', '6789'), size: 8 },
      { stream: stream('1234'), size: 8 }
    ])
      await expect(
        storeTutorDocumentStream('alice', { name: 'notes.txt', ...input })
      ).rejects.toMatchObject({ code: 'INVALID_FILE_SIZE' })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
  })

  it('rejects an oversized declared body without reading it', async () => {
    const getReader = vi.fn()
    await expect(
      storeTutorDocumentStream('alice', {
        name: 'notes.pdf',
        size: 21 * 1024 * 1024,
        stream: { getReader } as unknown as ReadableStream<Uint8Array>
      })
    ).rejects.toMatchObject({ code: 'INVALID_FILE_SIZE', status: 413 })
    expect(getReader).not.toHaveBeenCalled()
    expect(await readdir(temporaryRoot)).toEqual([])
  })

  it('accepts the exact 20 MiB limit in bounded chunks', async () => {
    let remaining = 20 * 1024 * 1024
    const input = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!remaining) {
          controller.close()
          return
        }
        const length = Math.min(64 * 1024, remaining)
        controller.enqueue(new Uint8Array(length).fill(65))
        remaining -= length
      }
    })
    await storeTutorDocumentStream('alice', {
      name: 'notes.txt',
      stream: input
    })
    expect(mocks.create.mock.calls[0][1].size).toBe(20 * 1024 * 1024)
  })

  it('cancels a stalled input and removes the private temporary file', async () => {
    const abort = new AbortController()
    let notifyRead!: () => void
    const reading = new Promise<void>(resolve => {
      notifyRead = resolve
    })
    const cancel = vi.fn()
    let first = true
    const input = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (first) {
          first = false
          controller.enqueue(new TextEncoder().encode('partial'))
          return
        }
        notifyRead()
      },
      cancel
    })
    const operation = storeTutorDocumentStream('alice', {
      name: 'notes.txt',
      stream: input,
      signal: abort.signal
    })
    const rejected = expect(operation).rejects.toMatchObject({
      name: 'AbortError'
    })
    await reading
    abort.abort()
    await rejected
    expect(cancel).toHaveBeenCalledOnce()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
  })

  it('removes partial files when the source stream fails', async () => {
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('Connection lost'))
      }
    })
    await expect(
      storeTutorDocumentStream('alice', { name: 'notes.txt', stream: input })
    ).rejects.toThrow('Connection lost')
    expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
  })

  it('closes the temporary file when the incoming stream is already locked', async () => {
    const input = stream('text')
    const reader = input.getReader()
    try {
      await expect(
        storeTutorDocumentStream('alice', { name: 'notes.txt', stream: input })
      ).rejects.toThrow()
      expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
    } finally {
      reader.releaseLock()
    }
  })

  it('reports missing services before repository access', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('DATABASE_RESTRICTED_URL', '')
    await expect(
      storeTutorDocument('alice', new File(['some text'], 'notes.txt'))
    ).rejects.toMatchObject({ code: 'TUTOR_NOT_CONFIGURED', status: 503 })
    vi.stubEnv('DATABASE_URL', 'postgres://test')
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'r2')
    await expect(
      storeTutorDocument('alice', new File(['some text'], 'notes.txt'))
    ).rejects.toMatchObject({ code: 'TUTOR_NOT_CONFIGURED', status: 503 })
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('streams object storage writes with the measured content length and real MIME type', async () => {
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'r2')
    mocks.configured.mockReturnValue(true)
    const chunks: Buffer[] = []
    mocks.send.mockImplementation(async command => {
      expect(command.input.Body).toBeInstanceOf(Readable)
      for await (const chunk of command.input.Body) chunks.push(chunk)
    })
    await storeTutorDocument(
      'alice',
      new File(['# Topic\nContent'], 'notes.md')
    )
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      ContentType: 'text/markdown',
      ContentLength: 15,
      Key: expect.stringMatching(/\.md$/)
    })
    expect(Buffer.concat(chunks).toString()).toBe('# Topic\nContent')
  })

  it('cleans temporary files on duplicate reuse and preserves previous extension keys', async () => {
    const existing = { id: 'existing' }
    mocks.find.mockResolvedValueOnce(existing)
    expect(
      await storeTutorDocument('alice', new File(['text'], 'notes.txt'))
    ).toBe(existing)
    expect(mocks.create).not.toHaveBeenCalled()
    const previous = stored(new TextEncoder().encode('Learning materials'))
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce(previous)
    await storeTutorDocument(
      'alice',
      new File(['Learning materials'], 'notes.md')
    )
    expect(mocks.create.mock.calls[0][1].objectKey).toBe(previous.objectKey)
    expect(await readdir(path.join(temporaryRoot, '.incoming'))).toEqual([])
  })

  it.each(['pdf', 'txt', 'md', 'docx'])(
    'reads owned %s keys with size and digest integrity checks',
    async extension => {
      const bytes = new TextEncoder().encode('original bytes')
      const document = stored(bytes, extension)
      mocks.get.mockResolvedValue(document)
      const target = localTutorPath(document.objectKey)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes)
      mocks.limits.maxFileSize = 1
      expect(await readTutorDocument('alice', 'doc-a')).toEqual(bytes)
      await expect(readTutorDocument('bob', 'doc-a')).rejects.toThrow(
        'storage reference'
      )
      await writeFile(target, new Uint8Array(bytes.length))
      await expect(readTutorDocument('alice', 'doc-a')).rejects.toThrow(
        'integrity'
      )
      await writeFile(target, new Uint8Array(1))
      await expect(readTutorDocument('alice', 'doc-a')).rejects.toThrow(
        'integrity'
      )
    }
  )

  it('bounds object reads even when ContentLength is absent or lies', async () => {
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'r2')
    const bytes = new TextEncoder().encode('original')
    mocks.get.mockResolvedValue(stored(bytes))
    for (const input of [stream('original', 'extra'), stream('short')]) {
      mocks.send.mockResolvedValue({
        Body: { transformToWebStream: () => input }
      })
      await expect(readTutorDocument('alice', 'doc-a')).rejects.toThrow(
        'integrity'
      )
    }
    mocks.send.mockResolvedValue({
      ContentLength: bytes.length + 1,
      Body: { transformToWebStream: () => stream('original') }
    })
    await expect(readTutorDocument('alice', 'doc-a')).rejects.toThrow(
      'integrity'
    )
    mocks.send.mockResolvedValue({
      ContentLength: bytes.length,
      Body: { transformToWebStream: () => stream('original') }
    })
    expect(await readTutorDocument('alice', 'doc-a')).toEqual(bytes)
  })
})
