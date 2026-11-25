// @vitest-environment node
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CHUNKING_VERSION } from '../chunking'
import { getEmbeddingIndexKey } from '../embeddings'
import type { TutorAssessment, TutorChunk } from '../types'

const connection = process.env.TUTOR_TEST_DATABASE_URL
const suite = connection ? describe : describe.skip

suite('Tutor PostgreSQL ownership, retrieval and idempotency', () => {
  let admin: ReturnType<typeof postgres>
  let restricted: ReturnType<typeof postgres>
  let repository: typeof import('../repository')
  const ownerA = `tutor-test-a-${randomUUID()}`
  const ownerB = `tutor-test-b-${randomUUID()}`
  const documentA = randomUUID()
  const documentB = randomUUID()
  const chunkA = randomUUID()
  const chunkB = randomUUID()
  const chapterId = randomUUID()
  const questionId = randomUUID()
  let courseA: string
  let courseB: string
  const vector = [1, ...Array.from({ length: 1535 }, () => 0)]

  beforeAll(async () => {
    // This test deliberately requires an explicit, isolated test database.
    const url = new URL(connection!)
    if (!url.pathname.includes('tutor_test'))
      throw new Error('Use an isolated tutor_test database')
    admin = postgres(connection!, { ssl: false, max: 1 })
    await admin.unsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tutor_test_app_user') THEN CREATE ROLE tutor_test_app_user LOGIN PASSWORD 'tutor_test_restricted'; END IF; END $$`
    )
    await admin.unsafe('GRANT USAGE ON SCHEMA public TO tutor_test_app_user')
    await admin.unsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON tutor_documents, tutor_courses, tutor_course_documents, tutor_chunks, tutor_chapters, tutor_attempts TO tutor_test_app_user'
    )
    url.username = 'tutor_test_app_user'
    url.password = 'tutor_test_restricted'
    process.env.DATABASE_URL = connection
    process.env.DATABASE_RESTRICTED_URL = url.toString()
    process.env.DATABASE_SSL_DISABLED = 'true'
    restricted = postgres(url.toString(), { ssl: false, max: 1 })
    repository = await import('../repository')
    for (const [id, userId] of [
      [documentA, ownerA],
      [documentB, ownerB]
    ]) {
      await repository.createDocument(userId, {
        id,
        filename: 'same-name.pdf',
        size: 100,
        objectKey: `test/${id}`,
        contentHash: id
      })
    }
    const a = await repository.createCourse(ownerA, {
      documentIds: [documentA],
      goal: '学习数据库索引',
      level: 'beginner',
      locale: 'zh-CN'
    })
    const b = await repository.createCourse(ownerB, {
      documentIds: [documentB],
      goal: 'Learn indexing',
      level: 'beginner',
      locale: 'en'
    })
    courseA = a.id
    courseB = b.id
    const chunk = (id: string, documentId: string): TutorChunk => ({
      id,
      documentId,
      parentId: `parent-${documentId}`,
      position: 0,
      text: '数据库索引加快查询。',
      parentText: '数据库索引加快查询。',
      retrievalText: '数据库 索引 查询',
      lexicalText: '数据库 索引 查询',
      heading: '索引',
      regions: [{ page: 1, x: 0.1, y: 0.1, width: 0.4, height: 0.1 }],
      tokenCount: 20,
      embedding: vector
    })
    await repository.saveDocumentChunks(ownerA, documentA, {
      chunks: [chunk(chunkA, documentA)],
      pageCount: 1,
      embeddingModel: getEmbeddingIndexKey(),
      parseVersion: CHUNKING_VERSION
    })
    await repository.saveDocumentChunks(ownerB, documentB, {
      chunks: [chunk(chunkB, documentB)],
      pageCount: 1,
      embeddingModel: getEmbeddingIndexKey(),
      parseVersion: CHUNKING_VERSION
    })
    await repository.saveCoursePlan(ownerA, courseA, {
      title: '索引课程',
      chapters: [
        {
          id: chapterId,
          position: 0,
          title: '索引',
          summary: '索引原理',
          objectives: ['解释索引'],
          knowledgePoints: [{ id: 'kp-a', title: '索引', sourceIds: [chunkA] }]
        }
      ]
    })
    await repository.updateChapter(ownerA, courseA, chapterId, {
      status: 'ready',
      questions: [
        {
          id: questionId,
          knowledgePointId: 'kp-a',
          kind: 'concept',
          prompt: '为什么使用索引？',
          referenceAnswer: 'PRIVATE ANSWER',
          rubric: [{ id: 'r1', criterion: '正确解释', maxScore: 100 }],
          sourceIds: [chunkA],
          version: 'question-v1'
        }
      ]
    })
  }, 30_000)

  afterAll(async () => {
    if (admin) {
      await admin`delete from tutor_courses where user_id in (${ownerA}, ${ownerB})`
      await admin`delete from tutor_documents where user_id in (${ownerA}, ${ownerB})`
      await admin.end()
    }
    if (restricted) await restricted.end()
  })

  it('enforces RLS using an actual non-owner SQL role', async () => {
    const role =
      await restricted`select rolsuper from pg_roles where rolname=current_user`
    expect(role[0].rolsuper).toBe(false)
    const rows = await restricted`select id from tutor_documents`
    expect(rows).toHaveLength(0)
  })

  it('does not expose courses, documents or chunks from another user', async () => {
    expect(await repository.getCourse(ownerA, courseB)).toBeNull()
    expect(await repository.getDocument(ownerA, documentB)).toBeNull()
    expect(await repository.getChunksByIds(ownerA, courseA, [chunkB])).toEqual(
      []
    )
    await expect(
      repository.createCourse(ownerA, {
        documentIds: [documentB],
        goal: 'steal',
        level: 'beginner',
        locale: 'en'
      })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('performs pgvector similarity search inside the authorized course', async () => {
    const results = await repository.searchVectorChunks(
      ownerA,
      courseA,
      vector,
      20
    )
    expect(results.map(result => result.id)).toEqual([chunkA])
    expect(results[0].score).toBeCloseTo(1)
    expect(
      await repository.searchVectorChunks(ownerA, courseB, vector, 20)
    ).toEqual([])
  })

  it('retrieves segmented Chinese words with OR semantics', async () => {
    const results = await repository.searchLexicalChunks(
      ownerA,
      courseA,
      '不存在 查询',
      20
    )
    expect(results.map(result => result.id)).toEqual([chunkA])
    expect(
      await repository.searchLexicalChunks(ownerA, courseA, '', 20)
    ).toEqual([])
  })

  it('makes repeated submissions idempotent and rejects conflicting payloads', async () => {
    const assessment: TutorAssessment = {
      id: randomUUID(),
      questionId,
      knowledgePointId: 'kp-a',
      answer: '加快查询',
      score: 80,
      feedback: '正确',
      strengths: [],
      improvements: [],
      criteria: [
        { criterion: '正确解释', score: 80, maxScore: 100, reason: 'Good' }
      ],
      sourceIds: [chunkA],
      createdAt: new Date().toISOString()
    }
    const first = await repository.recordAssessment(
      ownerA,
      courseA,
      chapterId,
      assessment
    )
    const second = await repository.recordAssessment(
      ownerA,
      courseA,
      chapterId,
      assessment
    )
    expect(second).toEqual(first)
    await expect(
      repository.recordAssessment(ownerA, courseA, chapterId, {
        ...assessment,
        answer: 'different'
      })
    ).rejects.toMatchObject({ status: 409 })
    const chapter = await repository.getChapter(ownerA, courseA, chapterId)
    expect(chapter?.latestAttempts).toHaveLength(1)
    expect(chapter?.mastery).toBe(80)
    expect(JSON.stringify(chapter)).not.toContain('PRIVATE ANSWER')
  })

  it('protects indexed source versions and rejects changed embeddings', async () => {
    await expect(
      repository.saveDocumentChunks(ownerA, documentA, {
        chunks: [],
        pageCount: 1,
        embeddingModel: 'other-model',
        parseVersion: 'test-v1'
      })
    ).rejects.toMatchObject({ code: 'INDEX_VERSION_MISMATCH' })
  })

  it('deduplicates the same index and creates an immutable new document when index settings change', async () => {
    const original = await repository.getDocument(ownerA, documentA)
    const values = {
      id: randomUUID(),
      filename: 'same-name.pdf',
      size: 100,
      objectKey: original!.objectKey,
      contentHash: original!.contentHash
    }
    const duplicate = await repository.createDocument(ownerA, values)
    expect(duplicate.id).toBe(documentA)
    expect(
      (await repository.findDocumentByHash(ownerA, original!.contentHash))?.id
    ).toBe(documentA)
    vi.stubEnv('TUTOR_EMBEDDING_REVISION', `revision-${randomUUID()}`)
    try {
      expect(
        await repository.findDocumentByHash(ownerA, original!.contentHash)
      ).toBeNull()
      const replacement = await repository.createDocument(ownerA, values)
      expect(replacement.id).not.toBe(documentA)
      expect(replacement.indexKey).not.toBe(original!.indexKey)
      expect(replacement.objectKey).toBe(original!.objectKey)
      expect(replacement.status).toBe('uploaded')
      expect(
        (await repository.findDocumentByHash(ownerA, original!.contentHash))?.id
      ).toBe(replacement.id)
      expect(
        (
          await repository.createDocument(ownerA, {
            ...values,
            id: randomUUID()
          })
        ).id
      ).toBe(replacement.id)
      const newCourse = await repository.createCourse(ownerA, {
        documentIds: [replacement.id],
        goal: 'New version',
        level: 'beginner',
        locale: 'en'
      })
      expect(newCourse.documents.map(document => document.id)).toEqual([
        replacement.id
      ])
      await repository.updateCourse(ownerA, newCourse.id, {
        status: 'failed',
        stage: 'failed'
      })
      const oldCourse = await repository.getCourse(ownerA, courseA)
      expect(oldCourse?.documents.map(document => document.id)).toEqual([
        documentA
      ])
      expect((await repository.getDocument(ownerA, documentA))?.indexKey).toBe(
        original!.indexKey
      )
      expect((await repository.getDocument(ownerA, documentA))?.status).toBe(
        'ready'
      )
      expect(
        (await repository.getChunksByIds(ownerA, courseA, [chunkA])).map(
          chunk => chunk.id
        )
      ).toEqual([chunkA])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('keeps identical TXT and Markdown bytes in separate indexes and deduplicates Markdown aliases', async () => {
    const contentHash = randomUUID()
    const values = {
      size: 100,
      objectKey: `test/${contentHash}`,
      contentHash
    }
    const textDocument = await repository.createDocument(ownerA, {
      ...values,
      id: randomUUID(),
      filename: 'notes.txt'
    })
    const markdownDocument = await repository.createDocument(ownerA, {
      ...values,
      id: randomUUID(),
      filename: 'notes.md'
    })
    const duplicateMarkdown = await repository.createDocument(ownerA, {
      ...values,
      id: randomUUID(),
      filename: 'notes.markdown'
    })
    expect(markdownDocument.id).not.toBe(textDocument.id)
    expect(duplicateMarkdown.id).toBe(markdownDocument.id)
    for (const document of [textDocument, markdownDocument]) {
      expect(
        (
          await repository.findDocumentByHash(
            ownerA,
            contentHash,
            repository.getDocumentIndexKey(document.filename)
          )
        )?.id
      ).toBe(document.id)
      await repository.saveDocumentChunks(ownerA, document.id, {
        chunks: [
          {
            id: randomUUID(),
            documentId: document.id,
            parentId: randomUUID(),
            position: 0,
            text: '# 数据库索引\n索引加快查询。',
            parentText: '# 数据库索引\n索引加快查询。',
            retrievalText: '数据库 索引 查询',
            lexicalText: '数据库 索引 查询',
            heading:
              document.filename === 'notes.md'
                ? '# 数据库索引'
                : document.filename,
            regions: [{ page: 1, x: 0, y: 0, width: 1, height: 1 }],
            tokenCount: 20,
            embedding: vector
          }
        ],
        pageCount: 1,
        embeddingModel: getEmbeddingIndexKey(),
        parseVersion: CHUNKING_VERSION
      })
      expect((await repository.getDocument(ownerA, document.id))?.status).toBe(
        'ready'
      )
    }
  })

  it('does not let late worker failures or stale requests downgrade published data', async () => {
    const original = await repository.getStoredChapter(
      ownerA,
      courseA,
      chapterId
    )
    await Promise.all([
      repository.updateDocument(ownerA, documentA, {
        status: 'failed',
        error: 'Late parse failure'
      }),
      repository.updateCourse(ownerA, courseA, {
        status: 'failed',
        stage: 'failed',
        error: 'Late planning failure'
      }),
      repository.updateChapter(ownerA, courseA, chapterId, {
        status: 'generating',
        error: null
      }),
      repository.updateChapter(ownerA, courseA, chapterId, {
        status: 'failed',
        error: 'Late generation failure'
      })
    ])
    expect((await repository.getDocument(ownerA, documentA))?.status).toBe(
      'ready'
    )
    expect((await repository.getStoredCourse(ownerA, courseA))?.status).toBe(
      'ready'
    )
    const after = await repository.getStoredChapter(ownerA, courseA, chapterId)
    expect(after?.status).toBe('ready')
    expect(after?.questions).toEqual(original?.questions)
    expect(after?.error).toBeNull()
    expect(
      await repository.searchVectorChunks(ownerA, courseA, vector, 20)
    ).toHaveLength(1)
  })

  it('serializes concurrent course admission and applies the same quota to retries', async () => {
    const retryTarget = await repository.createCourse(ownerA, {
      documentIds: [documentA],
      goal: 'Retry target',
      level: 'beginner',
      locale: 'en'
    })
    await repository.updateCourse(ownerA, retryTarget.id, {
      status: 'failed',
      stage: 'failed'
    })
    const outcomes = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        repository.createCourse(ownerA, {
          documentIds: [documentA],
          goal: 'Concurrent route',
          level: 'beginner',
          locale: 'en'
        })
      )
    )
    const fulfilled = outcomes.filter(outcome => outcome.status === 'fulfilled')
    const rejected = outcomes.filter(outcome => outcome.status === 'rejected')
    expect(fulfilled).toHaveLength(3)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({
      status: 429,
      code: 'ACTIVE_COURSE_LIMIT'
    })
    await expect(
      repository.prepareCourseRetry(ownerA, retryTarget.id)
    ).rejects.toMatchObject({ status: 429 })
    // A duplicate retry of an admitted job consumes no extra slot.
    const active = fulfilled[0].value
    expect(
      (await repository.prepareCourseRetry(ownerA, active.id)).status
    ).toBe('queued')
    await repository.updateCourse(ownerA, active.id, {
      status: 'failed',
      stage: 'failed'
    })
    expect(
      (await repository.prepareCourseRetry(ownerA, retryTarget.id)).status
    ).toBe('queued')
  })
})
