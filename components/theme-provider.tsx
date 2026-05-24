'use client'

import type {
  Dispatch,
  PropsWithChildren,
  ScriptHTMLAttributes,
  SetStateAction
} from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useServerInsertedHTML } from 'next/navigation'

type SystemTheme = 'dark' | 'light'
type DataAttribute = `data-${string}`
type Attribute = DataAttribute | 'class'
type ThemeAttribute = Attribute | Attribute[]
type ValueObject = Record<string, string>

interface ScriptProps extends ScriptHTMLAttributes<HTMLScriptElement> {
  [dataAttribute: DataAttribute]: unknown
}

export interface UseThemeProps {
  themes: string[]
  forcedTheme?: string
  setTheme: Dispatch<SetStateAction<string>>
  theme?: string
  resolvedTheme?: string
  systemTheme?: SystemTheme
}

export interface ThemeProviderProps extends PropsWithChildren {
  themes?: string[]
  forcedTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  storageKey?: string
  defaultTheme?: string
  attribute?: ThemeAttribute
  value?: ValueObject
  nonce?: string
  scriptProps?: ScriptProps
}

const DEFAULT_THEMES = ['light', 'dark']
const COLOR_SCHEME_THEMES = ['light', 'dark']
const SYSTEM_THEME_MEDIA = '(prefers-color-scheme: dark)'

const fallbackThemeContext: UseThemeProps = {
  setTheme: () => {},
  themes: []
}

const ThemeContext = createContext<UseThemeProps | undefined>(undefined)

export function useTheme() {
  return useContext(ThemeContext) ?? fallbackThemeContext
}

export function ThemeProvider(props: ThemeProviderProps) {
  const context = useContext(ThemeContext)

  if (context) {
    return <>{props.children}</>
  }

  return <ThemeProviderInner {...props} />
}

function ThemeProviderInner({
  attribute = 'data-theme',
  children,
  defaultTheme,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  nonce,
  scriptProps,
  storageKey = 'theme',
  themes = DEFAULT_THEMES,
  value
}: ThemeProviderProps) {
  const resolvedDefaultTheme =
    defaultTheme ?? (enableSystem ? 'system' : 'light')
  const [theme, setThemeState] = useState<string | undefined>(
    resolvedDefaultTheme
  )
  const [systemTheme, setSystemTheme] = useState<SystemTheme | undefined>()
  const hasSyncedTheme = useRef(false)
  const hasInsertedThemeScript = useRef(false)
  const themeRef = useRef<string | undefined>(resolvedDefaultTheme)

  const applyThemeWithConfig = useCallback(
    (nextTheme?: string) => {
      applyTheme(nextTheme, {
        attribute,
        defaultTheme: resolvedDefaultTheme,
        disableTransitionOnChange,
        enableColorScheme,
        enableSystem,
        nonce,
        themes,
        value
      })
    },
    [
      attribute,
      disableTransitionOnChange,
      enableColorScheme,
      enableSystem,
      nonce,
      resolvedDefaultTheme,
      themes,
      value
    ]
  )

  const setTheme = useCallback<Dispatch<SetStateAction<string>>>(
    nextThemeOrUpdater => {
      const nextTheme =
        typeof nextThemeOrUpdater === 'function'
          ? nextThemeOrUpdater(themeRef.current ?? resolvedDefaultTheme)
          : nextThemeOrUpdater

      themeRef.current = nextTheme
      setThemeState(nextTheme)

      try {
        window.localStorage.setItem(storageKey, nextTheme)
      } catch {}

      if (hasSyncedTheme.current) {
        applyThemeWithConfig(forcedTheme ?? nextTheme)
      }
    },
    [applyThemeWithConfig, forcedTheme, resolvedDefaultTheme, storageKey]
  )

  useServerInsertedHTML(() => {
    if (hasInsertedThemeScript.current) {
      return null
    }

    hasInsertedThemeScript.current = true

    const scriptNonce = nonce ?? scriptProps?.nonce

    return (
      <script
        {...scriptProps}
        nonce={scriptNonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: getThemeScript({
            attribute,
            defaultTheme: resolvedDefaultTheme,
            enableColorScheme,
            enableSystem,
            forcedTheme,
            storageKey,
            themes,
            value
          })
        }}
      />
    )
  })

  useEffect(() => {
    if (!hasSyncedTheme.current) {
      return
    }

    applyThemeWithConfig(forcedTheme ?? theme)
  }, [applyThemeWithConfig, forcedTheme, theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA)

    const syncTheme = (nextTheme: string) => {
      themeRef.current = nextTheme
      setThemeState(nextTheme)
      applyThemeWithConfig(forcedTheme ?? nextTheme)
    }

    const handleMediaChange = (event: MediaQueryList | MediaQueryListEvent) => {
      const nextSystemTheme = getSystemTheme(event)

      setSystemTheme(nextSystemTheme)

      if ((forcedTheme ?? themeRef.current) === 'system' && enableSystem) {
        applyThemeWithConfig(forcedTheme ?? themeRef.current)
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return
      }

      syncTheme(event.newValue ?? resolvedDefaultTheme)
    }

    let isMounted = true

    window.queueMicrotask(() => {
      if (!isMounted) {
        return
      }

      setSystemTheme(getSystemTheme(mediaQuery))
      syncTheme(getStoredTheme(storageKey, resolvedDefaultTheme))
      hasSyncedTheme.current = true
    })

    addMediaListener(mediaQuery, handleMediaChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      isMounted = false
      removeMediaListener(mediaQuery, handleMediaChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [
    applyThemeWithConfig,
    enableSystem,
    forcedTheme,
    resolvedDefaultTheme,
    storageKey
  ])

  const themesWithSystem = useMemo(
    () => (enableSystem ? [...themes, 'system'] : themes),
    [enableSystem, themes]
  )

  const contextValue = useMemo<UseThemeProps>(
    () => ({
      forcedTheme,
      resolvedTheme: theme === 'system' ? systemTheme : theme,
      setTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      theme,
      themes: themesWithSystem
    }),
    [enableSystem, forcedTheme, setTheme, systemTheme, theme, themesWithSystem]
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

function getStoredTheme(storageKey: string, defaultTheme: string) {
  try {
    return window.localStorage.getItem(storageKey) ?? defaultTheme
  } catch {
    return defaultTheme
  }
}

function getSystemTheme(
  mediaQuery?: MediaQueryList | MediaQueryListEvent
): SystemTheme {
  const matches =
    mediaQuery?.matches ?? window.matchMedia(SYSTEM_THEME_MEDIA).matches

  return matches ? 'dark' : 'light'
}

function addMediaListener(
  mediaQuery: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void
) {
  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void
  }

  if (typeof legacyMediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener)
    return
  }

  legacyMediaQuery.addListener?.(listener)
}

function removeMediaListener(
  mediaQuery: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void
) {
  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
  }

  if (typeof legacyMediaQuery.removeEventListener === 'function') {
    mediaQuery.removeEventListener('change', listener)
    return
  }

  legacyMediaQuery.removeListener?.(listener)
}

function applyTheme(
  theme: string | undefined,
  {
    attribute,
    defaultTheme,
    disableTransitionOnChange,
    enableColorScheme,
    enableSystem,
    nonce,
    themes,
    value
  }: {
    attribute: ThemeAttribute
    defaultTheme: string
    disableTransitionOnChange: boolean
    enableColorScheme: boolean
    enableSystem: boolean
    nonce?: string
    themes: string[]
    value?: ValueObject
  }
) {
  if (!theme || typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const resolvedTheme =
    theme === 'system' && enableSystem ? getSystemTheme() : theme
  const themeValue = value?.[resolvedTheme] ?? resolvedTheme
  const restoreTransitions = disableTransitionOnChange
    ? disableTransitions(nonce)
    : undefined

  for (const attr of getAttributes(attribute)) {
    if (attr === 'class') {
      const classesToRemove = getThemeClassNames(themes, value)

      if (classesToRemove.length > 0) {
        root.classList.remove(...classesToRemove)
      }

      if (themeValue) {
        root.classList.add(themeValue)
      }
    } else if (attr.startsWith('data-')) {
      if (themeValue) {
        root.setAttribute(attr, themeValue)
      } else {
        root.removeAttribute(attr)
      }
    }
  }

  if (enableColorScheme) {
    const fallback = COLOR_SCHEME_THEMES.includes(defaultTheme)
      ? defaultTheme
      : undefined
    const colorScheme = COLOR_SCHEME_THEMES.includes(resolvedTheme)
      ? resolvedTheme
      : fallback

    if (colorScheme) {
      root.style.colorScheme = colorScheme
    }
  }

  restoreTransitions?.()
}

function getAttributes(attribute: ThemeAttribute) {
  return Array.isArray(attribute) ? attribute : [attribute]
}

function getThemeClassNames(themes: string[], value?: ValueObject) {
  return themes.map(theme => value?.[theme] ?? theme).filter(Boolean)
}

function disableTransitions(nonce?: string) {
  const style = document.createElement('style')

  if (nonce) {
    style.setAttribute('nonce', nonce)
  }

  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}'
    )
  )

  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    window.setTimeout(() => {
      document.head.removeChild(style)
    }, 1)
  }
}

function getThemeScript({
  attribute,
  defaultTheme,
  enableColorScheme,
  enableSystem,
  forcedTheme,
  storageKey,
  themes,
  value
}: {
  attribute: ThemeAttribute
  defaultTheme: string
  enableColorScheme: boolean
  enableSystem: boolean
  forcedTheme?: string
  storageKey: string
  themes: string[]
  value?: ValueObject
}) {
  const args = JSON.stringify([
    attribute,
    storageKey,
    defaultTheme,
    forcedTheme,
    themes,
    value,
    enableSystem,
    enableColorScheme
  ]).replace(/</g, '\\u003c')

  return `(${themeScript.toString()}).apply(null, ${args})`
}

function themeScript(
  attribute: ThemeAttribute,
  storageKey: string,
  defaultTheme: string,
  forcedTheme: string | undefined,
  themes: string[],
  value: ValueObject | undefined,
  enableSystem: boolean,
  enableColorScheme: boolean
) {
  const root = document.documentElement
  const colorSchemeThemes = ['light', 'dark']

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  function getAttributes() {
    return Array.isArray(attribute) ? attribute : [attribute]
  }

  function applyTheme(theme: string | undefined) {
    if (!theme) {
      return
    }

    const resolvedTheme =
      theme === 'system' && enableSystem ? getSystemTheme() : theme
    const themeValue = value?.[resolvedTheme] ?? resolvedTheme

    for (const attr of getAttributes()) {
      if (attr === 'class') {
        const classesToRemove = themes
          .map(themeName => value?.[themeName] ?? themeName)
          .filter(Boolean)

        if (classesToRemove.length > 0) {
          root.classList.remove(...classesToRemove)
        }

        if (themeValue) {
          root.classList.add(themeValue)
        }
      } else if (attr.startsWith('data-')) {
        if (themeValue) {
          root.setAttribute(attr, themeValue)
        } else {
          root.removeAttribute(attr)
        }
      }
    }

    if (enableColorScheme) {
      const fallback = colorSchemeThemes.includes(defaultTheme)
        ? defaultTheme
        : undefined
      const colorScheme = colorSchemeThemes.includes(resolvedTheme)
        ? resolvedTheme
        : fallback

      if (colorScheme) {
        root.style.colorScheme = colorScheme
      }
    }
  }

  if (forcedTheme) {
    applyTheme(forcedTheme)
    return
  }

  try {
    applyTheme(localStorage.getItem(storageKey) ?? defaultTheme)
  } catch {
    applyTheme(defaultTheme)
  }
}
