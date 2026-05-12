import { cn } from '@/lib/utils'

interface MarqueeProps {
  className?: string
  vertical?: boolean
  reverse?: boolean
  pauseOnHover?: boolean
  children: React.ReactNode
  duration?: number
}

export function Marquee({
  className,
  vertical = false,
  reverse = false,
  pauseOnHover = false,
  children,
  duration = 30
}: MarqueeProps) {
  return (
    <div
      className={cn(
        'group flex overflow-hidden',
        vertical ? 'flex-col' : 'flex-row',
        className
      )}
      style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
    >
      <div
        className={cn(
          'flex shrink-0',
          vertical ? 'animate-marquee-up flex-col' : 'flex-row',
          reverse ? '[animation-direction:reverse]' : '',
          pauseOnHover && 'group-hover:[animation-play-state:paused]'
        )}
      >
        <div
          className={cn('flex shrink-0', vertical ? 'flex-col' : 'flex-row')}
        >
          {children}
        </div>
        <div
          aria-hidden
          className={cn('flex shrink-0', vertical ? 'flex-col' : 'flex-row')}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
