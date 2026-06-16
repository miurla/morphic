export type PlatformKind =
  | 'ios'
  | 'ipados'
  | 'macos'
  | 'android'
  | 'windows'
  | 'linux'
  | 'unknown'

export type PlatformFamily =
  | 'apple'
  | 'android'
  | 'windows'
  | 'linux'
  | 'unknown'

export type DisplayMode =
  | 'browser'
  | 'standalone'
  | 'fullscreen'
  | 'minimal-ui'
  | 'window-controls-overlay'
  | 'unknown'

export interface PlatformInfo {
  kind: PlatformKind
  family: PlatformFamily
  displayMode: DisplayMode
  isAppleLike: boolean
  isStandalone: boolean
  classes: string[]
}

const APPLE_TOUCH_POINTS_MIN = 2

function normalize(value: string | undefined): string {
  return (value || '').toLowerCase()
}

function hasMacTouchProfile(
  userAgent: string,
  maxTouchPoints: number
): boolean {
  return (
    userAgent.includes('macintosh') && maxTouchPoints >= APPLE_TOUCH_POINTS_MIN
  )
}

function platformFamily(kind: PlatformKind): PlatformFamily {
  switch (kind) {
    case 'ios':
    case 'ipados':
    case 'macos':
      return 'apple'
    case 'android':
      return 'android'
    case 'windows':
      return 'windows'
    case 'linux':
      return 'linux'
    default:
      return 'unknown'
  }
}

export function detectPlatformKind(input?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentDataPlatform?: string
}): PlatformKind {
  const userAgent = normalize(input?.userAgent)
  const platform = normalize(input?.platform)
  const uaDataPlatform = normalize(input?.userAgentDataPlatform)
  const maxTouchPoints = input?.maxTouchPoints ?? 0

  if (userAgent.includes('iphone') || userAgent.includes('ipod')) {
    return 'ios'
  }

  if (
    userAgent.includes('ipad') ||
    hasMacTouchProfile(userAgent, maxTouchPoints)
  ) {
    return 'ipados'
  }

  if (uaDataPlatform.includes('android') || userAgent.includes('android')) {
    return 'android'
  }

  if (
    uaDataPlatform.includes('windows') ||
    platform.includes('win') ||
    userAgent.includes('windows')
  ) {
    return 'windows'
  }

  if (
    uaDataPlatform.includes('mac') ||
    platform.includes('mac') ||
    userAgent.includes('mac os') ||
    userAgent.includes('macintosh')
  ) {
    return 'macos'
  }

  if (
    uaDataPlatform.includes('linux') ||
    platform.includes('linux') ||
    userAgent.includes('linux')
  ) {
    return 'linux'
  }

  return 'unknown'
}

export function resolveDisplayMode(
  matchMedia?: Window['matchMedia']
): DisplayMode {
  if (!matchMedia) return 'unknown'

  const modes: DisplayMode[] = [
    'window-controls-overlay',
    'fullscreen',
    'standalone',
    'minimal-ui',
    'browser'
  ]

  for (const mode of modes) {
    try {
      if (matchMedia(`(display-mode: ${mode})`).matches) return mode
    } catch {
      // Unsupported display-mode media queries should not break detection.
    }
  }

  return 'unknown'
}

export function buildPlatformInfo(input?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentDataPlatform?: string
  displayMode?: DisplayMode
  navigatorStandalone?: boolean
}): PlatformInfo {
  const kind = detectPlatformKind(input)
  const family = platformFamily(kind)
  const displayMode = input?.displayMode ?? 'unknown'
  const isStandalone =
    displayMode === 'standalone' ||
    displayMode === 'fullscreen' ||
    displayMode === 'window-controls-overlay' ||
    input?.navigatorStandalone === true

  // Apple is the intentional fallback visual language. Unknown and Linux
  // environments stay Apple-like unless a more specific profile is detected.
  const isAppleLike =
    family === 'apple' || family === 'unknown' || family === 'linux'

  return {
    kind,
    family,
    displayMode,
    isAppleLike,
    isStandalone,
    classes: [
      `platform-${kind}`,
      `platform-family-${family}`,
      `display-${displayMode}`,
      isAppleLike ? 'platform-apple-like' : 'platform-native-alt',
      isStandalone ? 'pwa-standalone' : 'pwa-browser'
    ]
  }
}

export function getClientPlatformInfo(): PlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return buildPlatformInfo()
  }

  const nav = navigator as Navigator & {
    standalone?: boolean
    userAgentData?: { platform?: string }
  }

  return buildPlatformInfo({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    userAgentDataPlatform: nav.userAgentData?.platform,
    displayMode: resolveDisplayMode(
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : undefined
    ),
    navigatorStandalone: nav.standalone
  })
}
