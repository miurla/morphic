import type {
  PublicErrorCode,
  PublicErrorPayload
} from '@/lib/errors/public-error'

import type { Locale } from './config'
import { chineseMessages, translate } from './translate'

const errorCopy: Record<PublicErrorCode, string> = {
  auth_required: 'Please sign in to continue.',
  bad_request: 'The request could not be processed.',
  context_length:
    'This conversation is too long for the selected model. Start a new chat or shorten your message.',
  duplicate_attempt: 'This response is already being generated.',
  forbidden: 'You do not have permission to access this resource.',
  malformed_request:
    'This conversation could not be sent to the model. Please start a new chat.',
  model_unavailable:
    'The selected model is unavailable. Please choose another model.',
  provider_auth:
    'The AI service is not configured correctly. Please try again later.',
  provider_billing: 'The AI service is currently unavailable.',
  provider_quota: 'The AI service is currently unavailable.',
  provider_rate_limit:
    'The AI service is receiving too many requests. Please try again shortly.',
  provider_unavailable: 'We could not generate a response. Please try again.',
  rate_limit:
    'You have reached your daily chat limit. Please try again tomorrow.',
  tool_failed: 'A required tool failed. Please try again.',
  unknown: 'We could not generate a response. Please try again.',
  usage_limit: 'You have reached your usage limit.'
}

/** Preserve diagnostic originals in state/logs, localize only at the UI boundary. */
export function localizeErrorMessage(
  locale: Locale,
  message: string,
  fallback = 'Something went wrong. Please try again.'
) {
  if (locale === 'en') return message
  return translate(
    locale,
    Object.hasOwn(chineseMessages, message) ? message : fallback
  )
}

export function localizePublicError(
  payload: PublicErrorPayload,
  locale: Locale
): PublicErrorPayload {
  if (locale === 'en') return payload
  return {
    ...payload,
    error: localizeErrorMessage(locale, payload.error, errorCopy[payload.code]),
    details: payload.details
      ? localizeErrorMessage(locale, payload.details)
      : undefined
  }
}
