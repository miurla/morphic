import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector
} from 'drizzle-orm/pg-core'

import type { Locale } from '@/lib/i18n/config'
import type {
  ChapterContent,
  ChapterStatus,
  CourseStatus,
  KnowledgePoint,
  SourceRegion,
  StoredQuestion,
  TutorAssessment,
  TutorLevel,
  TutorStage
} from '@/lib/tutor/types'

const ownerPolicy = (name: string) =>
  pgPolicy(name, {
    for: 'all',
    to: 'public',
    using: sql`user_id = (select current_setting('app.current_user_id', true))`,
    withCheck: sql`user_id = (select current_setting('app.current_user_id', true))`
  })

export const tutorDocuments = pgTable(
  'tutor_documents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filename: text('filename').notNull(),
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    size: integer('size').notNull(),
    objectKey: text('object_key').notNull(),
    contentHash: text('content_hash').notNull(),
    indexKey: text('index_key').notNull(),
    status: text('status')
      .$type<'uploaded' | 'ready' | 'failed'>()
      .notNull()
      .default('uploaded'),
    pageCount: integer('page_count'),
    error: text('error'),
    embeddingModel: text('embedding_model'),
    parseVersion: text('parse_version'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    ownerPolicy('tutor_documents_owner'),
    index('tutor_documents_owner_idx').on(table.userId),
    uniqueIndex('tutor_documents_content_idx').on(
      table.userId,
      table.contentHash,
      table.indexKey
    )
  ]
).enableRLS()

export const tutorCourses = pgTable(
  'tutor_courses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    goal: text('goal').notNull(),
    level: text('level').$type<TutorLevel>().notNull(),
    locale: text('locale').$type<Locale>().notNull(),
    status: text('status').$type<CourseStatus>().notNull().default('queued'),
    stage: text('stage').$type<TutorStage>().notNull().default('queued'),
    processingProgress: integer('processing_progress').notNull().default(0),
    error: text('error'),
    planningNotes: jsonb('planning_notes')
      .$type<
        Record<
          string,
          { id: string; title: string; summary: string; sourceIds: string[] }[]
        >
      >()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  table => [
    ownerPolicy('tutor_courses_owner'),
    index('tutor_courses_owner_idx').on(table.userId, table.createdAt)
  ]
).enableRLS()

export const tutorCourseDocuments = pgTable(
  'tutor_course_documents',
  {
    userId: text('user_id').notNull(),
    courseId: text('course_id')
      .notNull()
      .references(() => tutorCourses.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => tutorDocuments.id, { onDelete: 'restrict' })
  },
  table => [
    primaryKey({ columns: [table.courseId, table.documentId] }),
    ownerPolicy('tutor_course_documents_owner')
  ]
).enableRLS()

export const tutorChunks = pgTable(
  'tutor_chunks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    documentId: text('document_id')
      .notNull()
      .references(() => tutorDocuments.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').notNull(),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    parentText: text('parent_text').notNull(),
    retrievalText: text('retrieval_text').notNull(),
    lexicalText: text('lexical_text').notNull(),
    heading: text('heading').notNull(),
    regions: jsonb('regions').$type<SourceRegion[]>().notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull()
  },
  table => [
    ownerPolicy('tutor_chunks_owner'),
    index('tutor_chunks_document_idx').on(table.userId, table.documentId),
    index('tutor_chunks_lexical_idx').using(
      'gin',
      sql`to_tsvector('simple', ${table.lexicalText})`
    )
  ]
).enableRLS()

export const tutorChapters = pgTable(
  'tutor_chapters',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    courseId: text('course_id')
      .notNull()
      .references(() => tutorCourses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    objectives: jsonb('objectives').$type<string[]>().notNull(),
    knowledgePoints: jsonb('knowledge_points')
      .$type<KnowledgePoint[]>()
      .notNull(),
    status: text('status').$type<ChapterStatus>().notNull().default('pending'),
    error: text('error'),
    content: jsonb('content').$type<ChapterContent>(),
    questions: jsonb('questions')
      .$type<StoredQuestion[]>()
      .notNull()
      .default([])
  },
  table => [
    ownerPolicy('tutor_chapters_owner'),
    uniqueIndex('tutor_chapters_position_idx').on(
      table.courseId,
      table.position
    )
  ]
).enableRLS()

export const tutorAttempts = pgTable(
  'tutor_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => tutorChapters.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull(),
    answer: text('answer').notNull(),
    assessment: jsonb('assessment').$type<TutorAssessment>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    ownerPolicy('tutor_attempts_owner'),
    index('tutor_attempts_chapter_idx').on(
      table.userId,
      table.chapterId,
      table.createdAt
    )
  ]
).enableRLS()

export type StoredCourse = typeof tutorCourses.$inferSelect
export type StoredChapter = typeof tutorChapters.$inferSelect
export type StoredDocument = typeof tutorDocuments.$inferSelect
