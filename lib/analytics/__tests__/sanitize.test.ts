import { describe, expect, it } from 'vitest'
import type { CaptureResult } from 'posthog-js'

import { scrubTokenFromEvent } from '../sanitize'

function pageview(currentUrl: unknown): CaptureResult {
  return {
    event_name: '$pageview',
    properties: { $current_url: currentUrl }
  } as unknown as CaptureResult
}

describe('scrubTokenFromEvent', () => {
  it('strips the token query parameter from the pageview url', () => {
    const result = scrubTokenFromEvent(
      pageview('http://localhost:3000/auth/update-password?token=abc123')
    )

    expect(result?.properties?.$current_url).toBe(
      'http://localhost:3000/auth/update-password'
    )
  })

  it('keeps other query parameters', () => {
    const result = scrubTokenFromEvent(
      pageview('http://localhost:3000/auth/sign-up?token=abc&x=1')
    )

    const url = result?.properties?.$current_url as string
    expect(url).toContain('x=1')
    expect(url).not.toContain('token=abc')
  })

  it('leaves events without a token untouched', () => {
    const event = pageview('http://localhost:3000/search?q=hello')

    expect(scrubTokenFromEvent(event)).toBe(event)
  })

  it('leaves null events and non-string urls untouched', () => {
    expect(scrubTokenFromEvent(null)).toBeNull()

    const event = pageview(42)
    expect(scrubTokenFromEvent(event)).toBe(event)
  })
})
