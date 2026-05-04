import type { UserProfile } from '@/lib/supabase/types'

function listOrFallback(values: string[] | null | undefined): string {
  if (!values || values.length === 0) return 'Not specified'
  return values.join(', ')
}

function valueOrFallback(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'Not specified'
}

function formatLocation(profile: UserProfile): string {
  const countryCode = profile.countryCode?.trim()
  const region = profile.region?.trim()

  if (region && countryCode) return `${region}, ${countryCode}`
  if (countryCode) return countryCode
  return 'Not specified'
}

export function buildUserAgriculturalContextBlock(
  profile: UserProfile | null | undefined
): string | null {
  if (!profile) return null

  return `User agricultural context:
- Operation type: ${listOrFallback(profile.farmTypes)}
- Primary crops: ${listOrFallback(profile.primaryCrops)}
- Farm size: ${profile.farmSizeHa === null ? 'Not specified' : `${profile.farmSizeHa} ha`}
- Location: ${formatLocation(profile)}
- Climate zone: ${valueOrFallback(profile.climateZone)}
- Preferred language: ${profile.preferredLanguage}

When answering, prioritize research findings applicable to this user's specific context — their climate zone, region, crop types, and farm scale. If a recommendation is not applicable to their context, say so explicitly.`
}

export function buildQueryEnricherUserContext(
  profile: UserProfile | null | undefined
): string | null {
  if (!profile) return null

  const details = [
    profile.primaryCrops.length > 0
      ? `primary crops/products: ${profile.primaryCrops.join(', ')}`
      : null,
    profile.climateZone ? `climate zone: ${profile.climateZone}` : null,
    profile.countryCode ? `country code: ${profile.countryCode}` : null
  ].filter((detail): detail is string => Boolean(detail))

  if (details.length === 0) return null

  return details.join('; ')
}
