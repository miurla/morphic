import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
  type StoredChapter,
  type StoredCourse,
  tutorAttempts,
  tutorChapters,
  tutorChunks,
  tutorCourseDocuments,
  tutorCourses,
  tutorDocuments
} from '@/lib/db/tutor-schema'
import { type TxInstance, withRLS } from '@/lib/db/with-rls'

import { CHUNKING_VERSION } from './chunking'
import { buildDocumentIndexKey } from './document-index'
import { getEmbeddingConfig, getEmbeddingIndexKey } from './embeddings'
import { calculateChapterMastery } from './mastery'
import type {
  CreateTutorCourseInput,
  RetrievedChunk,
  TutorAssessment,
  TutorChapter,
  TutorChunk,
  TutorCourse,
  TutorCourseSummary,
  TutorDocument
} from './types'

export class TutorRepositoryError extends Error {
  constructor(
    message: string,
    public code = 'NOT_FOUND',
    public status = 404
  ) {
    super(message)
  }
}

const owned = (userId: string, courseId: string) =>
  and(eq(tutorCourses.userId, userId), eq(tutorCourses.id, courseId))
const ownedChapter = (userId: string, courseId: string, chapterId: string) =>
  and(
    eq(tutorChapters.userId, userId),
    eq(tutorChapters.courseId, courseId),
    eq(tutorChapters.id, chapterId)
  )
const missing = () =>
  new TutorRepositoryError('The requested learning resource was not found.')
export const publicDocument = (
  document: typeof tutorDocuments.$inferSelect
): TutorDocument => ({
  id: document.id,
  filename: document.filename,
  warnings: document.warnings,
  size: document.size,
  status: document.status,
  pageCount: document.pageCount,
  error: document.error
})
const summary = (course: StoredCourse): TutorCourseSummary => ({
  id: course.id,
  title: course.title,
  goal: course.goal,
  level: course.level,
  locale: course.locale,
  status: course.status,
  stage: course.stage,
  processingProgress: course.processingProgress,
  error: course.error,
  createdAt: course.createdAt.toISOString(),
  updatedAt: course.updatedAt.toISOString()
})

export function publicChapter(
  chapter: StoredChapter,
  attempts: TutorAssessment[]
): TutorChapter {
  const latest = new Map<string, TutorAssessment>()
  for (const attempt of [...attempts].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  )) {
    if (!latest.has(attempt.questionId)) latest.set(attempt.questionId, attempt)
  }
  return {
    id: chapter.id,
    position: chapter.position,
    title: chapter.title,
    summary: chapter.summary,
    objectives: chapter.objectives,
    knowledgePoints: chapter.knowledgePoints,
    status: chapter.status,
    error: chapter.error,
    content: chapter.content,
    questions: chapter.questions.map(
      ({ id, knowledgePointId, kind, prompt }) => ({
        id,
        knowledgePointId,
        kind,
        prompt
      })
    ),
    latestAttempts: [...latest.values()],
    mastery: calculateChapterMastery(
      chapter.knowledgePoints,
      attempts,
      chapter.questions
    )
  }
}

export async function listCourses(userId: string) {
  return withRLS(userId, async tx =>
    (
      await tx
        .select()
        .from(tutorCourses)
        .where(eq(tutorCourses.userId, userId))
        .orderBy(desc(tutorCourses.updatedAt))
        .limit(100)
    ).map(summary)
  )
}

export async function getStoredCourse(userId: string, courseId: string) {
  return withRLS(
    userId,
    async tx =>
      (
        await tx
          .select()
          .from(tutorCourses)
          .where(owned(userId, courseId))
          .limit(1)
      )[0] ?? null
  )
}

export async function getStoredChapter(
  userId: string,
  courseId: string,
  chapterId: string
) {
  return withRLS(
    userId,
    async tx =>
      (
        await tx
          .select()
          .from(tutorChapters)
          .where(ownedChapter(userId, courseId, chapterId))
          .limit(1)
      )[0] ?? null
  )
}

export async function getDocument(userId: string, documentId: string) {
  return withRLS(
    userId,
    async tx =>
      (
        await tx
          .select()
          .from(tutorDocuments)
          .where(
            and(
              eq(tutorDocuments.userId, userId),
              eq(tutorDocuments.id, documentId)
            )
          )
          .limit(1)
      )[0] ?? null
  )
}

export function getDocumentIndexKey(filename?: string) {
  return buildDocumentIndexKey(
    CHUNKING_VERSION,
    getEmbeddingIndexKey(),
    filename
  )
}

/** Null is an internal-only lookup for reusing immutable raw bytes across indexes. */
export async function findDocumentByHash(
  userId: string,
  contentHash: string,
  indexKey: string | null = getDocumentIndexKey()
) {
  return withRLS(
    userId,
    async tx =>
      (
        await tx
          .select()
          .from(tutorDocuments)
          .where(
            and(
              eq(tutorDocuments.userId, userId),
              eq(tutorDocuments.contentHash, contentHash),
              indexKey === null
                ? undefined
                : eq(tutorDocuments.indexKey, indexKey)
            )
          )
          .limit(1)
      )[0] ?? null
  )
}

export async function createDocument(
  userId: string,
  values: Pick<
    typeof tutorDocuments.$inferInsert,
    'id' | 'filename' | 'size' | 'objectKey' | 'contentHash'
  >
) {
  const indexKey = getDocumentIndexKey(values.filename)
  return withRLS(userId, async tx => {
    const [document] = await tx
      .insert(tutorDocuments)
      .values({ ...values, userId, indexKey })
      .onConflictDoNothing({
        target: [
          tutorDocuments.userId,
          tutorDocuments.contentHash,
          tutorDocuments.indexKey
        ]
      })
      .returning()
    return (
      document ??
      (
        await tx
          .select()
          .from(tutorDocuments)
          .where(
            and(
              eq(tutorDocuments.userId, userId),
              eq(tutorDocuments.contentHash, values.contentHash),
              eq(tutorDocuments.indexKey, indexKey)
            )
          )
          .limit(1)
      )[0]
    )
  })
}

async function documentsInCourse(
  tx: TxInstance,
  userId: string,
  courseId: string
) {
  return tx
    .select({ document: tutorDocuments })
    .from(tutorDocuments)
    .innerJoin(
      tutorCourseDocuments,
      eq(tutorCourseDocuments.documentId, tutorDocuments.id)
    )
    .innerJoin(tutorCourses, eq(tutorCourses.id, tutorCourseDocuments.courseId))
    .where(
      and(
        owned(userId, courseId),
        eq(tutorCourseDocuments.userId, userId),
        eq(tutorDocuments.userId, userId)
      )
    )
    .orderBy(asc(tutorDocuments.createdAt))
}

export async function getCourseDocuments(userId: string, courseId: string) {
  return withRLS(userId, async tx =>
    (await documentsInCourse(tx, userId, courseId)).map(row => row.document)
  )
}

export async function getCourse(
  userId: string,
  courseId: string
): Promise<TutorCourse | null> {
  return withRLS(userId, async tx => {
    const [course] = await tx
      .select()
      .from(tutorCourses)
      .where(owned(userId, courseId))
      .limit(1)
    if (!course) return null
    const documents = await documentsInCourse(tx, userId, courseId)
    const chapters = await tx
      .select()
      .from(tutorChapters)
      .where(
        and(
          eq(tutorChapters.userId, userId),
          eq(tutorChapters.courseId, courseId)
        )
      )
      .orderBy(asc(tutorChapters.position))
    const attempts = chapters.length
      ? await tx
          .select()
          .from(tutorAttempts)
          .where(
            and(
              eq(tutorAttempts.userId, userId),
              inArray(
                tutorAttempts.chapterId,
                chapters.map(c => c.id)
              )
            )
          )
          .orderBy(desc(tutorAttempts.createdAt))
      : []
    return {
      ...summary(course),
      documents: documents.map(row => publicDocument(row.document)),
      chapters: chapters.map(chapter =>
        publicChapter(
          chapter,
          attempts
            .filter(a => a.chapterId === chapter.id)
            .map(a => a.assessment)
        )
      )
    }
  })
}

export async function getChapter(
  userId: string,
  courseId: string,
  chapterId: string
) {
  return withRLS(userId, async tx => {
    const [chapter] = await tx
      .select()
      .from(tutorChapters)
      .where(ownedChapter(userId, courseId, chapterId))
      .limit(1)
    if (!chapter) return null
    const attempts = await tx
      .select()
      .from(tutorAttempts)
      .where(
        and(
          eq(tutorAttempts.userId, userId),
          eq(tutorAttempts.chapterId, chapterId)
        )
      )
      .orderBy(desc(tutorAttempts.createdAt))
    return publicChapter(
      chapter,
      attempts.map(a => a.assessment)
    )
  })
}

export async function createCourse(
  userId: string,
  input: CreateTutorCourseInput
) {
  const id = randomUUID()
  await withRLS(userId, async tx => {
    await lockCourseQuota(tx, userId)
    await checkCourseQuota(tx, userId)
    const ids = [...new Set(input.documentIds)]
    const docs = await tx
      .select()
      .from(tutorDocuments)
      .where(
        and(eq(tutorDocuments.userId, userId), inArray(tutorDocuments.id, ids))
      )
    if (docs.length !== ids.length) throw missing()
    await tx.insert(tutorCourses).values({
      id,
      userId,
      title:
        input.locale === 'zh-CN'
          ? '正在创建学习路线'
          : 'Creating your learning route',
      goal: input.goal,
      level: input.level,
      locale: input.locale
    })
    await tx
      .insert(tutorCourseDocuments)
      .values(ids.map(documentId => ({ userId, courseId: id, documentId })))
  })
  return (await getCourse(userId, id))!
}

async function lockCourseQuota(tx: TxInstance, userId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`tutor-course-quota:${userId}`},0))`
  )
}

async function checkCourseQuota(tx: TxInstance, userId: string) {
  const [result] = await tx
    .select({ count: sql<number>`count(*)::integer` })
    .from(tutorCourses)
    .where(
      and(
        eq(tutorCourses.userId, userId),
        inArray(tutorCourses.status, ['queued', 'processing'])
      )
    )
  if (result.count >= 3)
    throw new TutorRepositoryError(
      'You already have three learning routes in progress. Wait for one to finish.',
      'ACTIVE_COURSE_LIMIT',
      429
    )
}

/** Queue admission is serialized per owner, including retries of failed jobs. */
export async function prepareCourseRetry(userId: string, courseId: string) {
  return withRLS(userId, async tx => {
    await lockCourseQuota(tx, userId)
    const [course] = await tx
      .select()
      .from(tutorCourses)
      .where(owned(userId, courseId))
      .for('update')
    if (!course) throw missing()
    if (course.status !== 'failed') return course
    await checkCourseQuota(tx, userId)
    const [updated] = await tx
      .update(tutorCourses)
      .set({
        status: 'queued',
        stage: 'queued',
        error: null,
        updatedAt: new Date()
      })
      .where(owned(userId, courseId))
      .returning()
    return updated
  })
}

export async function updateCourse(
  userId: string,
  courseId: string,
  values: Partial<
    Pick<
      StoredCourse,
      | 'title'
      | 'status'
      | 'stage'
      | 'processingProgress'
      | 'error'
      | 'planningNotes'
    >
  >
) {
  return withRLS(userId, async tx => {
    const [course] = await tx
      .update(tutorCourses)
      .set({ ...values, updatedAt: new Date() })
      .where(and(owned(userId, courseId), ne(tutorCourses.status, 'ready')))
      .returning()
    if (!course) {
      const [published] = await tx
        .select()
        .from(tutorCourses)
        .where(owned(userId, courseId))
        .limit(1)
      if (published) return published
      throw missing()
    }
    return course
  })
}

export async function updateDocument(
  userId: string,
  documentId: string,
  values: Partial<
    Pick<typeof tutorDocuments.$inferSelect, 'status' | 'error' | 'pageCount'>
  >
) {
  return withRLS(userId, async tx => {
    await tx
      .update(tutorDocuments)
      .set(values)
      .where(
        and(
          eq(tutorDocuments.userId, userId),
          eq(tutorDocuments.id, documentId),
          values.status === 'failed'
            ? ne(tutorDocuments.status, 'ready')
            : undefined
        )
      )
  })
}

export async function saveDocumentChunks(
  userId: string,
  documentId: string,
  input: {
    chunks: TutorChunk[]
    pageCount: number
    embeddingModel: string
    parseVersion: string
    warnings?: string[]
  }
) {
  const dimensions = getEmbeddingConfig().dimensions
  return withRLS(userId, async tx => {
    const [document] = await tx
      .select()
      .from(tutorDocuments)
      .where(
        and(
          eq(tutorDocuments.userId, userId),
          eq(tutorDocuments.id, documentId)
        )
      )
      .for('update')
    if (!document) throw missing()
    if (
      document.indexKey !==
      buildDocumentIndexKey(
        input.parseVersion,
        input.embeddingModel,
        document.filename
      )
    )
      throw new TutorRepositoryError(
        'Upload the document again to create a new course with the current index settings.',
        'INDEX_VERSION_MISMATCH',
        409
      )
    // Indexed documents are immutable. A new parser/model needs a new document version.
    if (document.status === 'ready') {
      if (
        document.embeddingModel !== input.embeddingModel ||
        document.parseVersion !== input.parseVersion
      )
        throw new TutorRepositoryError(
          'The document index uses a different configuration.',
          'INDEX_VERSION_MISMATCH',
          409
        )
      return
    }
    if (
      !input.chunks.length ||
      input.chunks.some(
        c =>
          c.documentId !== documentId ||
          !c.embedding ||
          c.embedding.length !== dimensions ||
          c.embedding.some(n => !Number.isFinite(n))
      )
    )
      throw new TutorRepositoryError(
        'The document index is invalid.',
        'INVALID_INDEX',
        422
      )
    await tx
      .delete(tutorChunks)
      .where(
        and(
          eq(tutorChunks.userId, userId),
          eq(tutorChunks.documentId, documentId)
        )
      )
    for (let offset = 0; offset < input.chunks.length; offset += 40) {
      await tx.insert(tutorChunks).values(
        input.chunks.slice(offset, offset + 40).map(chunk => ({
          ...chunk,
          userId,
          documentId,
          embedding: chunk.embedding!
        }))
      )
    }
    await tx
      .update(tutorDocuments)
      .set({
        status: 'ready',
        error: null,
        pageCount: input.pageCount,
        embeddingModel: input.embeddingModel,
        parseVersion: input.parseVersion,
        warnings: input.warnings ?? []
      })
      .where(
        and(
          eq(tutorDocuments.userId, userId),
          eq(tutorDocuments.id, documentId)
        )
      )
  })
}

export async function saveCoursePlan(
  userId: string,
  courseId: string,
  input: {
    title: string
    chapters: Pick<
      StoredChapter,
      'id' | 'position' | 'title' | 'summary' | 'objectives' | 'knowledgePoints'
    >[]
  }
) {
  return withRLS(userId, async tx => {
    const [course] = await tx
      .select()
      .from(tutorCourses)
      .where(owned(userId, courseId))
      .for('update')
    if (!course) throw missing()
    if (course.status === 'ready') return
    const existing = await tx
      .select({ id: tutorChapters.id })
      .from(tutorChapters)
      .where(
        and(
          eq(tutorChapters.userId, userId),
          eq(tutorChapters.courseId, courseId)
        )
      )
      .limit(1)
    if (!existing.length)
      await tx
        .insert(tutorChapters)
        .values(
          input.chapters.map(chapter => ({ ...chapter, userId, courseId }))
        )
    await tx
      .update(tutorCourses)
      .set({
        title: input.title,
        status: 'ready',
        stage: 'ready',
        processingProgress: 100,
        error: null,
        updatedAt: new Date()
      })
      .where(owned(userId, courseId))
  })
}

export async function updateChapter(
  userId: string,
  courseId: string,
  chapterId: string,
  values: Partial<
    Pick<StoredChapter, 'status' | 'error' | 'content' | 'questions'>
  >
) {
  return withRLS(userId, async tx => {
    const [chapter] = await tx
      .update(tutorChapters)
      .set(values)
      .where(
        and(
          ownedChapter(userId, courseId, chapterId),
          ne(tutorChapters.status, 'ready')
        )
      )
      .returning()
    if (!chapter) {
      const [published] = await tx
        .select()
        .from(tutorChapters)
        .where(ownedChapter(userId, courseId, chapterId))
        .limit(1)
      if (published) return published
      throw missing()
    }
    return chapter
  })
}

export async function getAssessment(userId: string, attemptId: string) {
  return withRLS(
    userId,
    async tx =>
      (
        await tx
          .select()
          .from(tutorAttempts)
          .where(
            and(
              eq(tutorAttempts.userId, userId),
              eq(tutorAttempts.id, attemptId)
            )
          )
          .limit(1)
      )[0]?.assessment ?? null
  )
}

export async function recordAssessment(
  userId: string,
  courseId: string,
  chapterId: string,
  assessment: TutorAssessment
) {
  return withRLS(userId, async tx => {
    const [chapter] = await tx
      .select()
      .from(tutorChapters)
      .where(ownedChapter(userId, courseId, chapterId))
      .for('update')
    if (!chapter) throw missing()
    if (
      chapter.status !== 'ready' ||
      !chapter.questions.some(
        q =>
          q.id === assessment.questionId &&
          q.knowledgePointId === assessment.knowledgePointId
      )
    )
      throw new TutorRepositoryError(
        'This question is not available.',
        'INVALID_QUESTION',
        409
      )
    const [existing] = await tx
      .select()
      .from(tutorAttempts)
      .where(
        and(
          eq(tutorAttempts.userId, userId),
          eq(tutorAttempts.id, assessment.id)
        )
      )
      .limit(1)
    if (existing) {
      if (
        existing.chapterId !== chapterId ||
        existing.questionId !== assessment.questionId ||
        existing.answer !== assessment.answer
      )
        throw new TutorRepositoryError(
          'This submission identifier was already used.',
          'ATTEMPT_CONFLICT',
          409
        )
      return existing.assessment
    }
    if (
      !Number.isFinite(assessment.score) ||
      assessment.score < 0 ||
      assessment.score > 100
    )
      throw new TutorRepositoryError(
        'The assessment is invalid.',
        'INVALID_ASSESSMENT',
        422
      )
    // Commit time, rather than generation start time, defines the latest attempt.
    const stored = { ...assessment, createdAt: new Date().toISOString() }
    const inserted = await tx
      .insert(tutorAttempts)
      .values({
        id: stored.id,
        userId,
        chapterId,
        questionId: stored.questionId,
        answer: stored.answer,
        assessment: stored
      })
      .onConflictDoNothing()
      .returning({ id: tutorAttempts.id })
    if (!inserted.length)
      throw new TutorRepositoryError(
        'This submission identifier was already used.',
        'ATTEMPT_CONFLICT',
        409
      )
    return stored
  })
}

const chunkFields = {
  id: tutorChunks.id,
  documentId: tutorChunks.documentId,
  parentId: tutorChunks.parentId,
  position: tutorChunks.position,
  text: tutorChunks.text,
  parentText: tutorChunks.parentText,
  retrievalText: tutorChunks.retrievalText,
  lexicalText: tutorChunks.lexicalText,
  heading: tutorChunks.heading,
  regions: tutorChunks.regions,
  tokenCount: tutorChunks.tokenCount,
  filename: tutorDocuments.filename
}
function chunkQuery(tx: TxInstance, userId: string, courseId: string) {
  return tx
    .select({ ...chunkFields, score: sql<number>`0` })
    .from(tutorChunks)
    .innerJoin(tutorDocuments, eq(tutorDocuments.id, tutorChunks.documentId))
    .innerJoin(
      tutorCourseDocuments,
      eq(tutorCourseDocuments.documentId, tutorChunks.documentId)
    )
    .innerJoin(tutorCourses, eq(tutorCourses.id, tutorCourseDocuments.courseId))
    .where(chunkScope(userId, courseId))
}
const chunkScope = (userId: string, courseId: string) =>
  and(
    owned(userId, courseId),
    eq(tutorChunks.userId, userId),
    eq(tutorDocuments.userId, userId),
    eq(tutorCourseDocuments.userId, userId),
    eq(tutorDocuments.status, 'ready')
  )

export async function getAllCourseChunks(
  userId: string,
  courseId: string
): Promise<RetrievedChunk[]> {
  return withRLS(userId, async tx =>
    chunkQuery(tx, userId, courseId).orderBy(
      asc(tutorChunks.documentId),
      asc(tutorChunks.position)
    )
  )
}

export async function getChunksByIds(
  userId: string,
  courseId: string,
  ids: string[]
): Promise<RetrievedChunk[]> {
  if (!ids.length) return []
  return withRLS(userId, async tx =>
    tx
      .select({ ...chunkFields, score: sql<number>`0` })
      .from(tutorChunks)
      .innerJoin(tutorDocuments, eq(tutorDocuments.id, tutorChunks.documentId))
      .innerJoin(
        tutorCourseDocuments,
        eq(tutorCourseDocuments.documentId, tutorChunks.documentId)
      )
      .innerJoin(
        tutorCourses,
        eq(tutorCourses.id, tutorCourseDocuments.courseId)
      )
      .where(and(chunkScope(userId, courseId), inArray(tutorChunks.id, ids)))
  )
}

export async function getChunksByParentIds(
  userId: string,
  courseId: string,
  parentIds: string[]
): Promise<RetrievedChunk[]> {
  if (!parentIds.length) return []
  return withRLS(userId, async tx =>
    tx
      .select({ ...chunkFields, score: sql<number>`0` })
      .from(tutorChunks)
      .innerJoin(tutorDocuments, eq(tutorDocuments.id, tutorChunks.documentId))
      .innerJoin(
        tutorCourseDocuments,
        eq(tutorCourseDocuments.documentId, tutorChunks.documentId)
      )
      .innerJoin(
        tutorCourses,
        eq(tutorCourses.id, tutorCourseDocuments.courseId)
      )
      .where(
        and(
          chunkScope(userId, courseId),
          inArray(tutorChunks.parentId, parentIds)
        )
      )
      .orderBy(asc(tutorChunks.documentId), asc(tutorChunks.position))
  )
}

export async function searchVectorChunks(
  userId: string,
  courseId: string,
  embedding: number[],
  limit: number
): Promise<RetrievedChunk[]> {
  const dimensions = getEmbeddingConfig().dimensions
  if (
    embedding.length !== dimensions ||
    embedding.some(n => !Number.isFinite(n))
  )
    throw new Error('Invalid query embedding')
  const vector = JSON.stringify(embedding)
  const compatibleIndex = and(
    eq(tutorDocuments.embeddingModel, getEmbeddingIndexKey()),
    sql`vector_dims(${tutorChunks.embedding}) = ${dimensions}`
  )!
  // CASE also protects the distance operator if a query plan evaluates it
  // before filtering rows from another immutable vector space.
  const distance = sql<number>`case when ${compatibleIndex} then ${tutorChunks.embedding} <=> ${vector}::vector else null end`
  return withRLS(userId, async tx =>
    tx
      .select({ ...chunkFields, score: sql<number>`1 - (${distance})` })
      .from(tutorChunks)
      .innerJoin(tutorDocuments, eq(tutorDocuments.id, tutorChunks.documentId))
      .innerJoin(
        tutorCourseDocuments,
        eq(tutorCourseDocuments.documentId, tutorChunks.documentId)
      )
      .innerJoin(
        tutorCourses,
        eq(tutorCourses.id, tutorCourseDocuments.courseId)
      )
      .where(and(chunkScope(userId, courseId), compatibleIndex))
      .orderBy(distance, asc(tutorChunks.id))
      .limit(Math.max(1, Math.min(limit, 100)))
  )
}

export async function searchLexicalChunks(
  userId: string,
  courseId: string,
  lexicalQuery: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const terms = [...new Set(lexicalQuery.split(/\s+/).filter(Boolean))].slice(
    0,
    64
  )
  if (!terms.length) return []
  const query = terms
    .map(term => '"' + term.replaceAll('"', ' ') + '"')
    .join(' OR ')
  const vector = sql`to_tsvector('simple',${tutorChunks.lexicalText})`
  const tsquery = sql`websearch_to_tsquery('simple',${query})`
  const score = sql<number>`ts_rank_cd(${vector},${tsquery})`
  return withRLS(userId, async tx =>
    tx
      .select({ ...chunkFields, score })
      .from(tutorChunks)
      .innerJoin(tutorDocuments, eq(tutorDocuments.id, tutorChunks.documentId))
      .innerJoin(
        tutorCourseDocuments,
        eq(tutorCourseDocuments.documentId, tutorChunks.documentId)
      )
      .innerJoin(
        tutorCourses,
        eq(tutorCourses.id, tutorCourseDocuments.courseId)
      )
      .where(and(chunkScope(userId, courseId), sql`${vector} @@ ${tsquery}`))
      .orderBy(desc(score), asc(tutorChunks.id))
      .limit(Math.max(1, Math.min(limit, 100)))
  )
}
