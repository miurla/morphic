import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTranslator } from '@/lib/i18n/translate'
import type { TutorChapter, TutorCourse } from '@/lib/tutor/types'

import { TutorWorkspace } from '../tutor-workspace'

const state = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'zh-CN',
  router: { push: vi.fn(), replace: vi.fn() },
  onChapter: undefined as ((chapter: TutorChapter) => void) | undefined
}))
vi.mock('next/navigation', () => ({ useRouter: () => state.router }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/language-provider', () => ({
  useI18n: () => ({ locale: state.locale, t: createTranslator(state.locale) })
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('../new-course-form', () => ({
  NewCourseForm: () => <h1>New course form</h1>
}))
vi.mock('../document-list', () => ({ TutorDocumentList: () => null }))
vi.mock('../chapter-lesson', () => ({
  ChapterLesson: ({
    chapter,
    onChapter
  }: {
    chapter: TutorChapter
    onChapter: (chapter: TutorChapter) => void
  }) => {
    state.onChapter = onChapter
    return <p>Lesson: {chapter.title}</p>
  }
}))

const chapter: TutorChapter = {
  id: 'chapter-1',
  position: 0,
  title: 'Atomicity',
  summary: 'All or nothing',
  objectives: [],
  knowledgePoints: [],
  status: 'ready',
  error: null,
  content: null,
  questions: [],
  latestAttempts: [],
  mastery: 0
}
const course: TutorCourse = {
  id: 'course-1',
  title: 'Transactions',
  goal: 'Learn database transactions',
  level: 'beginner',
  locale: 'en',
  status: 'ready',
  stage: 'ready',
  processingProgress: 100,
  error: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  documents: [],
  chapters: [chapter]
}
const capabilities = {
  ready: true,
  missing: [],
  maxFileSize: 5000000,
  maxFiles: 5
}
const response = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
const fetchMock = vi.fn()

async function openDelete(title = course.title) {
  const t = createTranslator(state.locale)
  const trigger = await screen.findByRole('button', {
    name: t('Actions for {title}', { title })
  })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  fireEvent.click(
    await screen.findByRole('menuitem', {
      name: t('Delete learning path')
    })
  )
  return screen.findByRole('alertdialog')
}
async function confirmDelete() {
  const dialog = await openDelete()
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: createTranslator(state.locale)('Delete learning path')
    })
  )
}
const deletes = () =>
  fetchMock.mock.calls.filter(([, init]) => init.method === 'DELETE')

describe('Tutor learning path deletion', () => {
  beforeEach(() => {
    state.locale = 'en'
    state.router.push.mockReset()
    state.router.replace.mockReset()
    state.onChapter = undefined
    sessionStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(async (path, init) => {
      if (init.method === 'DELETE')
        return response({ deleted: true, courseId: course.id })
      if (path === '/api/tutor/courses')
        return response({ courses: [course], capabilities })
      return response({ course })
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(['en', 'zh-CN'] as const)(
    'requires confirmation and allows cancelling in %s',
    async locale => {
      state.locale = locale
      const t = createTranslator(locale)
      const { container } = render(<TutorWorkspace userId="user-1" />)
      const dialog = await openDelete()
      expect(
        within(dialog).getByRole('heading', {
          name: t('Delete “{title}”?', { title: course.title })
        })
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(
          t(
            'This permanently deletes the chapters, exercises, answers, and learning progress for this path. This cannot be undone. Your uploaded original materials will be kept.'
          )
        )
      ).toBeInTheDocument()
      expect(container.querySelector('button button')).toBeNull()
      expect(deletes()).toHaveLength(0)
      fireEvent.click(within(dialog).getByRole('button', { name: t('Cancel') }))
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      )
      expect(deletes()).toHaveLength(0)
      expect(state.router.push).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', {
          name: t('Actions for {title}', { title: course.title })
        })
      ).toBeInTheDocument()
    }
  )

  it.each(['queued', 'processing', 'failed', 'ready'] as const)(
    'deletes a %s path from its detail page and clears only its drafts',
    async status => {
      const current: TutorCourse = {
        ...course,
        status,
        stage: status === 'processing' ? 'planning' : status
      }
      fetchMock.mockImplementation(async (path, init) => {
        if (init.method === 'DELETE') return response({ deleted: true })
        if (path === '/api/tutor/courses')
          return response({ courses: [current], capabilities })
        return response({ course: current })
      })
      sessionStorage.setItem('tutor-draft:user-1:course-1:q-1', 'remove')
      sessionStorage.setItem('tutor-draft:user-1:course-1:q-2', 'remove')
      sessionStorage.setItem('tutor-draft:user-1:course-2:q-1', 'keep')
      sessionStorage.setItem('tutor-draft:user-2:course-1:q-1', 'keep')
      render(<TutorWorkspace userId="user-1" initialCourseId={course.id} />)
      await confirmDelete()
      await screen.findByRole('heading', { name: 'New course form' })
      expect(state.router.replace).toHaveBeenCalledWith('/tutor', {
        scroll: false
      })
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(
        sessionStorage.getItem('tutor-draft:user-1:course-1:q-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('tutor-draft:user-1:course-1:q-2')
      ).toBeNull()
      expect(sessionStorage.getItem('tutor-draft:user-1:course-2:q-1')).toBe(
        'keep'
      )
      expect(sessionStorage.getItem('tutor-draft:user-2:course-1:q-1')).toBe(
        'keep'
      )
      expect(deletes()).toHaveLength(1)
      expect(deletes()[0][0]).toBe('/api/tutor/courses/course-1')
    }
  )

  it('keeps the failed confirmation open, allows retry, and prevents duplicate submissions', async () => {
    const pending = deferred<ReturnType<typeof response>>()
    let count = 0
    fetchMock.mockImplementation(async (path, init) => {
      if (init.method === 'DELETE') {
        count++
        return count === 1
          ? response({ error: 'Network unavailable' }, 503)
          : pending.promise
      }
      return response({ courses: [course], capabilities })
    })
    render(<TutorWorkspace userId="user-1" />)
    await confirmDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network unavailable'
    )
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete learning path' })
    )
    const busy = await within(dialog).findByRole('button', {
      name: 'Deleting…'
    })
    expect(busy).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toBeDisabled()
    fireEvent.click(busy)
    expect(deletes()).toHaveLength(2)
    await act(async () => pending.resolve(response({ deleted: true })))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(state.router.replace).not.toHaveBeenCalled()
  })

  it('treats a repeated delete returning 404 as already removed', async () => {
    fetchMock.mockImplementation(async (path, init) =>
      init.method === 'DELETE'
        ? response({ error: 'Not found', code: 'NOT_FOUND' }, 404)
        : response({ courses: [course], capabilities })
    )
    render(<TutorWorkspace userId="user-1" />)
    await confirmDelete()
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('does not remove a path when deletion is denied', async () => {
    fetchMock.mockImplementation(async (path, init) =>
      init.method === 'DELETE'
        ? response(
            { error: 'Invalid request origin.', code: 'INVALID_ORIGIN' },
            403
          )
        : response({ courses: [course], capabilities })
    )
    render(<TutorWorkspace userId="user-1" />)
    await confirmDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid request origin.'
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(state.router.replace).not.toHaveBeenCalled()
  })

  it('ignores list, detail and grading responses that arrive after deletion', async () => {
    render(<TutorWorkspace userId="user-1" initialCourseId={course.id} />)
    await screen.findByText('Lesson: Atomicity')
    const lateGrade = state.onChapter!
    const lateList = deferred<ReturnType<typeof response>>()
    const lateDetail = deferred<ReturnType<typeof response>>()
    fetchMock.mockImplementation(async (path, init) => {
      if (init.method === 'DELETE') return response({ deleted: true })
      return path === '/api/tutor/courses'
        ? lateList.promise
        : lateDetail.promise
    })
    fireEvent.focus(window)
    await confirmDelete()
    await screen.findByRole('heading', { name: 'New course form' })
    await act(async () => {
      lateList.resolve(response({ courses: [course], capabilities }))
      lateDetail.resolve(response({ course }))
      lateGrade({ ...chapter, title: 'Late score result', mastery: 100 })
    })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Lesson: Atomicity')).not.toBeInTheDocument()
    expect(screen.queryByText('Late score result')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Actions for Transactions' })
    ).not.toBeInTheDocument()
  })

  it('reconciles a path removed in another tab when the window regains focus', async () => {
    render(<TutorWorkspace userId="user-1" initialCourseId={course.id} />)
    await screen.findByText('Lesson: Atomicity')
    fetchMock.mockImplementation(async path =>
      path === '/api/tutor/courses'
        ? response({ courses: [], capabilities })
        : response({ error: 'Not found', code: 'NOT_FOUND' }, 404)
    )
    fireEvent.focus(window)
    await screen.findByRole('heading', { name: 'New course form' })
    expect(state.router.replace).toHaveBeenCalledWith('/tutor', {
      scroll: false
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
