import { cookies, headers } from 'next/headers'

import { createServerClient } from '@supabase/ssr'
import { isIP } from 'node:net'

import { getSupabasePublishableKey } from './keys'

type CookieStore = Awaited<ReturnType<typeof cookies>>

function cookieAdapter(cookieStore: CookieStore) {
  return {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(
      cookiesToSet: Array<{
        name: string
        value: string
        options?: Parameters<CookieStore['set']>[2]
      }>
    ) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // The `setAll` method was called from a Server Component.
        // This can be ignored if you have middleware refreshing
        // user sessions.
      }
    }
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  const supabaseKey = getSupabasePublishableKey()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    { cookies: cookieAdapter(cookieStore) }
  )
}

// Only Vercel deployments overwrite x-forwarded-for at the edge.
function trustsForwardedFor(): boolean {
  const setting = process.env.SUPABASE_FORWARD_CLIENT_IP?.trim()
  if (setting === 'true') return true
  if (setting === 'false') return false
  return (
    process.env.VERCEL === '1' &&
    (process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview')
  )
}

async function forwardableClientIp(): Promise<string | null> {
  if (!trustsForwardedFor()) return null
  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip && isIP(ip) ? ip : null
}

// Forwards the visitor's IP to Supabase Auth rate limits. The secret key
// bypasses RLS: use for Auth calls only.
export async function createAuthActionClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const clientIp = await forwardableClientIp()
  if (!clientIp || !secretKey?.startsWith('sb_secret_')) {
    return createClient()
  }

  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    cookies: cookieAdapter(cookieStore),
    global: { headers: { 'sb-forwarded-for': clientIp } }
  })
}
