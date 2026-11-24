import { headers } from 'next/headers'

import { getRequestPreference, resolveRequestLocale } from './config'
import { createTranslator } from './translate'

export async function getI18n() {
  const requestHeaders = await headers()
  const locale = resolveRequestLocale(requestHeaders)
  return {
    locale,
    preference: getRequestPreference(requestHeaders),
    t: createTranslator(locale)
  }
}
