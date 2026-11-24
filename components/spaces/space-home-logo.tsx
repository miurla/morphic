'use client'

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  ViewTransition
} from 'react'

import { cn } from '@/lib/utils'

import { IconBlinkingLogo } from '@/components/ui/icons'

import { useI18n } from '@/components/language-provider'

import {
  type SpaceColor,
  spaceColorValue,
  spaceLogoColor,
  spaceTransitionName
} from './space-colors'
import { useIsVisibleSurface } from './space-surface'
import { useSpaces } from './spaces-provider'

const LONG_PRESS_MS = 450
const LONG_PRESS_SLOP_PX = 10
const CLOSE_DELAY_MS = 150
const SWITCH_SETTLE_MS = 350
const PEEK_TIMES_MS = [1500, 7000, 14000]
const PEEK_HOLD_MS = 1800

type Slot = SpaceColor | 'new'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )
}

/**
 * The logo above the home input. Signed-in users pick a space from the dots
 * that fan out around it and open space settings by clicking it. Guests get
 * the plain logo.
 */
export function SpaceHomeLogo() {
  const spaces = useSpaces()
  const visible = useIsVisibleSurface()

  if (!spaces.enabled) return <IconBlinkingLogo className="size-12" />

  const logo = (
    <IconBlinkingLogo
      className="size-12"
      bodyColor={spaceLogoColor(spaces.active)}
    />
  )
  // Keep the logo's place while settings cover the home.
  if (spaces.editor) return <div className="invisible">{logo}</div>
  if (!visible) return logo
  return <SpaceSwitcher />
}

function SpaceSwitcher() {
  const { t } = useI18n()
  const spaces = useSpaces()
  const reducedMotion = useReducedMotion()
  const [fanOpen, setFanOpen] = useState(false)
  const [hovered, setHovered] = useState<Slot | 'logo' | null>(null)
  const [peeking, setPeeking] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // While a switch animates, the transition overlay fires stray
  // enter/leave events; afterwards the pointer rests on the swapped-in dot
  // and should not show its name until it leaves.
  const switching = useRef(false)
  const switchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hoverLocked = useRef(false)
  const press = useRef<{
    x: number
    y: number
    timer?: ReturnType<typeof setTimeout>
    opened: boolean
  } | null>(null)
  const suppressClick = useRef(false)

  const { active, slots, nextFree, peekSeen, loaded, markPeekSeen } = spaces
  // Until saved spaces load, the selected color may look unused.
  const items: Slot[] = loaded
    ? [...slots, ...(nextFree ? (['new'] as const) : [])]
    : []
  // Nearest first, alternating right and left.
  const right = items.filter((_, i) => i % 2 === 0)
  const left = items.filter((_, i) => i % 2 === 1)

  const isSwitching = () => switching.current

  const openFan = () => {
    clearTimeout(closeTimer.current)
    setFanOpen(true)
    if (!peekSeen) markPeekSeen()
  }
  const closeFan = () => {
    clearTimeout(closeTimer.current)
    setFanOpen(false)
    setHovered(null)
  }
  const closeFanSoon = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(closeFan, CLOSE_DELAY_MS)
  }

  useEffect(
    () => () => {
      clearTimeout(closeTimer.current)
      clearTimeout(switchTimer.current)
    },
    []
  )

  // A touch-opened fan closes on a tap outside it or on Escape.
  useEffect(() => {
    if (!fanOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[data-space-switcher]')) closeFan()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFan()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fanOpen])

  // Peek a few times until the user has opened the fan once.
  const shouldPeek = loaded && !peekSeen
  useEffect(() => {
    if (!shouldPeek) return
    const timers = PEEK_TIMES_MS.flatMap(at => [
      setTimeout(() => setPeeking(true), at),
      setTimeout(() => setPeeking(false), at + PEEK_HOLD_MS)
    ])
    return () => {
      timers.forEach(clearTimeout)
      setPeeking(false)
    }
  }, [shouldPeek])

  const peek = peeking && !peekSeen && !fanOpen
  const dotsPeek = peek && !reducedMotion

  const choose = (color: SpaceColor) => {
    switching.current = true
    clearTimeout(switchTimer.current)
    switchTimer.current = setTimeout(() => {
      switching.current = false
    }, SWITCH_SETTLE_MS)
    hoverLocked.current = true
    setHovered(null)
    spaces.switchTo(color)
  }

  const onItemEnter = (slot: Slot) => {
    if (isSwitching() || hoverLocked.current) return
    setHovered(slot)
  }
  const onItemLeave = () => {
    if (isSwitching()) return
    hoverLocked.current = false
    setHovered(null)
  }

  const motionStyle = (index: number, dir: 'left' | 'right'): CSSProperties => {
    const toward = dir === 'right' ? -1 : 1
    if (fanOpen) {
      return { transitionDelay: `${index * 35}ms` }
    }
    if (dotsPeek) {
      return {
        opacity: 0.55,
        translate: `${toward * 8}px 0`,
        scale: '0.7',
        transitionDuration: '450ms',
        transitionDelay: `${index * 35}ms`
      }
    }
    return {
      opacity: 0,
      translate: `${toward * 16}px 0`,
      scale: '0.5',
      transitionDuration: peek ? '450ms' : undefined
    }
  }

  const renderSide = (sideItems: Slot[], dir: 'left' | 'right') => (
    <div
      className={cn(
        'absolute top-1/2 -translate-y-1/2 flex items-center gap-2.5',
        dir === 'right' ? 'left-full pl-4' : 'right-full pr-4 flex-row-reverse'
      )}
    >
      {sideItems.map((slot, index) => {
        const color = slot === 'new' ? nextFree! : slot
        const dot = (
          <button
            type="button"
            tabIndex={fanOpen ? 0 : -1}
            aria-label={
              slot === 'new'
                ? t('New space')
                : t('Switch to {name}', { name: spaces.nameOf(slot) })
            }
            onPointerEnter={() => onItemEnter(slot)}
            onPointerLeave={onItemLeave}
            onFocus={() => onItemEnter(slot)}
            onBlur={onItemLeave}
            onClick={() => {
              if (slot === 'new') spaces.openEditor(color)
              else choose(slot)
            }}
            className={cn(
              'size-7 shrink-0 rounded-full transition-[opacity,translate,scale] duration-200 ease-out hover:scale-110',
              slot === 'new' &&
                'grid place-items-center border-2 border-dashed text-sm leading-none',
              !fanOpen && 'pointer-events-none'
            )}
            style={{
              ...(slot === 'new'
                ? {
                    borderColor: spaceColorValue(color),
                    color: spaceColorValue(color)
                  }
                : { background: spaceColorValue(color) }),
              ...motionStyle(index, dir)
            }}
          >
            {slot === 'new' ? '+' : null}
          </button>
        )
        return (
          <ViewTransition key={slot} name={spaceTransitionName(color)}>
            {dot}
          </ViewTransition>
        )
      })}
    </div>
  )

  const badgeLabel =
    hovered === 'new'
      ? t('New space')
      : hovered && hovered !== 'logo'
        ? spaces.nameOf(hovered)
        : fanOpen || hovered === 'logo'
          ? spaces.nameOf(active)
          : null
  const badgeColor: SpaceColor | null =
    hovered === 'new' ? null : hovered && hovered !== 'logo' ? hovered : active
  // Keep the last label while the badge fades out.
  const [shownBadge, setShownBadge] = useState<{
    label: string
    color: SpaceColor | null
  }>({ label: '', color: null })
  if (
    badgeLabel &&
    (badgeLabel !== shownBadge.label || badgeColor !== shownBadge.color)
  ) {
    setShownBadge({ label: badgeLabel, color: badgeColor })
  }

  return (
    <div
      data-space-switcher
      className="relative select-none"
      onPointerEnter={event => {
        if (event.pointerType === 'mouse') openFan()
      }}
      // The pointer may already rest here when the switcher mounts (after
      // settings close), so no enter event comes.
      onPointerMove={event => {
        if (event.pointerType === 'mouse' && !fanOpen) openFan()
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'mouse' || isSwitching()) return
        closeFanSoon()
      }}
      onFocus={event => {
        // Keyboard focus opens the fan; a tap's focus does not.
        if (event.target.matches(':focus-visible')) openFan()
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          closeFanSoon()
        }
      }}
    >
      {renderSide(left, 'left')}
      <ViewTransition key={active} name={spaceTransitionName(active)}>
        <button
          type="button"
          aria-label={t('Space settings')}
          className="block rounded-full transition-[scale] duration-150 ease-out hover:scale-105 active:scale-95 touch-pan-y [-webkit-touch-callout:none]"
          onContextMenu={event => event.preventDefault()}
          onPointerEnter={event => {
            if (event.pointerType === 'mouse') setHovered('logo')
          }}
          onPointerLeave={() =>
            setHovered(prev => (prev === 'logo' ? null : prev))
          }
          onPointerDown={event => {
            if (event.pointerType === 'mouse') return
            const current = {
              x: event.clientX,
              y: event.clientY,
              opened: false,
              timer: undefined as ReturnType<typeof setTimeout> | undefined
            }
            current.timer = setTimeout(() => {
              current.opened = true
              openFan()
            }, LONG_PRESS_MS)
            press.current = current
          }}
          onPointerMove={event => {
            const current = press.current
            if (!current || current.opened) return
            const moved = Math.hypot(
              event.clientX - current.x,
              event.clientY - current.y
            )
            if (moved > LONG_PRESS_SLOP_PX) {
              clearTimeout(current.timer)
              press.current = null
            }
          }}
          onPointerUp={() => {
            const current = press.current
            if (!current) return
            clearTimeout(current.timer)
            // Lifting the finger after a long press does not open settings.
            suppressClick.current = current.opened
            press.current = null
          }}
          onPointerCancel={() => {
            clearTimeout(press.current?.timer)
            press.current = null
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            closeFan()
            spaces.openEditor()
          }}
        >
          <IconBlinkingLogo
            className="size-12"
            bodyColor={spaceLogoColor(active)}
          />
        </button>
      </ViewTransition>
      {renderSide(right, 'right')}
      <SpaceBadge visible={!!badgeLabel}>
        {shownBadge.color && (
          <span
            className="size-2 rounded-full"
            style={{
              background: spaceColorValue(shownBadge.color)
            }}
          />
        )}
        {shownBadge.label}
      </SpaceBadge>
      <SpaceBadge
        visible={peek && !badgeLabel}
        className="text-muted-foreground duration-[450ms]"
      >
        {t('Make it yours')}
      </SpaceBadge>
    </div>
  )
}

function SpaceBadge({
  visible,
  className,
  children
}: {
  visible: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-[opacity,translate] duration-150 ease-out',
        visible ? 'opacity-100' : 'opacity-0 translate-y-1',
        className
      )}
    >
      {children}
    </span>
  )
}
