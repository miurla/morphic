import { createClient } from '@/lib/supabase/server'
import { incrementAuthCallCount } from '@/lib/utils/perf-tracking'

export async function getCurrentUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null // Supabase is not configured
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function getCurrentUserId() {
  const count = incrementAuthCallCount()
  console.log(`[PERF] getCurrentUserId called - count: ${count}`)
  const user = await getCurrentUser()
  return user?.id
}
