'use client'

import { useSyncExternalStore } from 'react'

import type { ComponentFn } from '@json-render/react'

import {
  isFeatureEnabled,
  subscribeFeatureFlags
} from '@/lib/analytics/posthog-client'
import { cn } from '@/lib/utils'

import { Button as UIButton } from '@/components/ui/button'

import { type CatalogType, iconMap } from './shared'

const STYLE_FLAG = 'related_q_style_v2'

/**
 * Generic button spec component. Renders the project's shadcn Button and
 * emits a `press` action on click. Use variant="link" with an arrow icon
 * for inline follow-up suggestions (the former QuestionButton look).
 */
export const Button: ComponentFn<CatalogType, 'Button'> = ({ props, on }) => {
  const { text, icon, variant = 'link' } = props
  const Icon = icon ? iconMap[icon] : null
  const handle = on('press')

  // Follow-up suggestions render as link buttons. A/B their style via the
  // `related_q_style_v2` flag: control = inline muted link, test = pill/chip.
  // useSyncExternalStore keeps SSR on the control path (no hydration mismatch)
  // and re-renders once flags load.
  const isFollowup = variant === 'link'
  const flagOn = useSyncExternalStore(
    subscribeFeatureFlags,
    () => isFeatureEnabled(STYLE_FLAG),
    () => false
  )
  const chip = isFollowup && flagOn

  // Control link: muted color, left-aligned, wrappable text, zero padding.
  const linkOverride =
    isFollowup && !chip
      ? 'h-auto w-fit justify-start whitespace-normal text-left px-0 py-0.5 font-semibold text-accent-foreground/50 hover:text-accent-foreground/70'
      : ''
  // Test chip: bordered pill with higher contrast for a stronger tap affordance.
  const chipOverride = chip
    ? 'h-auto w-fit whitespace-normal rounded-full border px-3 py-1.5 text-left text-sm font-medium text-accent-foreground/80 hover:bg-muted hover:text-accent-foreground'
    : ''

  return (
    <UIButton
      variant={chip ? 'outline' : variant}
      onClick={handle.emit}
      className={cn('gap-2', linkOverride, chipOverride)}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {text}
    </UIButton>
  )
}
