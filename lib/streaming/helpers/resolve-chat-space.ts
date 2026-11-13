import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'
import { DEFAULT_SPACE_COLOR, isSpaceColor } from '@/lib/spaces/space'

export type ResolvedChatSpace = {
  // Stored on a new chat. Null means the default space.
  spaceId: string | null
  // Whose instructions apply to this turn.
  space: Space | null
}

/**
 * A new chat takes the requested space if the user owns it; an existing chat
 * keeps the space it was created in. Chats without a space read the user's
 * default space, which may not exist yet.
 */
export async function resolveChatSpace({
  userId,
  isNewChat,
  requestedColor,
  chatSpaceId
}: {
  userId: string
  isNewChat: boolean
  requestedColor?: unknown
  chatSpaceId?: string | null
}): Promise<ResolvedChatSpace> {
  if (!isNewChat) {
    if (chatSpaceId) {
      const space = await dbActions.getSpaceById(userId, chatSpaceId)
      if (space) return { spaceId: chatSpaceId, space }
    }
    const [space] = await dbActions.getSpacesByColors(userId, [
      DEFAULT_SPACE_COLOR
    ])
    return { spaceId: chatSpaceId ?? null, space: space ?? null }
  }

  const color =
    isSpaceColor(requestedColor) && requestedColor !== DEFAULT_SPACE_COLOR
      ? requestedColor
      : null
  const rows = await dbActions.getSpacesByColors(
    userId,
    color ? [color, DEFAULT_SPACE_COLOR] : [DEFAULT_SPACE_COLOR]
  )
  const requested = color ? rows.find(row => row.color === color) : undefined
  if (requested) return { spaceId: requested.id, space: requested }

  const fallback = rows.find(row => row.color === DEFAULT_SPACE_COLOR)
  return { spaceId: null, space: fallback ?? null }
}
