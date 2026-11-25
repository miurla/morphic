export const DEFAULT_EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_BATCH_SIZE = 32
const DEFAULT_EMBEDDING_TIMEOUT_MS = 45_000
const MAX_RETRIES = 2

export interface EmbeddingConfig {
  auth: 'bearer' | 'none'
  apiKey: string
  baseUrl: string
  model: string
  dimensions: number
  sendDimensions: boolean
  batchSize: number
  timeoutMs: number
}

function readRequestLimit(name: string, fallback: number, maximum: number) {
  const raw = process.env[name]?.trim()
  const value = raw ? Number(raw) : fallback
  if (
    (raw && !/^\d+$/.test(raw)) ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  )
    throw new EmbeddingError(
      'EMBEDDING_INVALID_CONFIG',
      `${name} must be an integer between 1 and ${maximum}.`
    )
  return value
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const auth = process.env.TUTOR_EMBEDDING_AUTH?.trim() || 'bearer'
  if (auth !== 'bearer' && auth !== 'none')
    throw new EmbeddingError(
      'EMBEDDING_INVALID_CONFIG',
      'TUTOR_EMBEDDING_AUTH must be bearer or none.'
    )
  const dedicatedBaseUrl = process.env.TUTOR_EMBEDDING_BASE_URL?.trim()
  if (auth === 'none' && !dedicatedBaseUrl)
    throw new EmbeddingError(
      'EMBEDDING_INVALID_CONFIG',
      'TUTOR_EMBEDDING_BASE_URL must be set when embedding authentication is disabled.'
    )
  const rawDimensions = process.env.TUTOR_EMBEDDING_DIMENSIONS?.trim()
  const dimensions = rawDimensions
    ? Number(rawDimensions)
    : DEFAULT_EMBEDDING_DIMENSIONS
  if (
    (rawDimensions && !/^\d+$/.test(rawDimensions)) ||
    !Number.isSafeInteger(dimensions) ||
    dimensions < 1
  )
    throw new EmbeddingError(
      'EMBEDDING_INVALID_CONFIG',
      'TUTOR_EMBEDDING_DIMENSIONS must be a positive integer matching the embedding model.'
    )
  const sendDimensions =
    process.env.TUTOR_EMBEDDING_SEND_DIMENSIONS?.trim() || 'true'
  if (sendDimensions !== 'true' && sendDimensions !== 'false')
    throw new EmbeddingError(
      'EMBEDDING_INVALID_CONFIG',
      'TUTOR_EMBEDDING_SEND_DIMENSIONS must be true or false.'
    )
  return {
    auth,
    apiKey:
      auth === 'none'
        ? ''
        : process.env.TUTOR_EMBEDDING_API_KEY?.trim() ||
          process.env.OPENAI_API_KEY?.trim() ||
          '',
    baseUrl: (
      dedicatedBaseUrl ||
      process.env.OPENAI_BASE_URL?.trim() ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, ''),
    model:
      process.env.TUTOR_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
    dimensions,
    sendDimensions: sendDimensions === 'true',
    batchSize: readRequestLimit(
      'TUTOR_EMBEDDING_BATCH_SIZE',
      EMBEDDING_BATCH_SIZE,
      128
    ),
    timeoutMs: readRequestLimit(
      'TUTOR_EMBEDDING_TIMEOUT_MS',
      DEFAULT_EMBEDDING_TIMEOUT_MS,
      // Node timers overflow above this value and become near-immediate.
      2_147_483_647
    )
  }
}

/** Credentials can rotate without invalidation; provider/vector-space changes
 * cannot. Revision lets self-hosted models invalidate an unchanged model name. */
export function getEmbeddingIndexKey(): string {
  const config = getEmbeddingConfig()
  const identity = JSON.stringify({
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
    revision: process.env.TUTOR_EMBEDDING_REVISION?.trim() || '1'
  })
  return `${config.model}@${createHash('sha256').update(identity).digest('hex').slice(0, 20)}`
}

export class EmbeddingError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

interface EmbeddingResponse {
  data: { index: number; embedding: number[] }[]
}

/** Validate remote responses: wrong dimensions or order must never reach PG. */
export function validateEmbeddingResponse(
  value: unknown,
  count: number,
  dimensions: number
): number[][] {
  const response = value as Partial<EmbeddingResponse> | null
  if (
    !response ||
    !Array.isArray(response.data) ||
    response.data.length !== count
  ) {
    throw new EmbeddingError(
      'EMBEDDING_INVALID_RESPONSE',
      'The embedding service returned an invalid response.'
    )
  }
  const result: number[][] = new Array(count)
  for (const item of response.data) {
    if (
      !item ||
      !Number.isInteger(item.index) ||
      item.index < 0 ||
      item.index >= count ||
      result[item.index] ||
      !Array.isArray(item.embedding) ||
      item.embedding.length !== dimensions ||
      !item.embedding.every(
        value => typeof value === 'number' && Number.isFinite(value)
      ) ||
      item.embedding.every(value => value === 0)
    ) {
      throw new EmbeddingError(
        'EMBEDDING_INVALID_RESPONSE',
        'The embedding service returned invalid vectors. Check the configured model and dimensions.'
      )
    }
    result[item.index] = item.embedding
  }
  return result
}

async function embedBatch(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          ...(config.auth === 'bearer'
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
          ...(config.sendDimensions ? { dimensions: config.dimensions } : {}),
          encoding_format: 'float'
        }),
        signal: AbortSignal.timeout(config.timeoutMs)
      })
      if (!response.ok) {
        // Do not expose provider bodies: they may include credentials or input.
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_RETRIES
        ) {
          await response.body?.cancel()
          await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
          continue
        }
        await response.body?.cancel()
        throw new EmbeddingError(
          'EMBEDDING_REQUEST_FAILED',
          'The embedding service rejected the request. Check the model configuration or try again later.'
        )
      }
      return validateEmbeddingResponse(
        await response.json(),
        texts.length,
        config.dimensions
      )
    } catch (error) {
      if (error instanceof EmbeddingError) throw error
      if (attempt === MAX_RETRIES) {
        throw new EmbeddingError(
          'EMBEDDING_UNAVAILABLE',
          'The embedding service is unavailable. Try again later.'
        )
      }
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw new EmbeddingError(
    'EMBEDDING_UNAVAILABLE',
    'The embedding service is unavailable. Try again later.'
  )
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []
  if (texts.some(text => !text.trim()))
    throw new EmbeddingError(
      'EMBEDDING_EMPTY_INPUT',
      'Cannot embed empty text.'
    )
  const config = getEmbeddingConfig()
  if (config.auth === 'bearer' && !config.apiKey)
    throw new EmbeddingError(
      'EMBEDDING_NOT_CONFIGURED',
      'The embedding service is not configured.'
    )
  const vectors: number[][] = []
  for (let index = 0; index < texts.length; index += config.batchSize) {
    vectors.push(
      ...(await embedBatch(
        texts.slice(index, index + config.batchSize),
        config
      ))
    )
  }
  return vectors
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0]
}
import { createHash } from 'node:crypto'
