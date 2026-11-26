import { DEFAULT_TUTOR_LIMITS, type TutorLimits } from './limits'

// Invalid configuration falls back to bounded defaults. Upper bounds prevent an
// accidental unit error from turning an admission limit into an unlimited job.
const settings: Record<keyof TutorLimits, readonly [string, number, number]> = {
  maxFileSize: ['TUTOR_MAX_FILE_SIZE_MB', 1, 100],
  maxFiles: ['TUTOR_MAX_FILES', 1, 50],
  maxCourseSize: ['TUTOR_MAX_COURSE_SIZE_MB', 1, 1024],
  maxPdfPages: ['TUTOR_MAX_PDF_PAGES', 1, 2000],
  maxPages: ['TUTOR_MAX_COURSE_PAGES', 1, 5000],
  maxTextCharacters: ['TUTOR_MAX_TEXT_CHARACTERS', 1, 5_000_000],
  maxDocumentTokens: ['TUTOR_MAX_DOCUMENT_TOKENS', 1, 1_000_000],
  maxCourseTokens: ['TUTOR_MAX_COURSE_TOKENS', 1, 2_000_000],
  maxDocumentChunks: ['TUTOR_MAX_DOCUMENT_CHUNKS', 1, 10_000],
  maxCourseChunks: ['TUTOR_MAX_COURSE_CHUNKS', 1, 20_000],
  parseTimeoutMs: ['TUTOR_PARSE_TIMEOUT_MS', 100, 600_000],
  parseMemoryMb: ['TUTOR_PARSE_MEMORY_MB', 64, 2048],
  uploadConcurrency: ['TUTOR_UPLOAD_CONCURRENCY', 1, 4],
  maxAnswerLength: ['TUTOR_MAX_ANSWER_LENGTH', 1, 12_000],
  maxGoalLength: ['TUTOR_MAX_GOAL_LENGTH', 1, 2000]
}

export function getTutorLimits(): TutorLimits {
  return Object.fromEntries(
    Object.entries(settings).map(([name, [environment, minimum, maximum]]) => {
      const key = name as keyof TutorLimits
      const raw = process.env[environment]?.trim()
      const value = raw ? Number(raw) : NaN
      const multiplier =
        key === 'maxFileSize' || key === 'maxCourseSize' ? 1024 * 1024 : 1
      return [
        key,
        Number.isSafeInteger(value) && value >= minimum && value <= maximum
          ? value * multiplier
          : DEFAULT_TUTOR_LIMITS[key]
      ]
    })
  ) as unknown as TutorLimits
}

// Read on access so Web and Worker use runtime configuration rather than values
// frozen into the Next.js build. This module does not load model/DB providers.
export const TUTOR_LIMITS = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(settings).map(name => [
      name,
      {
        enumerable: true,
        get: () => getTutorLimits()[name as keyof TutorLimits]
      }
    ])
  )
) as TutorLimits
