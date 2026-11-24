'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState
} from 'react'
import { useRouter } from 'next/navigation'

import {
  LANGUAGE_COOKIE,
  type LanguagePreference,
  type Locale,
  normalizePreference,
  resolveLocale
} from '@/lib/i18n/config'
import { createTranslator, type Translator } from '@/lib/i18n/translate'
import { getCookie } from '@/lib/utils/cookies'

interface LanguageContextValue {
  locale: Locale
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => void
  t: Translator
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'en',
  preference: 'auto',
  setPreference: () => {},
  t: createTranslator('en')
})

export function LanguageProvider({
  children,
  initialLocale,
  initialPreference
}: {
  children: React.ReactNode
  initialLocale: Locale
  initialPreference: LanguagePreference
}) {
  const router = useRouter()
  const [state, setState] = useState({
    locale: initialLocale,
    preference: initialPreference
  })

  const setPreference = useCallback(
    (value: LanguagePreference) => {
      const preference = normalizePreference(value)
      const locale = resolveLocale(preference, navigator.languages)
      document.cookie = `${LANGUAGE_COOKIE}=${preference};path=/;max-age=31536000;SameSite=Lax${location.protocol === 'https:' ? ';Secure' : ''}`
      document.documentElement.lang = locale
      setState({ locale, preference })
      // Refresh server-rendered labels without remounting client state or the chat.
      router.refresh()
    },
    [router]
  )

  // A refreshed server layout can rewrite <html lang>. Restore the visible
  // client language before paint (and before a child sends its next request).
  useLayoutEffect(() => {
    document.documentElement.lang = state.locale
  })

  useEffect(() => {
    const onLanguageChange = () => {
      if (state.preference === 'auto') setPreference('auto')
    }
    window.addEventListener('languagechange', onLanguageChange)
    return () => window.removeEventListener('languagechange', onLanguageChange)
  }, [setPreference, state.preference])

  useEffect(() => {
    // Another tab shares the cookie. Reconcile on return without discarding
    // drafts; an in-flight generation retains the language it started with.
    const onFocus = () => {
      const preference = normalizePreference(getCookie(LANGUAGE_COOKIE))
      if (preference !== state.preference) setPreference(preference)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [setPreference, state.preference])

  const value = useMemo(
    () => ({ ...state, setPreference, t: createTranslator(state.locale) }),
    [state, setPreference]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useI18n() {
  return useContext(LanguageContext)
}

/** For small shared primitives that otherwise have no hooks. */
export function Trans({ children }: { children: string }) {
  return <>{useI18n().t(children)}</>
}
