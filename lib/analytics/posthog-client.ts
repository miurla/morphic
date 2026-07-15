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

  // The /relay reverse proxy (next.config rewrites) only targets US cloud.
  // EU / self-hosted deployments keep talking to their configured host directly.
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const useRelay = !host || host.includes('us.i.posthog.com')

  posthog.init(key, {
    api_host: useRelay ? '/relay' : host,
    ...(useRelay ? { ui_host: 'https://us.posthog.com' } : {}),
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    session_recording: { maskAllInputs: true }
  })
  initialized = true
}

export function getDistinctId(): string | undefined {
  if (!clientKey()) return undefined
  // Self-initialize so the id is available regardless of effect ordering
  // (a child auto-send effect can run before the provider's init effect).
  initPostHog()
  return posthog.get_distinct_id?.()
}

export function identify(distinctId: string): void {
  if (!clientKey()) return
  posthog.identify(distinctId)
}

/** Whether PostHog currently holds an identified (logged-in) distinct id. */
export function isIdentified(): boolean {
  if (!clientKey()) return false
  initPostHog()
  return posthog.get_property?.('$user_state') === 'identified'
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
  initPostHog()
  posthog.capture(event, properties)
}

/**
 * Whether a boolean feature flag is enabled for the current distinct id.
 * Returns false until flags have loaded (so the control path is the default).
 */
export function isFeatureEnabled(key: string): boolean {
  if (!clientKey()) return false
  initPostHog()
  return posthog.isFeatureEnabled?.(key) === true
}

/** Subscribe to feature-flag loads/changes. Returns an unsubscribe function. */
export function subscribeFeatureFlags(callback: () => void): () => void {
  if (!clientKey()) return () => {}
  initPostHog()
  return posthog.onFeatureFlags?.(() => callback()) ?? (() => {})
}

/** Extract the chat id from a /search/:id pathname. */
export function chatIdFromPath(pathname: string): string | undefined {
  return /^\/search\/([^/]+)/.exec(pathname)?.[1]
}
