export const LANGUAGE_COOKIE = 'morphic-language'
export const LANGUAGE_HEADER = 'x-morphic-locale'
export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type LanguagePreference = Locale | 'auto'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-CN'
}

export function normalizePreference(value: unknown): LanguagePreference {
  return isLocale(value) ? value : 'auto'
}

/** Negotiate supported languages in preference order (including HTTP weights). */
export function resolveLocale(
  preference: LanguagePreference,
  languages: string | readonly string[] = ''
): Locale {
  if (isLocale(preference)) return preference
  const candidates = (
    typeof languages === 'string' ? languages.split(',') : languages
  )
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(';')
      const weight = parameters.find(parameter =>
        parameter.trim().startsWith('q=')
      )
      const quality = weight ? Number(weight.trim().slice(2)) : 1
      return { tag: tag.toLowerCase(), quality, index }
    })
    .filter(
      ({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index)

  for (const { tag } of candidates) {
    if (tag === 'zh' || tag.startsWith('zh-')) return 'zh-CN'
    if (tag === 'en' || tag.startsWith('en-')) return 'en'
  }
  return 'en'
}

export function getRequestPreference(
  headers: Pick<Headers, 'get'>
): LanguagePreference {
  const cookie = headers
    .get('cookie')
    ?.split(';')
    .find(entry => entry.trim().startsWith(`${LANGUAGE_COOKIE}=`))
  return normalizePreference(cookie?.trim().slice(LANGUAGE_COOKIE.length + 1))
}

/** Capture this once per generation; never read mutable UI state mid-stream. */
export function resolveRequestLocale(headers: Pick<Headers, 'get'>): Locale {
  // Generation requests snapshot the language actually rendered in this tab.
  // A shared cookie can have changed in another tab since this UI was rendered.
  const clientLocale = headers.get(LANGUAGE_HEADER)
  if (isLocale(clientLocale)) return clientLocale
  return resolveLocale(
    getRequestPreference(headers),
    headers.get('accept-language') ?? ''
  )
}
