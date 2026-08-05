import type { UIMessage } from 'ai'

export const EMPTY_RESPONSE_STATUS_MESSAGE =
  'empty_response: The model returned no answer text.'

export function isEmptyResponse(responseMessage: UIMessage): boolean {
  return !responseMessage.parts.some(
    part => part.type === 'text' && part.text.trim().length > 0
  )
}
