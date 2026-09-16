const USAGE_ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{16,191}$/

export function isValidUsageAttemptId(value: unknown): value is string {
  return typeof value === 'string' && USAGE_ATTEMPT_ID_PATTERN.test(value)
}
