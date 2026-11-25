import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CHUNKING_VERSION } from '../chunking'
import { gradeAnswer, processChapter, processCourse } from '../service'
import type { RetrievedChunk, StoredQuestion } from '../types'

const mocks = vi.hoisted(() => ({
  getStoredCourse: vi.fn(),
  getCourseDocuments: vi.fn(),
  getDocumentIndexKey: () => 'document-index-key',
  updateCourse: vi.fn(),
  updateDocument: vi.fn(),
  saveDocumentChunks: vi.fn(),
  getAllCourseChunks: vi.fn(),
  saveCoursePlan: vi.fn(),
  getStoredChapter: vi.fn(),
  updateChapter: vi.fn(),
  getAssessment: vi.fn(),
  getChunksByIds: vi.fn(),
  recordAssessment: vi.fn(),
  getChapter: vi.fn(),
  generateTutorObject: vi.fn(),
  retrieveEvidenceWithTrace: vi.fn(),
  parseTutorDocument: vi.fn(),
  readTutorDocument: vi.fn(),
  embedTexts: vi.fn()
}))
vi.mock('../repository', () => mocks)
vi.mock('../assessment-lock', () => ({
  withAssessmentLock: async (
    _userId: string,
    _questionId: string,
    operation: () => Promise<unknown>
  ) => operation()
}))
vi.mock('../generation', async importOriginal => ({
  ...(await importOriginal<typeof import('../generation')>()),
  generateTutorObject: mocks.generateTutorObject
}))
vi.mock('../retrieval', () => ({
  retrieveEvidenceWithTrace: mocks.retrieveEvidenceWithTrace
}))
vi.mock('../documents', () => ({
  parseTutorDocument: mocks.parseTutorDocument
}))
vi.mock('../storage', () => ({ readTutorDocument: mocks.readTutorDocument }))
vi.mock('../embeddings', () => ({
  embedTexts: mocks.embedTexts,
  getEmbeddingIndexKey: () => 'index-key',
  getEmbeddingConfig: () => ({ auth: 'bearer', apiKey: 'test' })
}))

const source: RetrievedChunk = {
  id: 'source-a',
  documentId: 'doc-a',
  parentId: 'parent-a',
  filename: 'a.pdf',
  text: 'Atomicity makes changes succeed or fail together.',
  parentText: 'Atomicity makes changes succeed or fail together.',
  retrievalText:
    'Transactions: Atomicity makes changes succeed or fail together.',
  lexicalText: 'atomicity',
  heading: 'Transactions',
  position: 0,
  tokenCount: 12,
  score: 0.9,
  regions: [{ page: 1, x: 0, y: 0, width: 1, height: 0.1 }]
}
const question: StoredQuestion = {
  id: 'question-a',
  knowledgePointId: 'point-a',
  kind: 'concept',
  prompt: 'Explain atomicity.',
  referenceAnswer: 'All changes commit or none do.',
  rubric: [{ id: 'accuracy', criterion: 'Accuracy', maxScore: 100 }],
  sourceIds: ['source-a'],
  version: 'question-v1'
}
const grade = {
  assessable: true,
  feedback: 'Correct explanation.',
  strengths: ['Correct meaning.'],
  improvements: [],
  criteria: [
    {
      criterionId: 'accuracy',
      score: 90,
      reason: 'Correct, with a minor omission.'
    }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  mocks.getStoredCourse.mockResolvedValue({
    id: 'course-a',
    status: 'ready',
    planningNotes: {},
    locale: 'en',
    goal: 'Apply database concepts',
    level: 'beginner'
  })
  mocks.getCourseDocuments.mockResolvedValue([
    {
      id: 'doc-a',
      status: 'ready',
      pageCount: 1,
      embeddingModel: 'index-key',
      indexKey: 'document-index-key',
      parseVersion: CHUNKING_VERSION
    }
  ])
  mocks.getAllCourseChunks.mockResolvedValue([source])
  mocks.getStoredChapter.mockResolvedValue({
    id: 'chapter-a',
    status: 'ready',
    title: 'Transactions',
    objectives: ['Explain atomicity'],
    knowledgePoints: [
      { id: 'point-a', title: 'Atomicity', sourceIds: ['source-a'] }
    ],
    questions: [question]
  })
  mocks.getAssessment.mockResolvedValue(null)
  mocks.getChunksByIds.mockResolvedValue([source])
  mocks.recordAssessment.mockImplementation(
    async (_user, _course, _chapter, assessment) => assessment
  )
  mocks.getChapter.mockResolvedValue({
    id: 'chapter-a',
    mastery: 45,
    questions: [{ id: question.id, prompt: question.prompt }]
  })
  mocks.retrieveEvidenceWithTrace.mockResolvedValue({
    chunks: [source],
    trace: { evidenceIds: ['source-a'] }
  })
  mocks.generateTutorObject.mockImplementation(async options => {
    const value = options.schema.parse(grade)
    options.validate?.(value)
    return value
  })
})

describe('Tutor answer evaluation service', () => {
  const input = {
    userId: 'alice',
    courseId: 'course-a',
    chapterId: 'chapter-a',
    questionId: 'question-a',
    answer: 'All changes succeed together.',
    attemptId: 'attempt-a',
    locale: 'en'
  }

  it('grades against frozen sources, computes rubric totals, and returns the public API shape', async () => {
    const result = await gradeAnswer(input)
    expect(mocks.getChunksByIds).toHaveBeenCalledWith('alice', 'course-a', [
      'source-a'
    ])
    expect(mocks.retrieveEvidenceWithTrace).not.toHaveBeenCalled()
    expect(mocks.generateTutorObject).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'grade',
        data: expect.objectContaining({
          referenceAnswer: question.referenceAnswer,
          rubric: question.rubric,
          studentAnswer: input.answer
        })
      })
    )
    expect(result).toMatchObject({
      assessment: { id: 'attempt-a', score: 90, questionId: 'question-a' },
      chapter: { id: 'chapter-a', mastery: 45 }
    })
    expect(JSON.stringify(result)).not.toContain('referenceAnswer')
    expect(JSON.stringify(result)).not.toContain(
      'All changes commit or none do.'
    )
  })

  it('replays the same submission without another model call and rejects changed content', async () => {
    const existing = {
      id: 'attempt-a',
      questionId: 'question-a',
      answer: input.answer,
      score: 90
    }
    mocks.getAssessment.mockResolvedValue(existing)
    expect((await gradeAnswer(input)).assessment).toBe(existing)
    expect(mocks.generateTutorObject).not.toHaveBeenCalled()
    expect(mocks.recordAssessment).not.toHaveBeenCalled()
    await expect(
      gradeAnswer({ ...input, answer: 'Changed answer' })
    ).rejects.toMatchObject({ code: 'ATTEMPT_CONFLICT' })
  })

  it('does not grade an unavailable question or update mastery when sources are missing', async () => {
    mocks.getChunksByIds.mockResolvedValue([])
    await expect(gradeAnswer(input)).rejects.toMatchObject({
      code: 'INSUFFICIENT_EVIDENCE'
    })
    expect(mocks.recordAssessment).not.toHaveBeenCalled()
    expect(mocks.generateTutorObject).not.toHaveBeenCalled()
    mocks.getStoredChapter.mockResolvedValue(null)
    await expect(gradeAnswer(input)).rejects.toMatchObject({
      code: 'INVALID_QUESTION'
    })
  })

  it('does not persist a model-declared unassessable answer as zero marks', async () => {
    mocks.generateTutorObject.mockImplementation(async options => {
      const value = options.schema.parse({ ...grade, assessable: false })
      options.validate?.(value)
      return value
    })
    await expect(gradeAnswer(input)).rejects.toMatchObject({
      code: 'INSUFFICIENT_EVIDENCE'
    })
    expect(mocks.recordAssessment).not.toHaveBeenCalled()
  })
})

describe('Tutor course planning and checkpoint recovery', () => {
  it('passes the document filename to the format-aware parser before indexing', async () => {
    mocks.getStoredCourse.mockResolvedValue({
      id: 'course-a',
      status: 'queued'
    })
    mocks.getCourseDocuments.mockResolvedValue([
      {
        id: 'doc-a',
        filename: 'notes.md',
        status: 'uploaded',
        indexKey: 'document-index-key'
      }
    ])
    const bytes = new TextEncoder().encode('# Transactions\nAtomicity matters.')
    mocks.readTutorDocument.mockResolvedValue(bytes)
    mocks.parseTutorDocument.mockResolvedValue({
      blocks: [
        {
          text: 'Atomicity matters.',
          region: { page: 1, x: 0, y: 0, width: 1, height: 1 }
        }
      ],
      pageCount: 1,
      warnings: []
    })
    mocks.embedTexts.mockRejectedValueOnce(new Error('embedding unavailable'))
    await expect(
      processCourse({ userId: 'alice', courseId: 'course-a' })
    ).rejects.toThrow()
    expect(mocks.parseTutorDocument).toHaveBeenCalledWith(bytes, 'notes.md')
    expect(mocks.embedTexts).toHaveBeenCalledWith([
      expect.stringContaining('Atomicity matters.')
    ])
  })
  it('reuses a persisted extraction checkpoint when final route generation fails', async () => {
    const course = {
      id: 'course-a',
      status: 'queued',
      planningNotes: {},
      locale: 'en',
      goal: 'Learn transactions',
      level: 'beginner'
    }
    mocks.getStoredCourse.mockImplementation(async () => ({ ...course }))
    mocks.updateCourse.mockImplementation(async (_user, _id, patch) => {
      Object.assign(course, patch)
    })
    let failPlan = true
    mocks.generateTutorObject.mockImplementation(async options => {
      if (options.task === 'extract') {
        const value = options.schema.parse({
          topics: [
            {
              title: 'Atomicity',
              summary: 'All or nothing.',
              unitIds: options.data.units.map((unit: { id: string }) => unit.id)
            }
          ]
        })
        options.validate?.(value)
        return value
      }
      if (failPlan) throw new Error('Temporary provider outage')
      const value = options.schema.parse({
        title: 'Transactions',
        chapters: [
          {
            title: 'Atomicity',
            summary: 'Atomicity basics',
            objectives: ['Explain atomicity'],
            knowledgePoints: [
              {
                title: 'Atomicity',
                topicIds: options.data.topics.map(
                  (topic: { id: string }) => topic.id
                )
              }
            ]
          }
        ]
      })
      options.validate?.(value)
      return value
    })
    await expect(
      processCourse({ userId: 'alice', courseId: 'course-a' })
    ).rejects.toThrow()
    expect(course.status).toBe('failed')
    expect(Object.keys(course.planningNotes)).toHaveLength(1)
    failPlan = false
    await processCourse({ userId: 'alice', courseId: 'course-a' })
    const extractionCalls = mocks.generateTutorObject.mock.calls.filter(
      ([options]) => options.task === 'extract'
    )
    expect(extractionCalls).toHaveLength(1)
    expect(mocks.parseTutorDocument).not.toHaveBeenCalled()
    expect(mocks.embedTexts).not.toHaveBeenCalled()
    expect(mocks.saveCoursePlan).toHaveBeenCalledWith(
      'alice',
      'course-a',
      expect.objectContaining({
        chapters: [
          expect.objectContaining({
            knowledgePoints: [
              expect.objectContaining({ sourceIds: ['source-a'] })
            ]
          })
        ]
      })
    )
  })

  it('fails extraction that omits a whole source unit instead of publishing a partial course', async () => {
    mocks.getStoredCourse.mockResolvedValue({
      id: 'course-a',
      status: 'queued',
      planningNotes: {},
      locale: 'en',
      goal: '',
      level: 'beginner'
    })
    mocks.getAllCourseChunks.mockResolvedValue([
      source,
      { ...source, id: 'source-b', parentId: 'parent-b' }
    ])
    mocks.generateTutorObject.mockImplementation(async options => {
      const value = options.schema.parse({
        topics: [
          {
            title: 'Partial',
            summary: 'Incomplete',
            unitIds: [options.data.units[0].id]
          }
        ]
      })
      options.validate?.(value)
      return value
    })
    await expect(
      processCourse({ userId: 'alice', courseId: 'course-a' })
    ).rejects.toThrow('coverage')
    expect(mocks.saveCoursePlan).not.toHaveBeenCalled()
  })
})

describe('Tutor chapter generation', () => {
  it('does not regenerate published chapters and preserves existing question IDs', async () => {
    await processChapter({
      userId: 'alice',
      courseId: 'course-a',
      chapterId: 'chapter-a'
    })
    expect(mocks.generateTutorObject).not.toHaveBeenCalled()
    expect(mocks.updateChapter).not.toHaveBeenCalled()
  })

  it('fails a chapter if generated content references a different course source', async () => {
    const current = await mocks.getStoredChapter()
    mocks.getStoredChapter.mockResolvedValue({ ...current, status: 'pending' })
    mocks.generateTutorObject.mockImplementation(async options => {
      const section = {
        title: 'Atomicity',
        explanation: 'All or nothing.',
        knowledgePointId: 'point-a',
        sourceIds: ['foreign-source']
      }
      const q = {
        knowledgePointId: 'point-a',
        prompt: 'Explain atomicity.',
        referenceAnswer: 'All or nothing.',
        rubric: question.rubric,
        sourceIds: ['source-a']
      }
      const value = options.schema.parse({
        concepts: [section],
        examples: [section],
        questions: [
          { ...q, kind: 'concept' },
          { ...q, kind: 'practice' }
        ]
      })
      options.validate?.(value)
      return value
    })
    await expect(
      processChapter({
        userId: 'alice',
        courseId: 'course-a',
        chapterId: 'chapter-a'
      })
    ).rejects.toMatchObject({ code: 'INVALID_CITATION' })
    expect(mocks.updateChapter).toHaveBeenLastCalledWith(
      'alice',
      'course-a',
      'chapter-a',
      expect.objectContaining({ status: 'failed' })
    )
    expect(
      mocks.updateChapter.mock.calls.some(
        ([, , , patch]) => patch.status === 'ready'
      )
    ).toBe(false)
  })
})
