'use client'

import { useEffect, useRef, useState } from 'react'

import {
  IconArrowRight,
  IconBook2,
  IconFileText,
  IconLoader2
} from '@tabler/icons-react'

import { getTutorDocumentFormat } from '@/lib/tutor/document-formats'
import type {
  SourceCitation,
  TutorAssessment,
  TutorChapter,
  TutorQuestion
} from '@/lib/tutor/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { useI18n } from '@/components/language-provider'
import { MarkdownMessage } from '@/components/message'

import { errorMessage, tutorRequest } from './api'
import { ProgressMeter } from './progress-meter'

function SourceLinks({
  ids,
  sources,
  onSource
}: {
  ids: string[]
  sources: SourceCitation[]
  onSource: (source: SourceCitation) => void
}) {
  const { t } = useI18n()
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources
        .filter(source => ids.includes(source.id))
        .map(source => (
          <button
            key={source.id}
            type="button"
            onClick={() => onSource(source)}
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border bg-muted/30 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconFileText className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{source.filename}</span>
            {getTutorDocumentFormat(source.filename) === 'pdf' && (
              <span className="shrink-0">
                {t('p. {page}', { page: source.regions[0]?.page ?? 1 })}
              </span>
            )}
          </button>
        ))}
    </div>
  )
}

export function ChapterLesson({
  userId,
  courseId,
  chapter,
  onChapter,
  onSource
}: {
  userId: string
  courseId: string
  chapter: TutorChapter
  onChapter: (chapter: TutorChapter) => void
  onSource: (source: SourceCitation) => void
}) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<'learn' | 'practice'>('learn')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    try {
      const result = await tutorRequest<{ chapter: TutorChapter }>(
        `/api/tutor/courses/${courseId}/chapters/${chapter.id}/generate`,
        locale,
        { method: 'POST' }
      )
      onChapter(result.chapter)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const sources = chapter.content?.sources ?? []
  return (
    <article
      className="mx-auto w-full max-w-3xl px-1 pb-12"
      aria-labelledby="tutor-chapter-title"
    >
      <div className="mb-7">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t('Chapter {number}', { number: chapter.position + 1 })}
        </p>
        <h2
          id="tutor-chapter-title"
          className="mb-3 text-2xl font-medium tracking-tight md:text-3xl"
        >
          {chapter.title}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {chapter.summary}
        </p>
        <div className="mt-5 max-w-sm">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span>{t('Chapter mastery')}</span>
            <span className="font-medium tabular-nums">
              {Math.round(chapter.mastery)}%
            </span>
          </div>
          <ProgressMeter value={chapter.mastery} label={t('Chapter mastery')} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t(
            'Based on your latest assessed answers. Untested knowledge points count as zero.'
          )}
        </p>
      </div>
      {chapter.objectives.length > 0 && (
        <div className="mb-7 rounded-xl border bg-muted/20 p-4">
          <h3 className="mb-2 text-sm font-medium">
            {t('What you will learn')}
          </h3>
          <ul className="space-y-1.5 pl-4 text-sm leading-6 text-muted-foreground list-disc">
            {chapter.objectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </ul>
        </div>
      )}
      {chapter.status !== 'ready' && (
        <div className="rounded-2xl border border-dashed p-7 text-center">
          {chapter.status === 'generating' ? (
            <>
              <IconLoader2
                className="mx-auto mb-3 size-6 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              <p role="status" className="text-sm">
                {t('Preparing this chapter from your materials…')}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('You can leave this page and return when it is ready.')}
              </p>
            </>
          ) : (
            <>
              <IconBook2
                className="mx-auto mb-3 size-6 text-muted-foreground"
                aria-hidden
              />
              <p className="mb-4 text-sm text-muted-foreground">
                {chapter.status === 'failed'
                  ? t(
                      chapter.error ||
                        'This chapter could not be prepared. Please try again.'
                    )
                  : t(
                      'Ready when you are. Generate the explanations, examples, and practice for this chapter.'
                    )}
              </p>
              <Button
                disabled={busy}
                onClick={() => void generate()}
                className="gap-2 rounded-full"
              >
                {busy ? (
                  <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <IconArrowRight className="size-4" />
                )}
                {t(
                  chapter.status === 'failed'
                    ? 'Retry chapter'
                    : 'Start this chapter'
                )}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {t(error)}
            </p>
          )}
        </div>
      )}
      {chapter.status === 'ready' && chapter.content && (
        <>
          <div
            className="mb-7 flex gap-6 border-b"
            role="tablist"
            aria-label={t('Chapter sections')}
          >
            {(['learn', 'practice'] as const).map(value => (
              <button
                key={value}
                id={`tutor-tab-${value}`}
                role="tab"
                type="button"
                aria-selected={tab === value}
                aria-controls={`tutor-panel-${value}`}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={event => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                      event.key
                    )
                  )
                    return
                  event.preventDefault()
                  const next =
                    event.key === 'Home'
                      ? 'learn'
                      : event.key === 'End'
                        ? 'practice'
                        : value === 'learn'
                          ? 'practice'
                          : 'learn'
                  setTab(next)
                  document.getElementById(`tutor-tab-${next}`)?.focus()
                }}
                className={cn(
                  'min-h-11 border-b-2 px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  tab === value
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t(value === 'learn' ? 'Learn' : 'Practice')}
                {value === 'practice' && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {chapter.questions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`tutor-panel-${tab}`}
            aria-labelledby={`tutor-tab-${tab}`}
          >
            {tab === 'learn' ? (
              <div className="space-y-9">
                <section>
                  <h3 className="mb-5 text-base font-medium">
                    {t('Concepts')}
                  </h3>
                  <div className="space-y-7">
                    {chapter.content.concepts.map((concept, index) => (
                      <section key={index}>
                        <h4 className="mb-3 font-medium">{concept.title}</h4>
                        <MarkdownMessage
                          message={concept.explanation}
                          drafts={false}
                        />
                        <SourceLinks
                          ids={concept.sourceIds}
                          sources={sources}
                          onSource={onSource}
                        />
                      </section>
                    ))}
                  </div>
                </section>
                <section className="border-t pt-7">
                  <h3 className="mb-1 text-base font-medium">
                    {t('Worked examples')}
                  </h3>
                  <p className="mb-5 text-xs text-muted-foreground">
                    {t('Examples are generated to explain the cited material.')}
                  </p>
                  <div className="space-y-6">
                    {chapter.content.examples.map((example, index) => (
                      <section
                        key={index}
                        className="rounded-xl border bg-muted/15 p-5"
                      >
                        <h4 className="mb-3 font-medium">{example.title}</h4>
                        <MarkdownMessage
                          message={example.explanation}
                          drafts={false}
                        />
                        <SourceLinks
                          ids={example.sourceIds}
                          sources={sources}
                          onSource={onSource}
                        />
                      </section>
                    ))}
                  </div>
                </section>
                <Button
                  onClick={() => setTab('practice')}
                  className="gap-2 rounded-full"
                >
                  {t('Put it into practice')}
                  <IconArrowRight className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Explain your thinking in your own words. Your feedback will include the evidence and scoring criteria.'
                  )}
                </p>
                {chapter.questions.map((question, index) => (
                  <AnswerForm
                    key={question.id}
                    userId={userId}
                    courseId={courseId}
                    chapterId={chapter.id}
                    question={question}
                    number={index + 1}
                    assessment={chapter.latestAttempts.find(
                      attempt => attempt.questionId === question.id
                    )}
                    sources={sources}
                    onChapter={onChapter}
                    onSource={onSource}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}

function AnswerForm({
  userId,
  courseId,
  chapterId,
  question,
  number,
  assessment,
  sources,
  onChapter,
  onSource
}: {
  userId: string
  courseId: string
  chapterId: string
  question: TutorQuestion
  number: number
  assessment?: TutorAssessment
  sources: SourceCitation[]
  onChapter: (chapter: TutorChapter) => void
  onSource: (source: SourceCitation) => void
}) {
  const { t, locale } = useI18n()
  const storageKey = `tutor-draft:${userId}:${courseId}:${question.id}`
  const [answer, setAnswer] = useState(assessment?.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef<{ answer: string; id: string } | null>(null)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const draft = JSON.parse(saved)
        if (typeof draft.answer === 'string') {
          setAnswer(draft.answer)
          if (typeof draft.id === 'string') requestRef.current = draft
        }
      }
    } catch {
      /* Storage may be disabled; answers still remain in component state. */
    }
  }, [storageKey])

  function edit(value: string) {
    setAnswer(value)
    requestRef.current = null
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ answer: value }))
    } catch {
      /* Best-effort draft persistence. */
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !answer.trim()) return
    setBusy(true)
    setError('')
    const request =
      requestRef.current?.answer === answer
        ? requestRef.current
        : { answer, id: crypto.randomUUID() }
    requestRef.current = request
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(request))
    } catch {
      /* Keep the request ID in memory. */
    }
    try {
      const result = await tutorRequest<{
        assessment: TutorAssessment
        chapter: TutorChapter
      }>(
        `/api/tutor/courses/${courseId}/chapters/${chapterId}/answers`,
        locale,
        {
          method: 'POST',
          body: JSON.stringify({
            questionId: question.id,
            answer,
            attemptId: request.id
          })
        }
      )
      onChapter(result.chapter)
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* No storage access is required to submit. */
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('Question {number}', { number })}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
          {t(question.kind === 'practice' ? 'Application' : 'Understanding')}
        </span>
      </div>
      <MarkdownMessage message={question.prompt} drafts={false} />
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="sr-only" htmlFor={`answer-${question.id}`}>
          {t('Your answer to question {number}', { number })}
        </label>
        <Textarea
          id={`answer-${question.id}`}
          value={answer}
          onChange={event => edit(event.target.value)}
          rows={5}
          maxLength={12000}
          disabled={busy}
          required
          placeholder={t('Write your answer and reasoning…')}
          className="text-base md:text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {t('Your draft is kept in this tab.')}
          </span>
          <Button
            type="submit"
            disabled={busy || !answer.trim()}
            variant="outline"
            className="gap-2 rounded-full"
          >
            {busy && (
              <IconLoader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            )}
            {t(
              busy
                ? 'Assessing…'
                : assessment
                  ? 'Submit a new answer'
                  : 'Check my answer'
            )}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </form>
      {assessment && (
        <div
          className="mt-5 space-y-4 rounded-lg bg-muted/40 p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t('Latest feedback')}</h4>
            <span className="text-lg font-medium tabular-nums">
              {Math.round(assessment.score)}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                / 100
              </span>
            </span>
          </div>
          <MarkdownMessage message={assessment.feedback} drafts={false} />
          {assessment.strengths.length > 0 && (
            <div>
              <h5 className="mb-1 text-sm font-medium">
                {t('What you did well')}
              </h5>
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {assessment.strengths.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {assessment.improvements.length > 0 && (
            <div>
              <h5 className="mb-1 text-sm font-medium">
                {t('What to work on')}
              </h5>
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {assessment.improvements.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              {t('How this was scored')}
            </summary>
            <ul className="mt-3 space-y-3">
              {assessment.criteria.map((criterion, index) => (
                <li key={index}>
                  <div className="flex justify-between gap-3">
                    <span>{criterion.criterion}</span>
                    <span className="shrink-0 tabular-nums">
                      {criterion.score} / {criterion.maxScore}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {criterion.reason}
                  </p>
                </li>
              ))}
            </ul>
          </details>
          <SourceLinks
            ids={assessment.sourceIds}
            sources={sources}
            onSource={onSource}
          />
        </div>
      )}
    </section>
  )
}
