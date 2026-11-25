import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db/with-rls', () => ({ withRLS: vi.fn() }))
import type { StoredChapter } from '@/lib/db/tutor-schema'

import { publicChapter } from '../repository'

describe('Tutor public course projections', () => {
  it('never includes answer keys or rubrics in student question responses', () => {
    const chapter: StoredChapter = {
      id: 'ch',
      userId: 'u',
      courseId: 'c',
      position: 0,
      title: 'Chapter',
      summary: 'Summary',
      objectives: [],
      knowledgePoints: [{ id: 'kp', title: 'Point', sourceIds: ['s'] }],
      status: 'ready',
      error: null,
      content: null,
      questions: [
        {
          id: 'q',
          knowledgePointId: 'kp',
          kind: 'practice',
          prompt: 'Explain',
          referenceAnswer: 'TOP SECRET',
          rubric: [{ id: 'r', criterion: 'PRIVATE CRITERION', maxScore: 100 }],
          sourceIds: ['s'],
          version: 'v1'
        }
      ]
    }
    const result = publicChapter(chapter, [])
    expect(result.questions).toEqual([
      { id: 'q', knowledgePointId: 'kp', kind: 'practice', prompt: 'Explain' }
    ])
    expect(result.mastery).toBe(0)
    expect(JSON.stringify(result)).not.toContain('TOP SECRET')
    expect(JSON.stringify(result)).not.toContain('PRIVATE CRITERION')
  })
})
