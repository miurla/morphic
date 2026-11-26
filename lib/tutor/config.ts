import { DEFAULT_MODEL } from '@/lib/config/default-model'
import { isObjectStorageConfigured } from '@/lib/storage/r2-client'
import { isProviderEnabled } from '@/lib/utils/registry'

import { EmbeddingError, getEmbeddingConfig } from './embeddings'
import { TutorError } from './errors'
import { TUTOR_LIMITS } from './server-limits'
import type { TutorCapabilities } from './types'

export { TUTOR_LIMITS } from './server-limits'

export function getTutorModelId(): string {
  const configured = process.env.TUTOR_MODEL?.trim()
  if (configured) {
    const provider = configured.split(':', 1)[0]
    if (!configured.includes(':') || !isProviderEnabled(provider)) {
      throw new TutorError(
        'The teaching model is not configured.',
        'MODEL_NOT_CONFIGURED',
        503
      )
    }
    return configured
  }
  const compatibleModel = process.env.OPENAI_COMPATIBLE_MODELS?.split(',')
    .map(value => value.trim())
    .find(Boolean)
  if (compatibleModel && isProviderEnabled('openai-compatible'))
    return `openai-compatible:${compatibleModel}`
  if (isProviderEnabled(DEFAULT_MODEL.providerId))
    return `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`
  throw new TutorError(
    'The teaching model is not configured.',
    'MODEL_NOT_CONFIGURED',
    503
  )
}

export async function getTutorCapabilities(): Promise<TutorCapabilities> {
  const missing: string[] = []
  if (
    !process.env.DATABASE_URL?.trim() &&
    !process.env.DATABASE_RESTRICTED_URL?.trim()
  )
    missing.push('The learning database is not configured.')
  if (
    !isObjectStorageConfigured() &&
    process.env.TUTOR_STORAGE_DRIVER !== 'local'
  )
    missing.push('File storage is not configured.')
  try {
    const embedding = getEmbeddingConfig()
    if (embedding.auth === 'bearer' && !embedding.apiKey)
      missing.push('The embedding service is not configured.')
  } catch (error) {
    if (!(error instanceof EmbeddingError)) throw error
    missing.push(error.message)
  }
  if (
    !(
      process.env.TUTOR_REDIS_URL?.trim() ||
      process.env.LOCAL_REDIS_URL?.trim() ||
      process.env.REDIS_URL?.trim()
    )
  )
    missing.push('The learning worker queue is not configured.')
  try {
    getTutorModelId()
  } catch {
    missing.push('The teaching model is not configured.')
  }
  return {
    ready: missing.length === 0,
    missing,
    maxFileSize: TUTOR_LIMITS.maxFileSize,
    maxFiles: TUTOR_LIMITS.maxFiles,
    maxCourseSize: TUTOR_LIMITS.maxCourseSize,
    maxPdfPages: TUTOR_LIMITS.maxPdfPages,
    maxPages: TUTOR_LIMITS.maxPages,
    maxDocumentTokens: TUTOR_LIMITS.maxDocumentTokens,
    maxCourseTokens: TUTOR_LIMITS.maxCourseTokens,
    maxDocumentChunks: TUTOR_LIMITS.maxDocumentChunks,
    maxCourseChunks: TUTOR_LIMITS.maxCourseChunks,
    uploadConcurrency: TUTOR_LIMITS.uploadConcurrency
  }
}

export async function requireTutorReady() {
  const capabilities = await getTutorCapabilities()
  if (!capabilities.ready)
    throw new TutorError(
      capabilities.missing.join(' '),
      'TUTOR_NOT_CONFIGURED',
      503
    )
}
