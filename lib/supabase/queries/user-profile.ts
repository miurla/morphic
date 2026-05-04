import type { SupabaseClient } from '@supabase/supabase-js'

import { mapUserProfileRow, type UserProfile } from '../types'

type DB = SupabaseClient

// ---------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------

export async function getUserProfile(
  db: DB,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await db
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return mapUserProfileRow(data)
}

// ---------------------------------------------------------------
// Update
// ---------------------------------------------------------------

export async function updateUserProfile(
  db: DB,
  userId: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'fullName'
      | 'avatarUrl'
      | 'bio'
      | 'farmTypes'
      | 'primaryCrops'
      | 'farmSizeHa'
      | 'countryCode'
      | 'region'
      | 'climateZone'
      | 'preferredLanguage'
      | 'onboardingCompleted'
    >
  >
): Promise<UserProfile> {
  const row: Record<string, unknown> = {}

  if (updates.fullName !== undefined) row.full_name = updates.fullName
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl
  if (updates.bio !== undefined) row.bio = updates.bio
  if (updates.farmTypes !== undefined) row.farm_types = updates.farmTypes
  if (updates.primaryCrops !== undefined)
    row.primary_crops = updates.primaryCrops
  if (updates.farmSizeHa !== undefined) row.farm_size_ha = updates.farmSizeHa
  if (updates.countryCode !== undefined) row.country_code = updates.countryCode
  if (updates.region !== undefined) row.region = updates.region
  if (updates.climateZone !== undefined) row.climate_zone = updates.climateZone
  if (updates.preferredLanguage !== undefined)
    row.preferred_language = updates.preferredLanguage
  if (updates.onboardingCompleted !== undefined)
    row.onboarding_completed = updates.onboardingCompleted

  const { data, error } = await db
    .from('user_profiles')
    .update(row)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return mapUserProfileRow(data)
}

// ---------------------------------------------------------------
// Touch last_seen_at + increment search counter
// ---------------------------------------------------------------

export async function touchUserActivity(db: DB, userId: string): Promise<void> {
  const { error } = await db
    .from('user_profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

export async function incrementSearchCount(
  db: DB,
  userId: string
): Promise<void> {
  const { error } = await db.rpc('increment_search_count', { uid: userId })
  if (error) throw error
}
