'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'

import {
  generateId,
  sourcePreferenceProfiles,
  sourcePreferences
} from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'
import type { NormalizedSourcePreferenceProfileInput } from '@/lib/sources/source-preference-profiles'
import type { NormalizedSourcePreferenceInput } from '@/lib/sources/source-preferences'

export async function listSourcePreferences(
  userId: string,
  options?: { profileId?: string }
) {
  try {
    return await withRLS(userId, async tx => {
      const preferences = await tx
        .select()
        .from(sourcePreferences)
        .where(
          and(
            eq(sourcePreferences.userId, userId),
            options?.profileId
              ? eq(sourcePreferences.profileId, options.profileId)
              : undefined
          )
        )
        .orderBy(
          desc(sourcePreferences.updatedAt),
          desc(sourcePreferences.createdAt)
        )

      return { success: true as const, preferences }
    })
  } catch (error) {
    console.error('Failed to list source preferences:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to list source preferences'
    }
  }
}

export async function listSourcePreferenceProfiles(userId: string) {
  try {
    return await withRLS(userId, async tx => {
      const profiles = await tx
        .select()
        .from(sourcePreferenceProfiles)
        .where(eq(sourcePreferenceProfiles.userId, userId))
        .orderBy(
          desc(sourcePreferenceProfiles.updatedAt),
          desc(sourcePreferenceProfiles.createdAt)
        )

      return { success: true as const, profiles }
    })
  } catch (error) {
    console.error('Failed to list source preference profiles:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to list source preference profiles'
    }
  }
}

export async function upsertSourcePreferenceProfile(
  userId: string,
  input: NormalizedSourcePreferenceProfileInput
) {
  try {
    return await withRLS(userId, async tx => {
      const values = {
        userId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        settings: input.settings,
        isActive: input.isActive,
        updatedAt: new Date()
      }

      const [existing] = await tx
        .select()
        .from(sourcePreferenceProfiles)
        .where(
          and(
            eq(sourcePreferenceProfiles.userId, userId),
            eq(sourcePreferenceProfiles.slug, input.slug)
          )
        )
        .limit(1)

      if (existing) {
        const [profile] = await tx
          .update(sourcePreferenceProfiles)
          .set(values)
          .where(eq(sourcePreferenceProfiles.id, existing.id))
          .returning()

        return { success: true as const, profile, created: false }
      }

      const [profile] = await tx
        .insert(sourcePreferenceProfiles)
        .values({
          id: generateId(),
          ...values
        })
        .returning()

      return { success: true as const, profile, created: true }
    })
  } catch (error) {
    console.error('Failed to save source preference profile:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save source preference profile'
    }
  }
}

export async function upsertSourcePreference(
  userId: string,
  input: NormalizedSourcePreferenceInput
) {
  try {
    return await withRLS(userId, async tx => {
      const values = {
        userId,
        profileId: input.profileId ?? null,
        target: input.target,
        targetType: input.targetType,
        domain: input.domain,
        preference: input.preference,
        note: input.note ?? null,
        updatedAt: new Date()
      }

      if (input.profileId) {
        const [profile] = await tx
          .select({ id: sourcePreferenceProfiles.id })
          .from(sourcePreferenceProfiles)
          .where(
            and(
              eq(sourcePreferenceProfiles.userId, userId),
              eq(sourcePreferenceProfiles.id, input.profileId)
            )
          )
          .limit(1)

        if (!profile) {
          return {
            success: false as const,
            error: 'Source preference profile not found'
          }
        }
      }

      const [existing] = await tx
        .select()
        .from(sourcePreferences)
        .where(
          and(
            eq(sourcePreferences.userId, userId),
            input.profileId
              ? eq(sourcePreferences.profileId, input.profileId)
              : isNull(sourcePreferences.profileId),
            eq(sourcePreferences.target, input.target)
          )
        )
        .limit(1)

      if (existing) {
        const [preference] = await tx
          .update(sourcePreferences)
          .set(values)
          .where(eq(sourcePreferences.id, existing.id))
          .returning()

        return { success: true as const, preference, created: false }
      }

      const [preference] = await tx
        .insert(sourcePreferences)
        .values({
          id: generateId(),
          ...values
        })
        .returning()

      return { success: true as const, preference, created: true }
    })
  } catch (error) {
    console.error('Failed to save source preference:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save source preference'
    }
  }
}

export async function deleteSourcePreferenceProfile(
  userId: string,
  id: string
) {
  try {
    return await withRLS(userId, async tx => {
      const [profile] = await tx
        .select({ id: sourcePreferenceProfiles.id })
        .from(sourcePreferenceProfiles)
        .where(
          and(
            eq(sourcePreferenceProfiles.userId, userId),
            eq(sourcePreferenceProfiles.id, id)
          )
        )
        .limit(1)

      if (!profile) {
        return {
          success: false as const,
          error: 'Source preference profile not found'
        }
      }

      await tx
        .delete(sourcePreferences)
        .where(
          and(
            eq(sourcePreferences.userId, userId),
            eq(sourcePreferences.profileId, id)
          )
        )

      await tx
        .delete(sourcePreferenceProfiles)
        .where(
          and(
            eq(sourcePreferenceProfiles.userId, userId),
            eq(sourcePreferenceProfiles.id, id)
          )
        )

      return { success: true as const }
    })
  } catch (error) {
    console.error('Failed to delete source preference profile:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete source preference profile'
    }
  }
}

export async function deleteSourcePreference(userId: string, id: string) {
  try {
    return await withRLS(userId, async tx => {
      const [deleted] = await tx
        .delete(sourcePreferences)
        .where(
          and(
            eq(sourcePreferences.userId, userId),
            eq(sourcePreferences.id, id)
          )
        )
        .returning()

      if (!deleted) {
        return { success: false as const, error: 'Source preference not found' }
      }

      return { success: true as const }
    })
  } catch (error) {
    console.error('Failed to delete source preference:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete source preference'
    }
  }
}
