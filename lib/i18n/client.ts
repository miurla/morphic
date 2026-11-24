import { isLocale, type Locale } from './config'

/** Read at send time, including regenerations, rather than freezing at mount. */
export function getClientLocale(): Locale {
  const locale =
    typeof document === 'undefined' ? undefined : document.documentElement.lang
  return isLocale(locale) ? locale : 'en'
}
