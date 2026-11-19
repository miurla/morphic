import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'

import {
  type ChatSpace,
  DEFAULT_SPACE_COLOR,
  getSpaceDisplayName,
  isSpaceColor
} from './space'

export type ChatSpaceForViewer = {
  space: ChatSpace | null
  // For viewers other than the owner: whether the owner's instructions
  // shape this chat. Their text is never sent.
  ownerInstructions: boolean
}

function hasInstructions(space: Space | null | undefined): boolean {
  return !!space && (!!space.about.trim() || !!space.style.trim())
}

/**
 * The space a chat belongs to, for a viewer who may already read the chat.
 * Others see only its color and whether instructions apply; the name and
 * instructions stay with the owner.
 */
export async function getChatSpaceForViewer(
  chat: { userId: string; spaceId: string | null },
  viewerId?: string | null
): Promise<ChatSpaceForViewer> {
  const isOwner = viewerId === chat.userId
  try {
    let space = chat.spaceId
      ? await dbActions.getSpaceById(chat.userId, chat.spaceId)
      : null
    // Chats without a space follow the owner's default space.
    const applied =
      space ??
      (isOwner
        ? null
        : ((
            await dbActions.getSpacesByColors(chat.userId, [
              DEFAULT_SPACE_COLOR
            ])
          )[0] ?? null))
    if (
      space &&
      (!isSpaceColor(space.color) || space.color === DEFAULT_SPACE_COLOR)
    ) {
      space = null
    }
    const ownerInstructions = !isOwner && hasInstructions(applied)
    if (!space) return { space: null, ownerInstructions }
    if (!isOwner) return { space: { color: space.color }, ownerInstructions }
    return {
      space: { color: space.color, name: getSpaceDisplayName(space) },
      ownerInstructions: false
    }
  } catch (error) {
    console.error('Failed to load chat space:', error)
    return { space: null, ownerInstructions: false }
  }
}
