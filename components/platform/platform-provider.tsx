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
          return window.matchMedia(query)
        } catch {
          return null
        }
      })
      .filter((query): query is MediaQueryList => query !== null)

    for (const query of displayModeQueries) {
      query.addEventListener?.('change', updatePlatformInfo)
    }

    return () => {
      for (const query of displayModeQueries) {
        query.removeEventListener?.('change', updatePlatformInfo)
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
