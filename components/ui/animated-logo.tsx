'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export function AnimatedLogo({
  animate = true,
  className,
  ...props
}: React.ComponentProps<'svg'> & {
  animate?: boolean
}) {
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    if (animate) {
      return
    }

    let blinkTimeoutId: ReturnType<typeof setTimeout> | undefined
    let nextBlinkTimeoutId: ReturnType<typeof setTimeout>

    const scheduleBlink = () => {
      const nextDelay = Math.random() * 5000 + 2000

      nextBlinkTimeoutId = setTimeout(() => {
        setIsBlinking(true)

        blinkTimeoutId = setTimeout(() => {
          setIsBlinking(false)
          scheduleBlink()
        }, 200)
      }, nextDelay)
    }

    scheduleBlink()

    return () => {
      if (blinkTimeoutId) {
        clearTimeout(blinkTimeoutId)
      }
      clearTimeout(nextBlinkTimeoutId)
    }
  }, [animate])

  return (
    <svg
      fill="currentColor"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-8', className)}
      {...props}
    >
      <circle cx="128" cy="128" r="128" fill="black"></circle>
      <g
        className={cn(
          'origin-center',
          animate && 'animate-[lookAround_2s_ease-in-out_infinite]'
        )}
      >
        <ellipse
          cx="102"
          cy="128"
          rx="18"
          ry="18"
          fill="white"
          className={cn(!animate && isBlinking && 'animate-blink')}
        ></ellipse>
        <ellipse
          cx="154"
          cy="128"
          rx="18"
          ry="18"
          fill="white"
          className={cn(!animate && isBlinking && 'animate-blink')}
        ></ellipse>
      </g>
    </svg>
  )
}
