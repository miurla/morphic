import * as dbActions from '@/lib/db/actions'

import {
  type ChatSpace,
  DEFAULT_SPACE_COLOR,
  getSpaceDisplayName,
  isSpaceColor
} from './space'

/**
 * The space a chat belongs to, for a viewer who may already read the chat.
 * Others see only its color; the name and instructions stay with the owner.
 */
export async function getChatSpaceForViewer(
  chat: { userId: string; spaceId: string | null },
  viewerId?: string | null
): Promise<ChatSpace | null> {
  if (!chat.spaceId) return null
  try {
    const space = await dbActions.getSpaceById(chat.userId, chat.spaceId)
    if (!space || !isSpaceColor(space.color)) return null
    if (space.color === DEFAULT_SPACE_COLOR) return null
    if (viewerId !== chat.userId) return { color: space.color }
    return { color: space.color, name: getSpaceDisplayName(space) }
  } catch (error) {
    console.error('Failed to load chat space:', error)
    return null
  }
}
