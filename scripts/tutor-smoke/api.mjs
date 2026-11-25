/** Run only against the fixed isolated smoke server, with the test double running. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

import { createFixturePdf } from './fixture.mjs'

const base = 'http://127.0.0.1:3002'
const output = '.tmp/tutor-smoke'
await mkdir(output, { recursive: true })
assert.equal(
  (await (await fetch('http://127.0.0.1:3106/health')).json()).testDouble,
  true
)
const started = Date.now()
const checks = []
async function request(route, options = {}) {
  const response = await fetch(`${base}/api/tutor${route}`, {
    ...options,
    headers: {
      'x-morphic-locale': 'en',
      Origin: base,
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  })
  const data = await response.json()
  assert.ok(response.ok, `${route}: ${response.status} ${data.error ?? ''}`)
  return data
}
async function waitCourse(id, predicate) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const { course } = await request(`/courses/${id}`)
    assert.notEqual(course.status, 'failed', course.error)
    assert.ok(
      course.chapters.every(chapter => chapter.status !== 'failed'),
      JSON.stringify(course.chapters.map(chapter => chapter.error))
    )
    if (predicate(course)) return course
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Timed out waiting for isolated worker')
}
const initial = await request('/courses')
assert.equal(
  initial.capabilities.ready,
  true,
  initial.capabilities.missing.join(', ')
)
const pdf = createFixturePdf()
await writeFile(`${output}/transactions.pdf`, pdf)
const form = new FormData()
form.set(
  'file',
  new Blob([pdf], { type: 'application/pdf' }),
  'transactions.pdf'
)
const { document } = await request('/documents', { method: 'POST', body: form })
checks.push('Real PDF upload accepted')
const { course: created } = await request('/courses', {
  method: 'POST',
  body: JSON.stringify({
    documentIds: [document.id],
    goal: 'Explain atomic transfers and rollback using the supplied PDF.',
    level: 'beginner',
    locale: 'en'
  })
})
let course = await waitCourse(created.id, value => value.status === 'ready')
assert.ok(course.chapters.length)
assert.equal(course.documents[0].pageCount, 1)
checks.push(
  'PDF parsed, chunks embedded, pgvector indexed, worker produced course'
)
const chapterId = course.chapters[0].id
await request(`/courses/${course.id}/chapters/${chapterId}/generate`, {
  method: 'POST'
})
course = await waitCourse(
  course.id,
  value => value.chapters[0].status === 'ready'
)
let chapter = course.chapters[0]
assert.equal(chapter.questions.length, chapter.knowledgePoints.length * 2)
assert.ok(
  chapter.content.concepts.length &&
    chapter.content.examples.length &&
    chapter.content.sources.length
)
assert.ok(
  chapter.questions.every(
    question => !('referenceAnswer' in question) && !('rubric' in question)
  )
)
assert.ok(
  chapter.content.sources.every(source =>
    source.regions.every(
      region =>
        region.page >= 1 &&
        region.x >= 0 &&
        region.y >= 0 &&
        region.width > 0 &&
        region.height > 0
    )
  )
)
checks.push(
  'Hybrid retrieval produced grounded lesson and normalized PDF regions; public DTO excludes answer keys'
)
const answers = `/courses/${course.id}/chapters/${chapterId}/answers`
const attempt = {
  questionId: chapter.questions[0].id,
  answer:
    'Roll back the entire transfer when either operation fails. Commit after both succeed.',
  attemptId: randomUUID()
}
const first = await request(answers, {
  method: 'POST',
  body: JSON.stringify(attempt)
})
assert.equal(first.assessment.score, 80)
assert.equal(first.chapter.mastery, 40)
const duplicate = await request(answers, {
  method: 'POST',
  body: JSON.stringify(attempt)
})
assert.equal(duplicate.assessment.id, first.assessment.id)
assert.equal(duplicate.chapter.latestAttempts.length, 1)
const second = await request(answers, {
  method: 'POST',
  body: JSON.stringify({
    ...attempt,
    questionId: chapter.questions[1].id,
    attemptId: randomUUID()
  })
})
assert.equal(second.chapter.mastery, 80)
const lower = await request(answers, {
  method: 'POST',
  body: JSON.stringify({
    ...attempt,
    answer: 'I do not know.',
    attemptId: randomUUID()
  })
})
assert.equal(lower.chapter.mastery, 50)
checks.push(
  'Scores 80/80 => mastery80; latest20/80 => mastery50; retry is idempotent'
)
course = (await request(`/courses/${course.id}`)).course
assert.equal(course.chapters[0].mastery, 50)
assert.equal(course.chapters[0].latestAttempts.length, 2)
assert.ok(
  (await request('/courses')).courses.some(item => item.id === course.id)
)
checks.push('Course and latest assessments persist on fresh GET')
const file = await fetch(`${base}/api/tutor/documents/${document.id}/file`)
assert.equal(file.headers.get('content-type'), 'application/pdf')
assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf)
checks.push('Original source PDF returns exact uploaded bytes')
const result = {
  testDouble: true,
  startedAt: new Date(started).toISOString(),
  durationMs: Date.now() - started,
  courseId: course.id,
  documentId: document.id,
  chapterId,
  checks,
  provider: await (await fetch('http://127.0.0.1:3106/health')).json()
}
await writeFile(`${output}/api-result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
