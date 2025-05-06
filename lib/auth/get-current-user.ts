import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function getCurrentUserId() {
  const user = await getCurrentUser()
  return user?.id ?? 'anonymous'
}
