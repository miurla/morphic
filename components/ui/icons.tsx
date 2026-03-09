'use client'

import { cn } from '@/lib/utils'

function IconLogo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <rect width="256" height="256" rx="48" fill="currentColor" />
      <text
        x="128"
        y="185"
        textAnchor="middle"
        fontSize="160"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        fill="white"
      >
        B
      </text>
    </svg>
  )
}

function IconLogoOutline({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <rect
        width="256"
        height="256"
        rx="48"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
      />
      <text
        x="128"
        y="185"
        textAnchor="middle"
        fontSize="160"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        fill="currentColor"
      >
        B
      </text>
    </svg>
  )
}

export { IconLogo, IconLogoOutline }
