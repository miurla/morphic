import type { CaptureResult } from 'posthog-js'
import { describe, expect, it } from 'vitest'

import { scrubTokenFromEvent } from '../sanitize'

const AUTH_LINK = 'http://localhost:3000/auth/sign-up'

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

  it('strips the token from the referrer on later events', () => {
    // Arriving from an auth link leaves the credential in $referrer even
    // though $current_url is clean.
    const result = scrubTokenFromEvent({
      event_name: '$pageview',
      properties: {
        $current_url: 'http://localhost:3000/',
        $referrer: 'http://localhost:3000/auth/update-password?token=abc123'
      }
    } as unknown as CaptureResult)

    expect(result?.properties?.$current_url).toBe('http://localhost:3000/')
    expect(result?.properties?.$referrer).toBe(
      'http://localhost:3000/auth/update-password'
    )
  })

  it('strips the token from the initial and session entry urls', () => {
    const result = scrubTokenFromEvent({
      event_name: 'chat_started',
      properties: {
        $current_url: 'http://localhost:3000/',
        $initial_current_url: `${AUTH_LINK}?token=abc123`,
        $initial_referrer: `${AUTH_LINK}?token=abc123`,
        $session_entry_url: `${AUTH_LINK}?token=abc123`,
        $session_entry_referrer: `${AUTH_LINK}?token=abc123`
      }
    } as unknown as CaptureResult)

    expect(result?.properties).toEqual({
      $current_url: 'http://localhost:3000/',
      $initial_current_url: AUTH_LINK,
      $initial_referrer: AUTH_LINK,
      $session_entry_url: AUTH_LINK,
      $session_entry_referrer: AUTH_LINK
    })
  })

  it('strips the token from person properties at the event root', () => {
    const result = scrubTokenFromEvent({
      event_name: '$pageview',
      properties: { $current_url: 'http://localhost:3000/' },
      $set: { $current_url: `${AUTH_LINK}?token=abc123`, plan: 'free' },
      $set_once: {
        $initial_current_url: `${AUTH_LINK}?token=abc123`,
        $initial_referrer: `${AUTH_LINK}?token=abc123`,
        $current_url: `${AUTH_LINK}?token=abc123`,
        $referrer: '$direct'
      }
    } as unknown as CaptureResult)

    expect(result?.$set).toEqual({ $current_url: AUTH_LINK, plan: 'free' })
    expect(result?.$set_once).toEqual({
      $initial_current_url: AUTH_LINK,
      $initial_referrer: AUTH_LINK,
      $current_url: AUTH_LINK,
      $referrer: '$direct'
    })
  })

  it('strips the token from person properties nested under properties', () => {
    const result = scrubTokenFromEvent({
      event_name: '$set',
      properties: {
        $set: { $current_url: `${AUTH_LINK}?token=abc123` },
        $set_once: {
          $initial_current_url: `${AUTH_LINK}?token=abc123`,
          $initial_referrer: `${AUTH_LINK}?token=abc123`
        }
      }
    } as unknown as CaptureResult)

    expect(result?.properties?.$set).toEqual({ $current_url: AUTH_LINK })
    expect(result?.properties?.$set_once).toEqual({
      $initial_current_url: AUTH_LINK,
      $initial_referrer: AUTH_LINK
    })
  })

  it('does not mutate the original event', () => {
    const setOnce = { $initial_current_url: `${AUTH_LINK}?token=abc123` }
    const event = {
      event_name: '$pageview',
      properties: { $current_url: 'http://localhost:3000/' },
      $set_once: setOnce
    } as unknown as CaptureResult

    const result = scrubTokenFromEvent(event)

    expect(result).not.toBe(event)
    expect(setOnce.$initial_current_url).toContain('token=abc123')
  })

  it('leaves events without a token untouched', () => {
    const event = {
      event_name: '$pageview',
      properties: {
        $current_url: 'http://localhost:3000/search?q=hello',
        $set_once: { $initial_current_url: 'http://localhost:3000/' }
      },
      $set_once: { $initial_referrer: '$direct' }
    } as unknown as CaptureResult

    expect(scrubTokenFromEvent(event)).toBe(event)
  })

  it('leaves null events and non-string urls untouched', () => {
    expect(scrubTokenFromEvent(null)).toBeNull()

    const event = pageview(42)
    expect(scrubTokenFromEvent(event)).toBe(event)
  })
})
