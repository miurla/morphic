/** Shared fallback values only; server policy is exposed through capabilities. */
export const DEFAULT_TUTOR_LIMITS = {
  maxFileSize: 20 * 1024 * 1024,
  maxFiles: 20,
  maxCourseSize: 200 * 1024 * 1024,
  maxPdfPages: 500,
  maxPages: 1000,
  maxTextCharacters: 2_000_000,
  maxDocumentTokens: 500_000,
  maxCourseTokens: 500_000,
  maxDocumentChunks: 2000,
  maxCourseChunks: 5000,
  parseTimeoutMs: 120_000,
  parseMemoryMb: 512,
  uploadConcurrency: 3,
  maxAnswerLength: 12_000,
  maxGoalLength: 2000
} as const

export type TutorLimits = {
  readonly [Key in keyof typeof DEFAULT_TUTOR_LIMITS]: number
}
