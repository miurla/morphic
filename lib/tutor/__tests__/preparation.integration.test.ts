// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const connection = process.env.TUTOR_TEST_DATABASE_URL
const suite = connection ? describe : describe.skip

suite('Tutor storage and real parser process integration', () => {
  const userId = `tutor-preparation-test-${randomUUID()}`
  let directory: string
  let admin: ReturnType<typeof postgres>
  let repository: typeof import('../repository')
  let storage: typeof import('../storage')
  let preparation: typeof import('../preparation')

  beforeAll(async () => {
    if (!new URL(connection!).pathname.includes('tutor_test'))
      throw new Error('Use an isolated tutor_test database')
    directory = await mkdtemp(path.join(tmpdir(), 'tutor-preparation-test-'))
    vi.stubEnv('DATABASE_URL', connection!)
    vi.stubEnv('DATABASE_RESTRICTED_URL', connection!)
    vi.stubEnv('DATABASE_SSL_DISABLED', 'true')
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'local')
    vi.stubEnv('TUTOR_LOCAL_STORAGE_DIR', directory)
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'http://127.0.0.1:9/v1')
    vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'test-model')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1536')
    admin = postgres(connection!, { ssl: false, max: 1 })
    repository = await import('../repository')
    storage = await import('../storage')
    preparation = await import('../preparation')
  })

  afterAll(async () => {
    if (admin) {
      await admin`delete from tutor_courses where user_id = ${userId}`
      await admin`delete from tutor_documents where user_id = ${userId}`
      await admin.end()
    }
    if (directory) {
      const resolved = path.resolve(directory)
      if (
        path.dirname(resolved) !== path.resolve(tmpdir()) ||
        !path.basename(resolved).startsWith('tutor-preparation-test-')
      )
        throw new Error('Unexpected test cleanup path')
      await rm(resolved, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
  })

  it('streams, prepares in the real child process, reuses the cache and admits a course', async () => {
    const file = new File(
      [
        '# Transactions\n\nAtomicity ensures related changes either all succeed or all fail.\n\nIsolation separates concurrent transactions.'
      ],
      'transactions.md'
    )
    const uploaded = await storage.storeTutorDocument(userId, file)
    expect(uploaded.status).toBe('uploaded')
    const prepared = await preparation.prepareDocument(userId, uploaded.id)
    expect(prepared?.parsed.blocks.length).toBeGreaterThan(0)
    expect(prepared?.tokenCount).toBeGreaterThan(0)
    const document = await repository.getDocument(userId, uploaded.id)
    expect(document?.status).toBe('parsed')
    // A cache hit must not reopen the original or invoke an external AI service.
    await unlink(storage.localTutorPath(document!.objectKey))
    const cached = await preparation.prepareDocument(userId, uploaded.id)
    expect(JSON.parse(JSON.stringify(cached))).toEqual(
      JSON.parse(JSON.stringify(prepared))
    )
    const course = await repository.createCourse(userId, {
      documentIds: [uploaded.id],
      goal: 'Understand transactions',
      level: 'beginner',
      locale: 'en'
    })
    expect(course.documents).toHaveLength(1)
    expect(course.documents[0].tokenCount).toBe(prepared?.tokenCount)
    expect(course.status).toBe('queued')
  }, 30_000)

  it('marks malformed text failed in the background without admitting a course', async () => {
    // Reception checks inspect a prefix; the real parser must reject later binary data.
    const uploaded = await storage.storeTutorDocument(
      userId,
      new File(['Readable text '.repeat(200), new Uint8Array([0])], 'bad.txt')
    )
    expect(uploaded.status).toBe('uploaded')
    await expect(
      preparation.prepareDocument(userId, uploaded.id)
    ).rejects.toMatchObject({ code: 'INVALID_TEXT' })
    expect((await repository.getDocument(userId, uploaded.id))?.status).toBe(
      'failed'
    )
    await expect(
      repository.createCourse(userId, {
        documentIds: [uploaded.id],
        goal: 'Learn',
        level: 'beginner',
        locale: 'en'
      })
    ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_PREPARED' })
  }, 30_000)
})
