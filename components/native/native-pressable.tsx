'use client'

import * as React from 'react'

import { type HTMLMotionProps,motion, useReducedMotion } from 'motion/react'

import { nativeMotion } from '@/lib/native/motion'
import { cn } from '@/lib/utils'

export interface NativePressableProps extends HTMLMotionProps<'button'> {
  pressScale?: number
  liftOnHover?: boolean
}

const NativePressable = React.forwardRef<HTMLButtonElement, NativePressableProps>(
  (
    {
      className,
      disabled,
      liftOnHover = false,
      pressScale = nativeMotion.press.scale,
      transition,
      whileHover,
      whileTap,
      ...props
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const shouldDisableMotion = Boolean(disabled || prefersReducedMotion)

    return (
      <motion.button
        ref={ref}
        className={cn(className)}
        disabled={disabled}
        transition={transition ?? nativeMotion.spring.snappy}
        whileHover={
          shouldDisableMotion || !liftOnHover
            ? whileHover
            : (whileHover ?? { y: nativeMotion.press.hoverLift })
        }
        whileTap={
          shouldDisableMotion ? whileTap : (whileTap ?? { scale: pressScale })
        }
        {...props}
      />
    )
  }
)
NativePressable.displayName = 'NativePressable'

export { NativePressable }
