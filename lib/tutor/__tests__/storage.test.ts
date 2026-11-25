import { createHash } from 'node:crypto'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  get: vi.fn(),
  write: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
  configured: vi.fn()
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
vi.mock('../config', () => ({ TUTOR_LIMITS: { maxFileSize: 5 * 1024 * 1024 } }))
vi.mock('node:fs/promises', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(),
  writeFile: mocks.write,
  readFile: mocks.read
}))
vi.mock('@/lib/storage/r2-client', () => ({
  getR2Client: () => ({ send: mocks.send }),
  isObjectStorageConfigured: mocks.configured,
  R2_BUCKET_NAME: 'test-bucket'
}))
import {
  localTutorPath,
  readTutorDocument,
  storeTutorDocument,
  validateTutorDocument,
  validateTutorPdf
} from '../storage'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('DATABASE_URL', 'postgres://test')
  vi.stubEnv('TUTOR_STORAGE_DRIVER', 'local')
  mocks.create.mockImplementation(async (_user, document) => document)
})
afterEach(() => vi.unstubAllEnvs())

describe('Tutor PDF storage', () => {
  it('checks the actual bytes rather than trusting the filename', () => {
    const bytes = new TextEncoder().encode('this is not a PDF')
    expect(() =>
      validateTutorPdf({ size: bytes.length, name: 'fake.pdf' }, bytes)
    ).toThrow('Only PDF files')
  })
  it('accepts a PDF signature, but rejects oversized content', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n')
    expect(() =>
      validateTutorPdf({ size: bytes.length, name: 'notes.pdf' }, bytes)
    ).not.toThrow()
    expect(() =>
      validateTutorPdf({ size: 6 * 1024 * 1024, name: 'notes.pdf' }, bytes)
    ).toThrow('5 MB')
  })
  it('only resolves server-generated object keys beneath the configured directory', () => {
    vi.stubEnv('TUTOR_LOCAL_STORAGE_DIR', path.resolve('test-storage'))
    const key = `tutor/${'a'.repeat(32)}/${'b'.repeat(64)}.pdf`
    expect(localTutorPath(key)).toBe(
      path.resolve('test-storage', ...key.split('/'))
    )
    for (const malicious of [
      '../secret',
      'tutor/../../secret',
      'C:\\secret',
      '/etc/passwd',
      'tutor/u/file.pdf'
    ])
      expect(() => localTutorPath(malicious)).toThrow()
    vi.unstubAllEnvs()
  })

  it.each(['txt', 'md', 'markdown'])(
    'stores %s with a canonical extension and no model configuration gate',
    async extension => {
      const file = new File(
        ['# Transactions\nAll changes commit together.'],
        `notes.${extension}`,
        { type: 'application/octet-stream' }
      )
      const document = await storeTutorDocument('alice', file)
      expect(document).toMatchObject({ filename: file.name })
      expect(mocks.write).toHaveBeenCalledOnce()
      expect(mocks.create.mock.calls[0][1].objectKey).toMatch(
        new RegExp(`\\.${extension === 'markdown' ? 'md' : extension}$`)
      )
    }
  )

  it('validates content and format before touching storage or the database', async () => {
    for (const file of [
      new File(['text'], 'notes.exe'),
      new File(['PK\0binary'], 'notes.md'),
      new File([''], 'empty.txt')
    ]) {
      await expect(storeTutorDocument('alice', file)).rejects.toThrow()
    }
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
    await expect(
      validateTutorDocument({ name: 'notes.txt', size: 1 }, new Uint8Array(2))
    ).rejects.toMatchObject({ code: 'INVALID_FILE_SIZE' })
  })

  it('reports missing required services before calling the repository', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('DATABASE_RESTRICTED_URL', '')
    await expect(
      storeTutorDocument('alice', new File(['some text'], 'notes.txt'))
    ).rejects.toMatchObject({ code: 'TUTOR_NOT_CONFIGURED', status: 503 })
    expect(mocks.find).not.toHaveBeenCalled()
    vi.stubEnv('DATABASE_URL', 'postgres://test')
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'r2')
    await expect(
      storeTutorDocument('alice', new File(['some text'], 'notes.txt'))
    ).rejects.toMatchObject({ code: 'TUTOR_NOT_CONFIGURED', status: 503 })
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('stores an object with its real MIME type', async () => {
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'r2')
    mocks.configured.mockReturnValue(true)
    await storeTutorDocument(
      'alice',
      new File(['# Topic\nContent'], 'notes.md')
    )
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      ContentType: 'text/markdown',
      Key: expect.stringMatching(/\.md$/)
    })
  })

  it('reuses the actual previous storage key for the same text under another extension', async () => {
    const text = 'Learning materials'
    const hash = createHash('sha256').update(text).digest('hex')
    const owner = createHash('sha256')
      .update('alice')
      .digest('hex')
      .slice(0, 32)
    const previous = { objectKey: `tutor/${owner}/${hash}.txt` }
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce(previous)
    await storeTutorDocument('alice', new File([text], 'notes.md'))
    expect(mocks.create.mock.calls[0][1].objectKey).toBe(previous.objectKey)
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it.each(['pdf', 'txt', 'md', 'docx'])(
    'reads owned %s keys and verifies integrity',
    async extension => {
      const bytes = new TextEncoder().encode('original bytes')
      const hash = createHash('sha256').update(bytes).digest('hex')
      const owner = createHash('sha256')
        .update('alice')
        .digest('hex')
        .slice(0, 32)
      mocks.get.mockResolvedValue({
        objectKey: `tutor/${owner}/${hash}.${extension}`,
        contentHash: hash
      })
      mocks.read.mockResolvedValue(bytes)
      expect(await readTutorDocument('alice', 'doc-a')).toEqual(bytes)
      mocks.read.mockResolvedValue(new Uint8Array([1, 2, 3]))
      await expect(readTutorDocument('alice', 'doc-a')).rejects.toThrow(
        'integrity'
      )
      await expect(readTutorDocument('bob', 'doc-a')).rejects.toThrow(
        'storage reference'
      )
    }
  )
})
// @vitest-environment node
