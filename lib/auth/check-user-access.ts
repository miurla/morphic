import { createClient } from '@/lib/supabase/server'

export async function checkUserAccess(userId: string) {
  const supabase = await createClient()

  // Check if user exists in the profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return { hasAccess: false, user: null }
  }

  return { hasAccess: true, user: profile }
}

export async function getCurrentUserWithAccess() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, hasAccess: false }
  }

  const accessCheck = await checkUserAccess(user.id)
  return {
    user: accessCheck.hasAccess ? user : null,
    hasAccess: accessCheck.hasAccess
  }
}
