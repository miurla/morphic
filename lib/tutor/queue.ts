import { Queue } from 'bullmq'

export const TUTOR_QUEUE_NAME = 'morphic-tutor'
export type TutorJob = { userId: string; courseId: string; chapterId?: string }

export function getTutorQueueConnection() {
  const raw =
    process.env.TUTOR_REDIS_URL ||
    process.env.LOCAL_REDIS_URL ||
    process.env.REDIS_URL
  if (!raw) throw new Error('Tutor queue is not configured')
  const url = new URL(raw)
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:')
    throw new Error('Tutor requires a Redis TCP connection')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 5000,
    maxRetriesPerRequest: null
  }
}

let queue: Queue<TutorJob> | undefined
export function getTutorQueue() {
  if (queue) return queue
  queue = new Queue<TutorJob>(TUTOR_QUEUE_NAME, {
    connection: {
      ...getTutorQueueConnection(),
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => (times < 3 ? times * 250 : null)
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 7 * 86400, count: 1000 }
    }
  })
  queue.on('error', () => {
    console.warn('[Tutor queue] Queue connection unavailable')
  })
  return queue
}

async function enqueue(name: 'course' | 'chapter', data: TutorJob) {
  const activeQueue = getTutorQueue()
  try {
    const jobId = `${name}-${data.chapterId ?? data.courseId}`
    await activeQueue.waitUntilReady()
    const existing = await activeQueue.getJob(jobId)
    if (existing) {
      const state = await existing.getState()
      if (state === 'failed') {
        await existing.retry()
        return existing.id!
      }
      if (state !== 'completed') return existing.id!
      await existing.remove()
    }
    const job = await activeQueue.add(name, data, { jobId })
    return job.id!
  } catch (error) {
    // A producer that exhausted its initial connection retries is recreated on
    // the next request, so restoring Redis does not require restarting Next.js.
    if (queue === activeQueue) queue = undefined
    void activeQueue.disconnect().catch(() => {})
    throw error
  }
}

export const enqueueCourse = (input: { userId: string; courseId: string }) =>
  enqueue('course', input)
export const enqueueChapter = (input: {
  userId: string
  courseId: string
  chapterId: string
}) => enqueue('chapter', input)
