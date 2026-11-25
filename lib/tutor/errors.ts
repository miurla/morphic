export class TutorError extends Error {
  constructor(
    message: string,
    public readonly code = 'TUTOR_ERROR',
    public readonly status = 400
  ) {
    super(message)
    this.name = 'TutorError'
  }
}

/** Stable, user-safe messages; provider errors must stay out of API responses. */
export function safeTutorError(error: unknown): string {
  if (error instanceof TutorError) return error.message
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''
  if (code.startsWith('PDF_') || code === 'INVALID_PDF') {
    return error instanceof Error ? error.message : 'The PDF could not be read.'
  }
  if (code.startsWith('EMBEDDING_'))
    return 'The embedding service is unavailable. Check its configuration and retry.'
  if (code === 'INDEX_VERSION_MISMATCH')
    return 'Upload the document again to create a new course with the current index settings.'
  return 'The learning task could not be completed. Please try again.'
}
