'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

import {
  IconArrowLeft,
  IconBook2,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSchool
} from '@tabler/icons-react'

import type {
  SourceCitation,
  TutorCapabilities,
  TutorChapter,
  TutorCourse,
  TutorCourseSummary,
  TutorStage
} from '@/lib/tutor/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { useI18n } from '@/components/language-provider'

import { errorMessage, isAbortError, tutorRequest } from './api'
import { ChapterLesson } from './chapter-lesson'
import { TutorDocumentList } from './document-list'
import { NewCourseForm } from './new-course-form'
import { ProgressMeter } from './progress-meter'

const SourceViewer = dynamic(() => import('./source-viewer'), { ssr: false })

const stageLabels: Record<TutorStage, string> = {
  queued: 'Waiting to begin',
  parsing: 'Reading your files',
  indexing: 'Connecting knowledge and sources',
  planning: 'Building your learning path',
  ready: 'Ready to learn',
  failed: 'Needs attention'
}

export function TutorWorkspace({
  userId,
  initialCourseId
}: {
  userId: string
  initialCourseId?: string
}) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [courses, setCourses] = useState<TutorCourseSummary[]>([])
  const [capabilities, setCapabilities] = useState<TutorCapabilities | null>(
    null
  )
  const [selectedId, setSelectedId] = useState(initialCourseId)
  const [course, setCourse] = useState<TutorCourse | null>(null)
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [source, setSource] = useState<SourceCitation | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingCourse, setLoadingCourse] = useState(Boolean(initialCourseId))
  const [listError, setListError] = useState('')
  const [courseError, setCourseError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [listRefresh, setListRefresh] = useState(0)
  const [courseRefresh, setCourseRefresh] = useState(0)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  useEffect(() => {
    setSelectedId(initialCourseId)
  }, [initialCourseId])

  useEffect(() => {
    const controller = new AbortController()
    setLoadingList(true)
    setListError('')
    tutorRequest<{
      courses: TutorCourseSummary[]
      capabilities: TutorCapabilities
    }>('/api/tutor/courses', locale, { signal: controller.signal })
      .then(result => {
        setCourses(result.courses)
        setCapabilities(result.capabilities)
      })
      .catch(cause => {
        if (!isAbortError(cause)) setListError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false)
      })
    return () => controller.abort()
  }, [locale, listRefresh])

  const receiveCourse = useCallback((next: TutorCourse) => {
    if (selectedRef.current !== next.id) return
    setCourse(next)
    setChapterId(current =>
      next.chapters.some(chapter => chapter.id === current)
        ? current
        : (next.chapters[0]?.id ?? null)
    )
    setCourses(current =>
      [next, ...current.filter(item => item.id !== next.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )
    )
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setCourse(null)
      setChapterId(null)
      setLoadingCourse(false)
      return
    }
    const controller = new AbortController()
    setLoadingCourse(true)
    setCourseError('')
    tutorRequest<{ course: TutorCourse }>(
      `/api/tutor/courses/${encodeURIComponent(selectedId)}`,
      locale,
      { signal: controller.signal }
    )
      .then(result => receiveCourse(result.course))
      .catch(cause => {
        if (!isAbortError(cause)) setCourseError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCourse(false)
      })
    return () => controller.abort()
  }, [selectedId, locale, receiveCourse, courseRefresh])

  const processing = Boolean(
    course &&
      (course.status === 'queued' ||
        course.status === 'processing' ||
        course.chapters.some(chapter => chapter.status === 'generating'))
  )
  useEffect(() => {
    if (!selectedId || !processing) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false
    const controller = new AbortController()
    async function poll() {
      if (disposed || inFlight) return
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(poll, 3000)
        return
      }
      inFlight = true
      try {
        const result = await tutorRequest<{ course: TutorCourse }>(
          `/api/tutor/courses/${encodeURIComponent(selectedId!)}`,
          locale,
          { signal: controller.signal }
        )
        if (!disposed) {
          receiveCourse(result.course)
          setCourseError('')
        }
      } catch (cause) {
        if (!disposed && !isAbortError(cause))
          setCourseError(errorMessage(cause))
      } finally {
        inFlight = false
        if (!disposed) timer = setTimeout(poll, 3000)
      }
    }
    timer = setTimeout(poll, 2000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      clearTimeout(timer)
      controller.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selectedId, processing, locale, receiveCourse])

  function navigate(id?: string) {
    setSelectedId(id)
    setCourse(null)
    setChapterId(null)
    setCourseError('')
    setSource(null)
    setLoadingCourse(Boolean(id))
    router.push(id ? `/tutor?course=${encodeURIComponent(id)}` : '/tutor', {
      scroll: false
    })
  }

  function updateChapter(next: TutorChapter) {
    setCourse(current =>
      current
        ? {
            ...current,
            chapters: current.chapters.map(chapter =>
              chapter.id === next.id ? next : chapter
            )
          }
        : current
    )
  }

  async function retry() {
    if (!course || retrying) return
    setRetrying(true)
    setCourseError('')
    try {
      const result = await tutorRequest<{ course: TutorCourse }>(
        `/api/tutor/courses/${course.id}/retry`,
        locale,
        { method: 'POST' }
      )
      receiveCourse(result.course)
    } catch (cause) {
      setCourseError(errorMessage(cause))
    } finally {
      setRetrying(false)
    }
  }

  const activeChapter = course?.chapters.find(
    chapter => chapter.id === chapterId
  )

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background pt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconSchool className="size-5" aria-hidden />
            <span>{t('Tutor')}</span>
            {course && (
              <>
                <IconChevronRight
                  className="size-3 text-muted-foreground"
                  aria-hidden
                />
                <span className="max-w-40 truncate text-muted-foreground sm:max-w-md">
                  {course.title}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {courses.length > 0 && (
              <select
                aria-label={t('Your courses')}
                value={
                  selectedId && courses.some(item => item.id === selectedId)
                    ? selectedId
                    : ''
                }
                onChange={event => navigate(event.target.value || undefined)}
                className="h-9 max-w-40 rounded-md border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-56"
              >
                <option value="">{t('Your courses')}</option>
                {courses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            )}
            {selectedId && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate()}
              >
                <IconPlus className="size-4" aria-hidden />
                {t('New course')}
              </Button>
            )}
          </div>
        </header>
        {listError && (
          <div
            role="alert"
            className="my-4 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <span>{t(listError)}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setListRefresh(value => value + 1)}
            >
              {t('Retry')}
            </Button>
          </div>
        )}
        {courseError && (
          <div
            role="alert"
            className="my-4 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <span>{t(courseError)}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCourseRefresh(value => value + 1)}
            >
              {t('Refresh')}
            </Button>
          </div>
        )}
        {loadingCourse ? (
          <div
            className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <IconLoader2
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            {t('Loading your course…')}
          </div>
        ) : !selectedId ? (
          <>
            <NewCourseForm
              capabilities={capabilities}
              onCreateFailed={() => setListRefresh(value => value + 1)}
              onCreated={next => {
                setCourses(current => [
                  next,
                  ...current.filter(item => item.id !== next.id)
                ])
                navigate(next.id)
              }}
            />
            {loadingList && (
              <p
                role="status"
                className="pb-8 text-center text-sm text-muted-foreground"
              >
                {t('Loading your courses…')}
              </p>
            )}
            {courses.length > 0 && (
              <section
                className="mx-auto mb-12 w-full max-w-2xl border-t pt-6"
                aria-labelledby="tutor-courses-title"
              >
                <h2
                  id="tutor-courses-title"
                  className="mb-4 text-sm font-medium"
                >
                  {t('Continue learning')}
                </h2>
                <div className="space-y-2">
                  {courses.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <IconBook2
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {t(stageLabels[item.stage])} ·{' '}
                          {new Date(item.createdAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <IconChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : course ? (
          course.status !== 'ready' ? (
            <section
              className="mx-auto max-w-xl py-12 md:py-20"
              aria-labelledby="tutor-processing-title"
            >
              <Button
                variant="ghost"
                size="sm"
                className="mb-6 -ml-3 gap-2"
                onClick={() => navigate()}
              >
                <IconArrowLeft className="size-4" />
                {t('All courses')}
              </Button>
              <h1
                id="tutor-processing-title"
                className="mb-2 text-2xl font-medium tracking-tight"
              >
                {course.title}
              </h1>
              <p className="mb-7 text-sm leading-6 text-muted-foreground">
                {course.goal}
              </p>
              <div className="rounded-2xl border p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p
                    className="flex items-center gap-2 text-sm font-medium"
                    role="status"
                  >
                    {course.status !== 'failed' && (
                      <IconLoader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                    )}
                    {t(stageLabels[course.stage])}
                  </p>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(course.processingProgress)}%
                  </span>
                </div>
                <ProgressMeter
                  value={course.processingProgress}
                  label={t('Material processing progress')}
                />
                <ol className="mt-6 space-y-4">
                  {(['parsing', 'indexing', 'planning'] as const).map(
                    (stage, index) => {
                      const currentStage = [
                        'queued',
                        'parsing',
                        'indexing',
                        'planning',
                        'ready'
                      ].indexOf(course.stage)
                      const complete = currentStage > index + 1
                      return (
                        <li
                          key={stage}
                          className={cn(
                            'flex items-center gap-3 text-sm',
                            course.stage === stage
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          <span className="flex size-6 items-center justify-center rounded-full border text-xs">
                            {complete ? (
                              <IconCheck className="size-3.5" aria-hidden />
                            ) : (
                              index + 1
                            )}
                          </span>
                          {t(stageLabels[stage])}
                        </li>
                      )
                    }
                  )}
                </ol>
                {course.status === 'failed' ? (
                  <div className="mt-6 space-y-4">
                    <p role="alert" className="text-sm text-destructive">
                      {t(
                        course.error ||
                          'Your course could not be prepared. Please try again.'
                      )}
                    </p>
                    <Button
                      onClick={() => void retry()}
                      disabled={retrying}
                      variant="outline"
                      className="gap-2 rounded-full"
                    >
                      <IconRefresh
                        className={cn(
                          'size-4',
                          retrying && 'animate-spin motion-reduce:animate-none'
                        )}
                      />
                      {t('Retry preparation')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                    {t('You can leave this page and return when it is ready.')}
                  </p>
                )}
              </div>
              <TutorDocumentList documents={course.documents} />
            </section>
          ) : (
            <div className="grid items-start gap-6 py-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 md:py-8">
              <aside
                className="min-w-0 md:sticky md:top-6"
                aria-label={t('Learning path')}
              >
                <h1 className="mb-2 text-base font-medium leading-snug">
                  {course.title}
                </h1>
                <p className="mb-5 line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {course.goal}
                </p>
                {course.locale !== locale && (
                  <p className="mb-4 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                    {t(
                      'This course keeps the language it was created in. New courses use your selected language.'
                    )}
                  </p>
                )}
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {t('Learning path')}
                </h2>
                <nav
                  className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible"
                  aria-label={t('Chapters')}
                >
                  {course.chapters.map(chapter => (
                    <button
                      key={chapter.id}
                      type="button"
                      aria-current={
                        chapter.id === chapterId ? 'step' : undefined
                      }
                      onClick={() => {
                        setChapterId(chapter.id)
                        setSource(null)
                      }}
                      className={cn(
                        'w-52 shrink-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full',
                        chapter.id === chapterId
                          ? 'border-foreground/30 bg-muted/60'
                          : 'border-transparent hover:bg-muted/30'
                      )}
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
                          {String(chapter.position + 1).padStart(2, '0')}
                        </span>
                        <span className="line-clamp-2 text-sm font-medium leading-5">
                          {chapter.title}
                        </span>
                      </div>
                      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t(
                            chapter.status === 'generating'
                              ? 'Preparing…'
                              : chapter.status === 'failed'
                                ? 'Needs attention'
                                : 'Mastery'
                          )}
                        </span>
                        <span className="tabular-nums">
                          {Math.round(chapter.mastery)}%
                        </span>
                      </div>
                      <ProgressMeter
                        value={chapter.mastery}
                        label={t('Mastery for {chapter}', {
                          chapter: chapter.title
                        })}
                      />
                    </button>
                  ))}
                </nav>
                <div className="mt-4 border-t pt-1">
                  <TutorDocumentList documents={course.documents} />
                </div>
              </aside>
              <div className="min-w-0">
                {activeChapter ? (
                  <ChapterLesson
                    key={activeChapter.id}
                    userId={userId}
                    courseId={course.id}
                    chapter={activeChapter}
                    onChapter={updateChapter}
                    onSource={setSource}
                  />
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">
                    {t('Select a chapter to begin.')}
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          !courseError && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('Select a course to continue learning.')}
            </div>
          )
        )}
      </div>
      {source && (
        <SourceViewer
          key={`${source.documentId}:${source.id}`}
          source={source}
          onClose={() => setSource(null)}
        />
      )}
    </div>
  )
}
