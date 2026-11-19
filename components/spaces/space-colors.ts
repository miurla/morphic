import {
  DEFAULT_SPACE_COLOR,
  DEFAULT_SPACE_NAME,
  SPACE_COLORS,
  type SpaceColor
} from '@/lib/spaces/space'

export const SPACE_COLOR_COOKIE = 'spaceColor'

export function spaceColorValue(color: SpaceColor): string {
  return `var(--space-${color})`
}

/** Logo body fill; the default space keeps the logo's own color. */
export function spaceLogoColor(color: SpaceColor): string | undefined {
  return color === DEFAULT_SPACE_COLOR ? undefined : spaceColorValue(color)
}

export function spaceColorLabel(color: SpaceColor): string {
  if (color === DEFAULT_SPACE_COLOR) return DEFAULT_SPACE_NAME
  return color.charAt(0).toUpperCase() + color.slice(1)
}

export function spaceTransitionName(color: SpaceColor): string {
  return `space-${color}`
}

export { DEFAULT_SPACE_COLOR, SPACE_COLORS, type SpaceColor }
