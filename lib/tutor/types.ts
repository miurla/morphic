import type { Locale } from '@/lib/i18n/config'

export type TutorLevel = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'queued' | 'processing' | 'ready' | 'failed'
export type ChapterStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type TutorStage =
  | 'queued'
  | 'parsing'
  | 'indexing'
  | 'planning'
  | 'ready'
  | 'failed'

/** Fractions of the rendered PDF page, including its original rotation. */
export interface SourceRegion {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface SourceCitation {
  id: string
  documentId: string
  filename: string
  quote: string
  regions: SourceRegion[]
}

export interface TutorDocument {
  id: string
  filename: string
  size: number
  pageCount: number | null
  status: 'uploaded' | 'ready' | 'failed'
  error: string | null
  warnings?: string[]
}

export interface KnowledgePoint {
  id: string
  title: string
  sourceIds: string[]
}

export interface LessonSection {
  title: string
  explanation: string
  knowledgePointId: string
  sourceIds: string[]
}

export interface ChapterContent {
  concepts: LessonSection[]
  examples: LessonSection[]
  sources: SourceCitation[]
}

export interface TutorQuestion {
  id: string
  knowledgePointId: string
  kind: 'concept' | 'practice'
  prompt: string
}

/** Server-only fields must never be included in a course API response. */
export interface StoredQuestion extends TutorQuestion {
  referenceAnswer: string
  rubric: { id: string; criterion: string; maxScore: number }[]
  sourceIds: string[]
  version: string
}

export interface TutorAssessment {
  id: string
  questionId: string
  knowledgePointId: string
  answer: string
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
  criteria: {
    criterion: string
    score: number
    maxScore: number
    reason: string
  }[]
  sourceIds: string[]
  createdAt: string
}

export interface TutorChapter {
  id: string
  position: number
  title: string
  summary: string
  objectives: string[]
  knowledgePoints: KnowledgePoint[]
  status: ChapterStatus
  error: string | null
  mastery: number
  content: ChapterContent | null
  questions: TutorQuestion[]
  latestAttempts: TutorAssessment[]
}

export interface TutorCourseSummary {
  id: string
  title: string
  goal: string
  level: TutorLevel
  locale: Locale
  status: CourseStatus
  stage: TutorStage
  processingProgress: number
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface TutorCourse extends TutorCourseSummary {
  documents: TutorDocument[]
  chapters: TutorChapter[]
}

export interface CreateTutorCourseInput {
  documentIds: string[]
  goal: string
  level: TutorLevel
  locale: Locale
}

export interface TutorCapabilities {
  ready: boolean
  missing: string[]
  maxFileSize: number
  maxFiles: number
}

export interface TutorChunk {
  id: string
  documentId: string
  parentId: string
  position: number
  text: string
  parentText: string
  retrievalText: string
  lexicalText: string
  heading: string
  regions: SourceRegion[]
  tokenCount: number
  embedding?: number[]
}

export interface RetrievedChunk extends TutorChunk {
  filename: string
  score: number
}

export interface ParsedPdfBlock {
  text: string
  region: SourceRegion
  heading?: boolean
}

export interface ParsedPdf {
  pageCount: number
  blocks: ParsedPdfBlock[]
  warnings: string[]
}
