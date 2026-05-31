'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  buildPlatformInfo,
  getClientPlatformInfo,
  PlatformInfo
} from '@/lib/platform/platform'

const PlatformContext = createContext<PlatformInfo>(buildPlatformInfo())

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
}

function applyPlatformClasses(info: PlatformInfo) {
  const root = document.documentElement
  const previous = Array.from(root.classList).filter(
    className =>
      className.startsWith('platform-') ||
      className.startsWith('display-') ||
      className.startsWith('pwa-')
  )

  for (const className of previous) {
    root.classList.remove(className)
  }

  root.classList.add(...info.classes)
  root.dataset.platform = info.kind
  root.dataset.platformFamily = info.family
  root.dataset.displayMode = info.displayMode
  root.dataset.pwaStandalone = String(info.isStandalone)
}

function addMediaQueryListener(
  query: LegacyMediaQueryList,
  listener: (event: MediaQueryListEvent) => void
) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return
  }

  if (typeof query.addListener === 'function') {
    query.addListener(listener)
  }
}

function removeMediaQueryListener(
  query: LegacyMediaQueryList,
  listener: (event: MediaQueryListEvent) => void
) {
  if (typeof query.removeEventListener === 'function') {
    query.removeEventListener('change', listener)
    return
  }

  if (typeof query.removeListener === 'function') {
    query.removeListener(listener)
  }
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() =>
    buildPlatformInfo()
  )

  useEffect(() => {
    const updatePlatformInfo = () => {
      const nextInfo = getClientPlatformInfo()
      setPlatformInfo(nextInfo)
      applyPlatformClasses(nextInfo)
    }

    updatePlatformInfo()

    const displayModeQueries = [
      '(display-mode: browser)',
      '(display-mode: standalone)',
      '(display-mode: fullscreen)',
      '(display-mode: minimal-ui)',
      '(display-mode: window-controls-overlay)'
    ]
      .map(query => {
        try {
          return window.matchMedia(query) as LegacyMediaQueryList
        } catch {
          return null
        }
      })
      .filter((query): query is LegacyMediaQueryList => query !== null)

    for (const query of displayModeQueries) {
      addMediaQueryListener(query, updatePlatformInfo)
    }

    return () => {
      for (const query of displayModeQueries) {
        removeMediaQueryListener(query, updatePlatformInfo)
      }
    }
  }, [])

  const value = useMemo(() => platformInfo, [platformInfo])

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform(): PlatformInfo {
  return useContext(PlatformContext)
}
