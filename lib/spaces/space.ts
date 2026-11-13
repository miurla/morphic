import { SPACE_COLORS, type SpaceColor } from '@/lib/db/schema'

export { SPACE_COLORS, type SpaceColor }

export const DEFAULT_SPACE_COLOR: SpaceColor = 'black'
export const DEFAULT_SPACE_NAME = 'Default'
export const SPACE_NAME_MAX_LENGTH = 30
export const SPACE_TEXT_MAX_LENGTH = 4000

export function isSpaceColor(value: unknown): value is SpaceColor {
  return (
    typeof value === 'string' &&
    (SPACE_COLORS as readonly string[]).includes(value)
  )
}

export function getSpaceDisplayName(space: {
  color: SpaceColor
  name: string
}): string {
  if (space.color === DEFAULT_SPACE_COLOR) return DEFAULT_SPACE_NAME
  const name = space.name.trim()
  if (name) return name
  return space.color.charAt(0).toUpperCase() + space.color.slice(1)
}
