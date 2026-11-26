import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TUTOR_LIMITS } from '../limits'
import { getTutorLimits, TUTOR_LIMITS } from '../server-limits'

afterEach(() => vi.unstubAllEnvs())

describe('Tutor resource policy', () => {
  it('publishes runtime overrides in bytes consistently', () => {
    vi.stubEnv('TUTOR_MAX_FILE_SIZE_MB', '12')
    vi.stubEnv('TUTOR_MAX_COURSE_SIZE_MB', '120')
    vi.stubEnv('TUTOR_MAX_FILES', '10')
    vi.stubEnv('TUTOR_MAX_PDF_PAGES', '300')
    vi.stubEnv('TUTOR_MAX_COURSE_PAGES', '600')
    expect(getTutorLimits()).toMatchObject({
      maxFileSize: 12 * 1024 * 1024,
      maxCourseSize: 120 * 1024 * 1024,
      maxFiles: 10,
      maxPdfPages: 300,
      maxPages: 600
    })
    expect(TUTOR_LIMITS.maxFileSize).toBe(12 * 1024 * 1024)
    vi.stubEnv('TUTOR_MAX_FILE_SIZE_MB', '8')
    expect(TUTOR_LIMITS.maxFileSize).toBe(8 * 1024 * 1024)
  })

  it.each(['', '0', '-1', '1.5', 'NaN', 'Infinity', '1000000000'])(
    'keeps malformed or unsafe limits bounded: %s',
    value => {
      vi.stubEnv('TUTOR_MAX_FILE_SIZE_MB', value)
      vi.stubEnv('TUTOR_MAX_FILES', value)
      vi.stubEnv('TUTOR_PARSE_MEMORY_MB', value)
      expect(TUTOR_LIMITS.maxFileSize).toBe(DEFAULT_TUTOR_LIMITS.maxFileSize)
      expect(TUTOR_LIMITS.maxFiles).toBe(DEFAULT_TUTOR_LIMITS.maxFiles)
      expect(TUTOR_LIMITS.parseMemoryMb).toBe(
        DEFAULT_TUTOR_LIMITS.parseMemoryMb
      )
    }
  )

  it('limits browser parallelism independently of file count', () => {
    vi.stubEnv('TUTOR_MAX_FILES', '50')
    vi.stubEnv('TUTOR_UPLOAD_CONCURRENCY', '2')
    expect(TUTOR_LIMITS.maxFiles).toBe(50)
    expect(TUTOR_LIMITS.uploadConcurrency).toBe(2)
    vi.stubEnv('TUTOR_UPLOAD_CONCURRENCY', '50')
    expect(TUTOR_LIMITS.uploadConcurrency).toBe(3)
  })
})
