import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Authentication features will be disabled.')
    // Return a mock client that won't crash the app
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null })
      }
    } as any
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
