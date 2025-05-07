import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'

const SUPPORTED_LOCALES = routing.locales
const DEFAULT_LOCALE = routing.defaultLocale

const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE
})

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request)
  const intlResponse = intlMiddleware(request)
  // Merge headers
  sessionResponse.headers.forEach((value, key) => {
    intlResponse.headers.set(key, value)
  })

  return intlResponse
}

export const config = {
  matcher: [
    '/((?!api|trpc|_next/static|_next/image|_next|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)'
  ]
}
