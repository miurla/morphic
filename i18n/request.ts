export const dynamic = 'force-static'

import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale
  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    console.log(
      `Invalid locale "${locale}". Falling back to default locale "${routing.defaultLocale}".`
    )
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default
  }
})
