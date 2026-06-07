'use client'

import posthog from 'posthog-js'

let initialized = false

function clientKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY
}

export function initPostHog(): void {
  if (initialized || typeof window === 'undefined') return

  const key = clientKey()
  if (!key) return

  posthog.init(key, {
    api_host: '/relay',
    ui_host: 'https://us.posthog.com',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    session_recording: { maskAllInputs: true }
  })
  initialized = true
}

export function identify(distinctId: string): void {
  if (!clientKey()) return
  posthog.identify(distinctId)
}

export function reset(): void {
  if (!clientKey()) return
  posthog.reset()
}

export function captureClient(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!clientKey()) return
  posthog.capture(event, properties)
}

/** Extract the chat id from a /search/:id pathname. */
export function chatIdFromPath(pathname: string): string | undefined {
  return /^\/search\/([^/]+)/.exec(pathname)?.[1]
}
