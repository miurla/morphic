import { loadEnvConfig } from '@next/env'
import { Worker } from 'bullmq'

loadEnvConfig(process.cwd())

async function start() {
  // Load application modules only after the same env files as Next.js.
  const { requireTutorReady } = await import('../lib/tutor/config')
  const { getTutorQueueConnection, TUTOR_QUEUE_NAME } = await import(
    '../lib/tutor/queue'
  )
  const { processCourse, processChapter } = await import('../lib/tutor/service')
  const { processDocumentParse } = await import('../lib/tutor/preparation')
  await requireTutorReady()
  const worker = new Worker(
    TUTOR_QUEUE_NAME,
    async job => {
      if (!job.data?.userId) throw new Error('Invalid Tutor job')
      if (job.name === 'parse' && job.data.documentId)
        return processDocumentParse(job.data)
      if (!job.data.courseId) throw new Error('Invalid Tutor job')
      if (job.name === 'course') return processCourse(job.data)
      if (job.name === 'chapter' && job.data.chapterId)
        return processChapter(job.data)
      throw new Error('Unknown Tutor job type')
    },
    {
      connection: getTutorQueueConnection(),
      concurrency: Math.max(
        1,
        Math.min(4, Number(process.env.TUTOR_WORKER_CONCURRENCY) || 2)
      ),
      lockDuration: 240_000,
      maxStalledCount: 1
    }
  )
  worker.on('completed', job =>
    console.info('[Tutor worker] Completed', { id: job.id, task: job.name })
  )
  worker.on('failed', (job, error) =>
    console.error('[Tutor worker] Failed', {
      id: job?.id,
      task: job?.name,
      kind: error.name
    })
  )
  worker.on('error', error =>
    console.error('[Tutor worker] Queue error', { kind: error.name })
  )
  await worker.waitUntilReady()
  console.info('[Tutor worker] Ready')
  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    await worker.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch(error => {
  console.error(
    '[Tutor worker] Unable to start:',
    error instanceof Error ? error.message : 'Unknown error'
  )
  process.exit(1)
})
