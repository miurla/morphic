'use server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'
import {
  DEFAULT_SPACE_COLOR,
  DEFAULT_SPACE_NAME,
  isSpaceColor,
  SPACE_NAME_MAX_LENGTH,
  SPACE_TEXT_MAX_LENGTH
} from '@/lib/spaces/space'

type SpaceInput = {
  color: string
  name?: string
  about?: string
  style?: string
}

function validateText(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === undefined) return null
  if (typeof value !== 'string') return `${label} must be text.`
  if (value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`
  }
  return null
}

export async function listSpaces(): Promise<{
  success: boolean
  spaces: Space[]
  error?: string
}> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, spaces: [], error: 'Sign in to use spaces.' }
  }

  try {
    const spaces = await dbActions.getSpaces(userId)
    return { success: true, spaces }
  } catch (error) {
    console.error('Error listing spaces:', error)
    return { success: false, spaces: [], error: 'Failed to load spaces.' }
  }
}

export async function saveSpace(
  input: SpaceInput
): Promise<{ success: boolean; space?: Space; error?: string }> {
  const { color } = input
  if (!isSpaceColor(color)) {
    return { success: false, error: 'Unknown space color.' }
  }

  const validationError =
    validateText(input.name, 'Name', SPACE_NAME_MAX_LENGTH) ??
    validateText(input.about, 'About', SPACE_TEXT_MAX_LENGTH) ??
    validateText(input.style, 'Style', SPACE_TEXT_MAX_LENGTH)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'Sign in to use spaces.' }
  }

  const isDefault = color === DEFAULT_SPACE_COLOR
  try {
    const space = await dbActions.upsertSpace({
      userId,
      color,
      name: isDefault ? DEFAULT_SPACE_NAME : input.name,
      about: input.about,
      style: input.style
    })
    return { success: true, space }
  } catch (error) {
    console.error('Error saving space:', error)
    return { success: false, error: 'Failed to save space.' }
  }
}

export async function deleteSpace(
  color: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSpaceColor(color)) {
    return { success: false, error: 'Unknown space color.' }
  }
  if (color === DEFAULT_SPACE_COLOR) {
    return { success: false, error: 'The default space cannot be deleted.' }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'Sign in to use spaces.' }
  }

  return dbActions.deleteSpace(userId, color)
}
