import { createHash, randomUUID } from 'node:crypto'
import { createClient } from 'redis'

import { TutorError } from './errors'
let connection: ReturnType<typeof createClient> | undefined
let connecting: Promise<unknown> | undefined

async function getConnection() {
  if (!connection) {
    const url =
      process.env.TUTOR_REDIS_URL ||
      process.env.LOCAL_REDIS_URL ||
      process.env.REDIS_URL
    if (!url) throw new Error('Assessment queue is not configured')
    connection = createClient({
      url,
      socket: { connectTimeout: 5000, reconnectStrategy: false }
    })
    connection.on('error', () =>
      console.warn('[Tutor] Assessment lock connection unavailable')
    )
  }
  if (!connection.isOpen) {
    connecting ??= connection.connect().finally(() => {
      connecting = undefined
    })
    await connecting
  }
  return connection
}

/** Serialize one learner's submissions to a question across tabs and servers. */
export async function withAssessmentLock<T>(
  userId: string,
  questionId: string,
  operation: () => Promise<T>
): Promise<T> {
  const owner = createHash('sha256').update(userId).digest('hex')
  const key = `tutor:assessment:${owner}:${questionId}`
  const token = randomUUID()
  let client
  try {
    client = await getConnection()
    const acquired = await client.set(key, token, { PX: 360_000, NX: true })
    if (!acquired)
      throw new TutorError(
        'This answer is already being assessed. Please retry shortly.',
        'ASSESSMENT_IN_PROGRESS',
        409
      )
  } catch (error) {
    if (error instanceof TutorError) throw error
    throw new TutorError(
      'The assessment service is temporarily unavailable. Please retry.',
      'ASSESSMENT_UNAVAILABLE',
      503
    )
  }
  try {
    return await operation()
  } finally {
    // Never release a lease acquired by another request after this one's expiry.
    await client
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [key], arguments: [token] }
      )
      .catch(() => {
        console.warn('[Tutor] Assessment lease will expire automatically')
      })
  }
}
