'use server'

import { createClient } from '@/lib/supabase/server'

export async function addUserToTable(
  userId: string,
  email: string,
  userData?: any
) {
  const supabase = await createClient()

  // Check if user already exists in the profiles table
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!existingProfile) {
    // Add user to the profiles table
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      username: userData?.full_name || email.split('@')[0],
      email: email,
      full_name: userData?.full_name,
      avatar_url: userData?.avatar_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add any additional fields from userData if needed
      ...userData
    })

    if (error) {
      console.error('Error adding user to profiles table:', error)
      return { success: false, error }
    }
  }

  return { success: true }
}

export async function handleOAuthCallback(user: any) {
  if (user) {
    await addUserToTable(user.id, user.email, {
      full_name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url
    })
  }
}
