import { describe, expect, it } from 'vitest'

import {
  createPublicErrorResponse,
  getPublicRateLimitDetails,
  serializePublicError,
  toPublicErrorPayload
} from '@/lib/errors/public-error'

describe('public error mapping', () => {
  it('hides provider billing errors', () => {
    const payload = toPublicErrorPayload(
      new Error(
        'Billing hard limit has been reached for this OpenAI organization.'
      )
    )

    expect(payload.code).toBe('provider_billing')
    expect(payload.error).toBe('The AI service is currently unavailable.')
    expect(payload.error.toLowerCase()).not.toContain('billing')
    expect(payload.error.toLowerCase()).not.toContain('organization')
  })

  it('hides provider quota errors from nested JSON responses', () => {
    const payload = toPublicErrorPayload(
      JSON.stringify({
        error: {
          message:
            'You exceeded your current quota, please check your plan and billing details.',
          code: 'insufficient_quota'
        }
      })
    )

    expect(payload.code).toBe('provider_quota')
    expect(payload.error).toBe(
      'The selected AI model has exhausted its quota. Choose another model or try again later.'
    )
    expect(payload.error.toLowerCase()).not.toContain('billing')
  })

  it('keeps quota guidance when stream errors wrap a public JSON payload', () => {
    const payload = toPublicErrorPayload(
      new Error(
        JSON.stringify({
          error:
            'The selected AI model has exhausted its quota. Choose another model or try again later.',
          code: 'provider_quota',
          type: 'general',
          retryable: false
        })
      )
    )

    expect(payload.code).toBe('provider_quota')
    expect(payload.type).toBe('general')
    expect(payload.retryable).toBe(false)
    expect(payload.error).toBe(
      'The selected AI model has exhausted its quota. Choose another model or try again later.'
    )
  })

  it('does not treat unrelated log-in wording as user authentication', () => {
    const payload = toPublicErrorPayload(
      new Error('failed to log in to the database connection pool')
    )

    expect(payload.type).toBe('general')
    expect(payload.code).toBe('provider_unavailable')
    expect(payload.error).toBe(
      'We could not generate a response. Please try again.'
    )
  })

  it('hides provider API key configuration errors', () => {
    const payload = toPublicErrorPayload(
      new Error(
        "OpenAI API key is missing. Pass it using the 'apiKey' parameter."
      )
    )

    expect(payload.code).toBe('provider_auth')
    expect(payload.error).toBe(
      'The AI service is not configured correctly. Please try again later.'
    )
    expect(payload.error.toLowerCase()).not.toContain('api key')
  })

  it('preserves intentional app rate-limit payloads', () => {
    const payload = toPublicErrorPayload(
      JSON.stringify({
        error:
          'Daily limit for Adaptive mode reached. Please try again tomorrow, or continue in Quick mode.',
        remaining: 0,
        resetAt: 1767139200000,
        limit: 30,
        mode: 'adaptive'
      })
    )

    expect(payload.type).toBe('rate-limit')
    expect(payload.code).toBe('rate_limit')
    expect(payload.error).toBe(
      'Daily limit for Adaptive mode reached. Please try again tomorrow, or continue in Quick mode.'
    )
    expect(payload.mode).toBe('adaptive')
    expect(getPublicRateLimitDetails(payload)).toBe(
      'The limit resets at midnight UTC. You can continue using Quick mode without restrictions.'
    )
  })

  it('maps guest limit payloads to the auth modal path', () => {
    const payload = toPublicErrorPayload(
      JSON.stringify({
        error: 'Please sign in to continue.',
        authRequired: true,
        remaining: 0,
        resetAt: 1767139200000,
        limit: 10
      })
    )

    expect(payload.type).toBe('auth')
    expect(payload.code).toBe('auth_required')
    expect(payload.authRequired).toBe(true)
    expect(payload.error).toBe('Please sign in to continue.')
    expect(payload.remaining).toBe(0)
    expect(payload.limit).toBe(10)
  })

  it('does not preserve raw text just because a parsed payload has a known code', () => {
    const payload = toPublicErrorPayload(
      JSON.stringify({
        code: 'rate_limit',
        error:
          'Provider rate_limit: internal tenant abc123 exceeded reserved capacity'
      })
    )

    expect(payload.type).toBe('rate-limit')
    expect(payload.code).toBe('rate_limit')
    expect(payload.error).toBe(
      'The AI service is receiving too many requests. Please try again shortly.'
    )
    expect(payload.error).not.toContain('tenant')
    expect(payload.error).not.toContain('abc123')
  })

  it('parses Error objects that contain public JSON payloads', () => {
    const payload = toPublicErrorPayload(
      new Error(
        JSON.stringify({
          error:
            'Sign in to use Adaptive mode. Quick mode remains available without an account.',
          mode: 'adaptive',
          authRequired: true
        })
      )
    )

    expect(payload.type).toBe('auth')
    expect(payload.code).toBe('auth_required')
    expect(payload.authRequired).toBe(true)
    expect(payload.error).toBe(
      'Sign in to use Adaptive mode. Quick mode remains available without an account.'
    )
  })

  it('maps context length errors to useful but sanitized copy', () => {
    const payload = toPublicErrorPayload(
      new Error(
        'This model has a maximum context length of 128000 tokens. Your messages resulted in 144000 tokens.'
      )
    )

    expect(payload.code).toBe('context_length')
    expect(payload.error).toBe(
      'This conversation is too long for the selected model. Start a new chat or shorten your message.'
    )
    expect(payload.error).not.toContain('144000')
  })

  it('serializes public payloads for stream error chunks', () => {
    const serialized = serializePublicError(
      new Error('Redis timeout while saving stream results')
    )
    const payload = JSON.parse(serialized)

    expect(payload.code).toBe('provider_unavailable')
    expect(payload.error).toBe(
      'We could not generate a response. Please try again.'
    )
    expect(serialized).not.toContain('Redis timeout')
  })

  it('creates JSON error responses without raw messages', async () => {
    const response = createPublicErrorResponse(
      new Error(
        'Database connection failed with password authentication error'
      ),
      { status: 500 }
    )

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toBe('application/json')

    const payload = await response.json()
    expect(payload.error).toBe(
      'We could not generate a response. Please try again.'
    )
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('password')
  })

  it('handles circular thrown objects without crashing', () => {
    const circular: Record<string, unknown> = {
      reason: 'database password leak'
    }
    circular.self = circular

    const payload = toPublicErrorPayload(circular)

    expect(payload.type).toBe('general')
    expect(payload.error).toBe(
      'We could not generate a response. Please try again.'
    )
  })
})
