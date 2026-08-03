import { toPublicErrorPayload } from '@/lib/errors/public-error'

const MAX_STATUS_MESSAGE_LENGTH = 300

// Only the public payload's code and message are used: that payload is already
// sent to every client, so it carries no user content or credentials.
export function describeStreamError(error: unknown): string {
  const { code, error: message } = toPublicErrorPayload(error)

  return `${code}: ${message}`.slice(0, MAX_STATUS_MESSAGE_LENGTH)
}
