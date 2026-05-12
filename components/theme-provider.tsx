'use client'

import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  attribute?: 'class'
  disableTransitionOnChange?: boolean
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  systemTheme: 'light' | 'dark'
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(theme: Theme, systemTheme: 'light' | 'dark') {
  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const root = document.documentElement

  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
  root.style.colorScheme = resolvedTheme
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = true
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>(
    'light'
  )

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null
    const initialTheme =
      storedTheme === 'light' ||
      storedTheme === 'dark' ||
      storedTheme === 'system'
        ? storedTheme
        : defaultTheme
    const initialSystemTheme = getSystemTheme()

    setThemeState(initialTheme)
    setSystemTheme(initialSystemTheme)
    applyTheme(
      enableSystem
        ? initialTheme
        : initialTheme === 'system'
          ? 'light'
          : initialTheme,
      initialSystemTheme
    )
  }, [defaultTheme, enableSystem])

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const nextSystemTheme = getSystemTheme()
      setSystemTheme(nextSystemTheme)
      applyTheme(theme, nextSystemTheme)
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      const normalizedTheme =
        !enableSystem && nextTheme === 'system' ? 'light' : nextTheme
      window.localStorage.setItem('theme', normalizedTheme)
      setThemeState(normalizedTheme)
      applyTheme(normalizedTheme, getSystemTheme())
    },
    [enableSystem]
  )

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme
    }),
    [theme, setTheme, resolvedTheme, systemTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    return {
      theme: 'system' as Theme,
      setTheme: () => {},
      resolvedTheme: 'light' as const,
      systemTheme: 'light' as const
    }
  }

  return context
}
