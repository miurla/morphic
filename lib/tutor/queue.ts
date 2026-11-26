import { Queue } from 'bullmq'

export const TUTOR_QUEUE_NAME = 'morphic-tutor'
export type TutorJob = {
  userId: string
  courseId?: string
  chapterId?: string
  documentId?: string
}

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

async function enqueue(name: 'course' | 'chapter' | 'parse', data: TutorJob) {
  const activeQueue = getTutorQueue()
  try {
    const jobId = `${name}-${data.documentId ?? data.chapterId ?? data.courseId}`
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
    const job = await activeQueue.add(name, data, {
      jobId,
      ...(name === 'parse' ? { attempts: 1 } : {})
    })
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
export const enqueueDocumentParse = (input: {
  userId: string
  documentId: string
}) => enqueue('parse', input)

/** Recovery for a worker crash before it could persist the terminal status.
 * Only expose state for the owned payload; Redis error details never escape.
 */
export async function getDocumentParseState(input: {
  userId: string
  documentId: string
}): Promise<'missing' | 'failed' | 'pending' | 'completed'> {
  const activeQueue = getTutorQueue()
  await activeQueue.waitUntilReady()
  const job = await activeQueue.getJob(`parse-${input.documentId}`)
  if (
    !job ||
    job.name !== 'parse' ||
    job.data?.userId !== input.userId ||
    job.data?.documentId !== input.documentId
  )
    return 'missing'
  const state = await job.getState()
  return state === 'failed' || state === 'completed' ? state : 'pending'
}
export const enqueueChapter = (input: {
  userId: string
  courseId: string
  chapterId: string
}) => enqueue('chapter', input)

/** Database deletion is authoritative; cleanup must never make it fail. */
export async function removeCourseJobs(input: {
  courseId: string
  chapterIds: string[]
}): Promise<void> {
  let cleanupQueue: Queue<TutorJob> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    // A separate connection can be disconnected on timeout without interrupting
    // other requests using the shared producer.
    cleanupQueue = new Queue<TutorJob>(TUTOR_QUEUE_NAME, {
      connection: {
        ...getTutorQueueConnection(),
        connectTimeout: 1000,
        commandTimeout: 1000,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null
      }
    })
    cleanupQueue.on('error', () => {})
    const activeQueue = cleanupQueue
    const cleanup = async () => {
      await activeQueue.waitUntilReady()
      const ids = [
        `course-${input.courseId}`,
        ...new Set(input.chapterIds.map(id => `chapter-${id}`))
      ]
      // remove returns 0 for locked jobs. Active workers check the database and
      // stop when their course/chapters no longer exist.
      const results = await Promise.allSettled(
        ids.map(id => activeQueue.remove(id))
      )
      if (results.some(result => result.status === 'rejected'))
        console.warn('[Tutor queue] Deleted course cleanup incomplete')
    }
    await Promise.race([
      cleanup(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Cleanup timed out')), 2000)
      })
    ])
  } catch {
    console.warn('[Tutor queue] Deleted course cleanup unavailable')
  } finally {
    if (timeout) clearTimeout(timeout)
    if (cleanupQueue) void cleanupQueue.disconnect().catch(() => {})
  }
}
