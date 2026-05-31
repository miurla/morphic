export type NavigationRisk = 'none' | 'external-origin' | 'sensitive-external'

export interface ExternalNavigationAssessment {
  href: string
  normalizedHref: string | null
  isValidUrl: boolean
  isExternal: boolean
  isSensitive: boolean
  risk: NavigationRisk
  displayHost: string | null
  reason: string | null
}

const SENSITIVE_PATH_KEYWORDS = [
  'auth',
  'authorize',
  'billing',
  'checkout',
  'login',
  'oauth',
  'payment',
  'signin',
  'signup',
  'sso',
  'subscribe'
]

const SENSITIVE_HOST_KEYWORDS = [
  'auth',
  'billing',
  'checkout',
  'login',
  'oauth',
  'pay',
  'payment',
  'stripe'
]

function safeUrl(value: string, baseOrigin: string): URL | null {
  try {
    return new URL(value, baseOrigin)
  } catch {
    return null
  }
}

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin
  } catch {
    return null
  }
}

export function isSensitiveNavigation(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()

  return (
    SENSITIVE_HOST_KEYWORDS.some(keyword => host.includes(keyword)) ||
    SENSITIVE_PATH_KEYWORDS.some(keyword =>
      path.split('/').some(segment => segment === keyword || segment.includes(keyword))
    )
  )
}

export function assessExternalNavigation(
  href: string,
  baseOrigin: string
): ExternalNavigationAssessment {
  const normalizedBaseOrigin = normalizeOrigin(baseOrigin)

  if (!normalizedBaseOrigin) {
    return {
      href,
      normalizedHref: null,
      isValidUrl: false,
      isExternal: true,
      isSensitive: true,
      risk: 'sensitive-external',
      displayHost: null,
      reason: 'Unable to verify the current app origin.'
    }
  }

  const url = safeUrl(href, normalizedBaseOrigin)

  if (!url) {
    return {
      href,
      normalizedHref: null,
      isValidUrl: false,
      isExternal: true,
      isSensitive: true,
      risk: 'sensitive-external',
      displayHost: null,
      reason: 'Unable to verify the destination URL.'
    }
  }

  const isExternal = url.origin !== normalizedBaseOrigin
  const isSensitive = isExternal && isSensitiveNavigation(url)
  const risk: NavigationRisk = isSensitive
    ? 'sensitive-external'
    : isExternal
      ? 'external-origin'
      : 'none'

  return {
    href,
    normalizedHref: url.href,
    isValidUrl: true,
    isExternal,
    isSensitive,
    risk,
    displayHost: url.host,
    reason: risk === 'none' ? null : buildExternalNavigationReason(url, risk)
  }
}

export function buildExternalNavigationReason(
  url: URL,
  risk: Exclude<NavigationRisk, 'none'>
): string {
  if (risk === 'sensitive-external') {
    return `You are leaving Morphic for a sensitive page on ${url.host}. Check the address before entering credentials, payment details, or API keys.`
  }

  return `You are leaving Morphic for ${url.host}. Check the address before continuing.`
}

export function shouldShowLeavingAppWarning(
  href: string,
  baseOrigin: string
): boolean {
  return assessExternalNavigation(href, baseOrigin).risk !== 'none'
}
