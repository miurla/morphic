export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_BATCH_SIZE = 32
const MAX_RETRIES = 2

export interface EmbeddingConfig {
  apiKey: string
  baseUrl: string
  model: string
  dimensions: number
}

export function getEmbeddingConfig(): EmbeddingConfig {
  return {
    apiKey:
      process.env.TUTOR_EMBEDDING_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      '',
    baseUrl: (
      process.env.TUTOR_EMBEDDING_BASE_URL?.trim() ||
      process.env.OPENAI_BASE_URL?.trim() ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, ''),
    model:
      process.env.TUTOR_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
    dimensions: EMBEDDING_DIMENSIONS
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
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
          dimensions: config.dimensions,
          encoding_format: 'float'
        }),
        signal: AbortSignal.timeout(45_000)
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
  if (!config.apiKey)
    throw new EmbeddingError(
      'EMBEDDING_NOT_CONFIGURED',
      'The embedding service is not configured.'
    )
  const vectors: number[][] = []
  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    vectors.push(
      ...(await embedBatch(
        texts.slice(index, index + EMBEDDING_BATCH_SIZE),
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
