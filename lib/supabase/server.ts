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

/**
 * Whether x-forwarded-for can be trusted as the visitor's address. Vercel
 * overwrites the header at its edge; anywhere else a client can set it,
 * so the operator has to opt in once a proxy that overwrites it is in
 * front of Morphic.
 */
function trustsForwardedFor(): boolean {
  const setting = process.env.SUPABASE_FORWARD_CLIENT_IP?.trim()
  if (setting === 'true') return true
  if (setting === 'false') return false
  return process.env.VERCEL === '1'
}

async function forwardableClientIp(): Promise<string | null> {
  if (!trustsForwardedFor()) return null
  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip && isIP(ip) ? ip : null
}

/**
 * Client for server actions that call Supabase Auth on the visitor's
 * behalf (sign-up, password sign-in, password reset). Calls made from the
 * server reach Supabase from the server's address, so its per-IP rate
 * limits stop applying per visitor. Supabase accepts the visitor's address
 * in Sb-Forwarded-For when the request uses a secret key and the project
 * has IP address forwarding enabled; otherwise this is the regular client.
 *
 * The secret key bypasses RLS: use this client for Auth calls only.
 */
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
