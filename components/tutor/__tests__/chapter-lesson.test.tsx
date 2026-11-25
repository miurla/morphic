import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TutorChapter } from '@/lib/tutor/types'

import { ChapterLesson } from '../chapter-lesson'

vi.mock('@/components/message', () => ({
  MarkdownMessage: ({ message }: { message: string }) => <p>{message}</p>
}))

const chapter: TutorChapter = {
  id: 'chapter-1',
  position: 0,
  title: 'Transactions',
  summary: 'Learn transactions',
  objectives: ['Explain atomicity'],
  knowledgePoints: [
    { id: 'kp-1', title: 'Atomicity', sourceIds: ['source-1'] }
  ],
  status: 'ready',
  error: null,
  mastery: 0,
  content: {
    concepts: [
      {
        title: 'Atomicity',
        explanation: 'All or nothing.',
        knowledgePointId: 'kp-1',
        sourceIds: ['source-1']
      }
    ],
    examples: [],
    sources: [
      {
        id: 'source-1',
        documentId: 'doc-1',
        filename: 'database.pdf',
        quote: 'All or nothing.',
        regions: [{ page: 4, x: 0.1, y: 0.2, width: 0.5, height: 0.1 }]
      }
    ]
  },
  questions: [
    {
      id: 'q-1',
      knowledgePointId: 'kp-1',
      kind: 'practice',
      prompt: 'Explain a rollback.'
    }
  ],
  latestAttempts: []
}
const fetchMock = vi.fn()

describe('Tutor learning and practice', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens non-PDF citations without showing a fabricated page number', () => {
    const onSource = vi.fn()
    const textSource = {
      ...chapter.content!.sources[0],
      filename: 'database.md'
    }
    render(
      <ChapterLesson
        userId="user-1"
        courseId="course-1"
        chapter={{
          ...chapter,
          content: { ...chapter.content!, sources: [textSource] }
        }}
        onChapter={vi.fn()}
        onSource={onSource}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'database.md' }))
    expect(onSource).toHaveBeenCalledWith(textSource)
    expect(screen.queryByText('p. 4')).not.toBeInTheDocument()
  })

  it('opens the actual cited source and shows mastery separately from processing', () => {
    const onSource = vi.fn()
    render(
      <ChapterLesson
        userId="user-1"
        courseId="course-1"
        chapter={chapter}
        onChapter={vi.fn()}
        onSource={onSource}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'database.pdf p. 4' }))
    expect(onSource).toHaveBeenCalledWith(chapter.content!.sources[0])
    expect(
      screen.getByRole('progressbar', { name: 'Chapter mastery' })
    ).toHaveAttribute('aria-valuenow', '0')
    expect(
      screen.queryByText('Material processing progress')
    ).not.toBeInTheDocument()
  })

  it('retains an answer and reuses its attempt ID after a transport failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chapter: { ...chapter, mastery: 70 },
          assessment: { id: 'attempt-1' }
        })
      })
    const onChapter = vi.fn()
    render(
      <ChapterLesson
        userId="user-1"
        courseId="course-1"
        chapter={chapter}
        onChapter={onChapter}
        onSource={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Practice 1' }))
    const input = screen.getByRole('textbox', {
      name: 'Your answer to question 1'
    })
    fireEvent.change(input, {
      target: { value: 'Roll back all writes if one fails.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    await screen.findByRole('alert')
    expect(input).toHaveValue('Roll back all writes if one fails.')
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    await waitFor(() => expect(onChapter).toHaveBeenCalled())
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(second.attemptId).toBe(first.attemptId)
    expect(sessionStorage.getItem('tutor-draft:user-1:course-1:q-1')).toBeNull()
  })

  it('supports keyboard navigation between learning and practice', () => {
    render(
      <ChapterLesson
        userId="user-1"
        courseId="course-1"
        chapter={chapter}
        onChapter={vi.fn()}
        onSource={vi.fn()}
      />
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Learn' }), {
      key: 'ArrowRight'
    })
    expect(screen.getByRole('tab', { name: 'Practice 1' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Practice 1' })).toHaveFocus()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('restores the answer only from the current user and course draft', () => {
    sessionStorage.setItem(
      'tutor-draft:user-2:course-1:q-1',
      JSON.stringify({ answer: 'Another user draft' })
    )
    sessionStorage.setItem(
      'tutor-draft:user-1:course-1:q-1',
      JSON.stringify({ answer: 'My draft' })
    )
    render(
      <ChapterLesson
        userId="user-1"
        courseId="course-1"
        chapter={chapter}
        onChapter={vi.fn()}
        onSource={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Practice 1' }))
    expect(screen.getByRole('textbox')).toHaveValue('My draft')
    expect(
      screen.queryByDisplayValue('Another user draft')
    ).not.toBeInTheDocument()
  })
})
