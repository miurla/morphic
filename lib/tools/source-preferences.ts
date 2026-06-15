import { tool } from 'ai'
import { z } from 'zod'

import {
  listSourcePreferenceProfiles,
  listSourcePreferences,
  upsertSourcePreference,
  upsertSourcePreferenceProfile
} from '@/lib/actions/source-preferences'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { normalizeSourcePreferenceProfileInput } from '@/lib/sources/source-preference-profiles'
import { normalizeSourcePreferenceInput } from '@/lib/sources/source-preferences'

export const sourcePreferencesToolSchema = z.object({
    action: z
      .enum(['list', 'save'])
      .describe(
        'list = inspect remembered preferences, save = remember an explicit user source preference.'
      ),
    target: z
      .string()
      .optional()
      .describe('Domain or source URL the user wants to tune.'),
    preference: z
      .enum(['trust', 'prefer', 'mute', 'block'])
      .optional()
      .describe(
        'trust = rely on more, prefer = rank higher, mute = avoid/demote, block = never use.'
      ),
    note: z.string().optional().describe('Brief user-stated reason.'),
    profileName: z
      .string()
      .optional()
      .describe(
        'Optional topic profile name when the user scopes the preference to a topic, e.g. "climate research".'
      ),
    profileTerms: z
      .array(z.string())
      .optional()
      .describe('Optional query terms that should activate this topic profile.'),
    profileExcludeTerms: z
      .array(z.string())
      .optional()
      .describe(
        'Optional query terms that should prevent this profile from matching.'
      )
})

async function requireUserId() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Source preferences require an authenticated user.')
  }

  return userId
}

export function createSourcePreferencesTool() {
  return tool({
    description:
      'Remember and inspect user source preferences. Use when the user says they want to rely on a source more, prefer a source, avoid a source, or never use a source. Persist only explicit user preferences, not inferred likes.',
    inputSchema: sourcePreferencesToolSchema,
    execute: async input => {
      const userId = await requireUserId()

      if (input.action === 'list') {
        const [preferenceResult, profileResult] = await Promise.all([
          listSourcePreferences(userId),
          listSourcePreferenceProfiles(userId)
        ])
        if (!preferenceResult.success) {
          throw new Error(preferenceResult.error)
        }
        if (!profileResult.success) {
          throw new Error(profileResult.error)
        }

        return {
          ok: true,
          action: 'list' as const,
          preferences: preferenceResult.preferences,
          profiles: profileResult.profiles
        }
      }

      if (!input.target || !input.preference) {
        throw new Error(
          'Saving a source preference requires a target and preference.'
        )
      }

      let profile:
        | {
            id: string
            name: string
            slug: string
            [key: string]: unknown
          }
        | undefined

      if (input.profileName) {
        const normalizedProfile = normalizeSourcePreferenceProfileInput({
          name: input.profileName,
          includeTerms: input.profileTerms,
          excludeTerms: input.profileExcludeTerms
        })
        if (!normalizedProfile) {
          throw new Error('Invalid source preference profile.')
        }

        const profileResult = await upsertSourcePreferenceProfile(
          userId,
          normalizedProfile
        )
        if (!profileResult.success) {
          throw new Error(profileResult.error)
        }
        profile = profileResult.profile
      }

      const normalized = normalizeSourcePreferenceInput({
        ...input,
        ...(profile && { profileId: profile.id })
      })
      if (!normalized) {
        throw new Error('Invalid source preference target.')
      }

      const result = await upsertSourcePreference(userId, normalized)
      if (!result.success) {
        throw new Error(result.error)
      }

      return {
        ok: true,
        action: 'save' as const,
        preference: result.preference,
        ...(profile && { profile })
      }
    }
  })
}
