import { createBrowserClient } from '@supabase/ssr'

import { getSupabasePublishableKey } from './keys'

let warnedOnce = false

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = getSupabasePublishableKey()

  if (!url || !key) {
    if (!warnedOnce) {
      warnedOnce = true
      console.warn(
        'Supabase client configuration missing. Authentication features will be unavailable. ' +
          'To enable authentication, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY at build time.'
      )
    }
    throw new Error('Supabase not configured')
  }

  return createBrowserClient(url, key)
}
