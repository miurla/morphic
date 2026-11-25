import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CHUNKING_VERSION } from '../chunking'
import { TutorError } from '../errors'
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
  vi.resetAllMocks()
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

  it.each(['completed', 'failed'])(
    'returns 404 when the course is deleted during a %s model request',
    async outcome => {
      mocks.generateTutorObject.mockImplementation(async () => {
        mocks.getStoredCourse.mockResolvedValue(null)
        if (outcome === 'failed') throw new Error('Provider unavailable')
        return grade
      })
      await expect(gradeAnswer(input)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404
      })
      expect(mocks.recordAssessment).not.toHaveBeenCalled()
    }
  )

  it('does not return a successful assessment with a deleted chapter', async () => {
    mocks.getChapter.mockResolvedValue(null)
    await expect(gradeAnswer(input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404
    })
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
    expect(mocks.embedTexts).toHaveBeenCalledWith(
      [expect.stringContaining('Atomicity matters.')],
      expect.any(Function)
    )
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

describe('Tutor jobs cancelled by course deletion', () => {
  const job = { userId: 'alice', courseId: 'course-a' }
  const chapterJob = { ...job, chapterId: 'chapter-a' }

  async function queuedCourse() {
    const course = await mocks.getStoredCourse()
    mocks.getStoredCourse.mockResolvedValue({ ...course, status: 'queued' })
  }

  async function pendingChapter() {
    const chapter = await mocks.getStoredChapter()
    mocks.getStoredChapter.mockResolvedValue({ ...chapter, status: 'pending' })
  }

  function uploadedDocument() {
    mocks.getCourseDocuments.mockResolvedValue([
      {
        id: 'doc-a',
        filename: 'notes.md',
        status: 'uploaded',
        indexKey: 'document-index-key'
      }
    ])
    mocks.readTutorDocument.mockResolvedValue(new Uint8Array([1]))
    mocks.parseTutorDocument.mockResolvedValue({
      blocks: [
        {
          text: 'Atomicity makes changes succeed or fail together.',
          region: { page: 1, x: 0, y: 0, width: 1, height: 1 }
        }
      ],
      pageCount: 1,
      warnings: []
    })
  }

  it('discards queued course and chapter jobs whose course was deleted', async () => {
    mocks.getStoredCourse.mockResolvedValue(null)
    await expect(processCourse(job)).resolves.toBeUndefined()
    await expect(processChapter(chapterJob)).resolves.toBeUndefined()
    expect(mocks.generateTutorObject).not.toHaveBeenCalled()
    expect(mocks.updateCourse).not.toHaveBeenCalled()
    expect(mocks.updateChapter).not.toHaveBeenCalled()
  })

  it.each(['parse', 'embed'])(
    'stops after deletion during %s without failing shared documents',
    async phase => {
      await queuedCourse()
      uploadedDocument()
      if (phase === 'parse') {
        mocks.parseTutorDocument.mockImplementation(async () => {
          mocks.getStoredCourse.mockResolvedValue(null)
          throw new Error('Parser stopped')
        })
      } else {
        mocks.embedTexts.mockImplementation(async () => {
          mocks.getStoredCourse.mockResolvedValue(null)
          return [[1, 0]]
        })
      }
      await expect(processCourse(job)).resolves.toBeUndefined()
      expect(mocks.updateDocument).not.toHaveBeenCalled()
      expect(mocks.saveDocumentChunks).not.toHaveBeenCalled()
      expect(mocks.generateTutorObject).not.toHaveBeenCalled()
      expect(
        mocks.updateCourse.mock.calls.some(
          ([, , patch]) => patch.status === 'failed'
        )
      ).toBe(false)
    }
  )

  it('discards extraction results and does not start planning after deletion', async () => {
    await queuedCourse()
    mocks.generateTutorObject.mockImplementation(async () => {
      mocks.getStoredCourse.mockResolvedValue(null)
      return { topics: [] }
    })
    await expect(processCourse(job)).resolves.toBeUndefined()
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(1)
    expect(mocks.saveCoursePlan).not.toHaveBeenCalled()
    expect(
      mocks.updateCourse.mock.calls.some(
        ([, , patch]) => 'planningNotes' in patch || patch.status === 'failed'
      )
    ).toBe(false)
  })

  it('handles deletion after the last course check but before plan persistence', async () => {
    await queuedCourse()
    mocks.generateTutorObject.mockImplementation(async options =>
      options.task === 'extract'
        ? {
            topics: [
              {
                title: 'Atomicity',
                summary: 'All or nothing.',
                unitIds: options.data.units.map(
                  (unit: { id: string }) => unit.id
                )
              }
            ]
          }
        : { title: 'Transactions', chapters: [] }
    )
    mocks.saveCoursePlan.mockImplementation(async () => {
      mocks.getStoredCourse.mockResolvedValue(null)
      throw new TutorError(
        'The requested learning resource was not found.',
        'NOT_FOUND',
        404
      )
    })
    await expect(processCourse(job)).resolves.toBeUndefined()
    expect(mocks.saveCoursePlan).toHaveBeenCalledTimes(1)
    expect(
      mocks.updateCourse.mock.calls.some(
        ([, , patch]) => patch.status === 'failed'
      )
    ).toBe(false)
  })

  it('does not swallow a missing resource error while the course still exists', async () => {
    await queuedCourse()
    const error = new TutorError('Missing source', 'NOT_FOUND', 404)
    mocks.getAllCourseChunks.mockRejectedValue(error)
    await expect(processCourse(job)).rejects.toBe(error)
    expect(mocks.updateCourse).toHaveBeenLastCalledWith(
      'alice',
      'course-a',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it.each(['course', 'chapter'])(
    'handles deletion between the failure check and the %s failure update',
    async kind => {
      const error = new Error('Provider unavailable')
      mocks.generateTutorObject.mockRejectedValue(error)
      if (kind === 'course') {
        await queuedCourse()
        mocks.updateCourse.mockImplementation(async (_user, _course, patch) => {
          if (patch.status === 'failed') {
            mocks.getStoredCourse.mockResolvedValue(null)
            throw new TutorError('Deleted', 'NOT_FOUND', 404)
          }
        })
      } else {
        await pendingChapter()
        mocks.updateChapter.mockImplementation(
          async (_user, _course, _chapter, patch) => {
            if (patch.status === 'failed') {
              mocks.getStoredCourse.mockResolvedValue(null)
              throw new TutorError('Deleted', 'NOT_FOUND', 404)
            }
          }
        )
      }
      await expect(
        kind === 'course' ? processCourse(job) : processChapter(chapterJob)
      ).resolves.toBeUndefined()
    }
  )

  it('discards a late lesson without writing a ready or failed chapter', async () => {
    await pendingChapter()
    mocks.generateTutorObject.mockImplementation(async () => {
      mocks.getStoredCourse.mockResolvedValue(null)
      return {}
    })
    await expect(processChapter(chapterJob)).resolves.toBeUndefined()
    expect(mocks.updateChapter).toHaveBeenCalledTimes(1)
    expect(mocks.updateChapter).toHaveBeenLastCalledWith(
      'alice',
      'course-a',
      'chapter-a',
      { status: 'generating', error: null }
    )
  })
})
