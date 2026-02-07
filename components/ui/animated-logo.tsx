'use client'

import { cn } from '@/lib/utils'

export function AnimatedLogo({
  className,
  ...props
}: React.ComponentProps<'svg'>) {
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
      <g className="animate-[lookAround_2s_ease-in-out_infinite] origin-center">
        <circle cx="102" cy="128" r="18" fill="white"></circle>
        <circle cx="154" cy="128" r="18" fill="white"></circle>
      </g>
    </svg>
  )
}
