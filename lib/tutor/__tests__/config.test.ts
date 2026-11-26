import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/storage/r2-client', () => ({
  isObjectStorageConfigured: () => false
}))
vi.mock('@/lib/utils/registry', () => ({
  isProviderEnabled: () => true
}))

import { getTutorCapabilities } from '../config'

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://local/test')
  vi.stubEnv('TUTOR_STORAGE_DRIVER', 'local')
  vi.stubEnv('TUTOR_REDIS_URL', 'redis://localhost:6379')
  vi.stubEnv('TUTOR_MODEL', 'openai-compatible:test-model')
  vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'bearer')
  vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
  vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'false')
  vi.stubEnv('TUTOR_EMBEDDING_API_KEY', '')
  vi.stubEnv('OPENAI_API_KEY', '')
})

afterEach(() => vi.unstubAllEnvs())

describe('Tutor embedding readiness', () => {
  it('exposes the same runtime admission budgets used by the server', async () => {
    vi.stubEnv('TUTOR_MAX_FILES', '20')
    vi.stubEnv('TUTOR_MAX_FILE_SIZE_MB', '20')
    vi.stubEnv('TUTOR_MAX_COURSE_SIZE_MB', '200')
    vi.stubEnv('TUTOR_MAX_PDF_PAGES', '500')
    vi.stubEnv('TUTOR_MAX_COURSE_PAGES', '1000')
    vi.stubEnv('TUTOR_UPLOAD_CONCURRENCY', '3')
    expect(await getTutorCapabilities()).toMatchObject({
      maxFiles: 20,
      maxFileSize: 20 * 1024 * 1024,
      maxCourseSize: 200 * 1024 * 1024,
      maxPdfPages: 500,
      maxPages: 1000,
      uploadConcurrency: 3
    })
  })

  it('allows an explicitly keyless embedding service', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'http://tutor-embedding:11434/v1')
    expect(await getTutorCapabilities()).toMatchObject({
      ready: true,
      missing: []
    })
  })

  it('still reports missing credentials for a bearer-authenticated service', async () => {
    expect(await getTutorCapabilities()).toMatchObject({
      ready: false,
      missing: ['The embedding service is not configured.']
    })
  })

  it('reports an unconfigured keyless endpoint as a setup error', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', '')
    expect(await getTutorCapabilities()).toMatchObject({
      ready: false,
      missing: [
        'TUTOR_EMBEDDING_BASE_URL must be set when embedding authentication is disabled.'
      ]
    })
  })

  it('reports malformed embedding configuration without breaking the course list', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://local/test')
    vi.stubEnv('TUTOR_STORAGE_DRIVER', 'local')
    vi.stubEnv('TUTOR_REDIS_URL', 'redis://localhost:6379')
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', 'invalid')
    vi.stubEnv('TUTOR_MODEL', 'openai-compatible:test-model')
    expect(await getTutorCapabilities()).toMatchObject({
      ready: false,
      missing: [
        'TUTOR_EMBEDDING_DIMENSIONS must be a positive integer matching the embedding model.'
      ]
    })
  })
})
